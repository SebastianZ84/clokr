---
phase: 13-overtime-handling-mode-carry-forward-track-only
plan: 02
subsystem: api
tags: [overtime, saldo, track-only, carry-forward, bifurcation]
dependency_graph:
  requires: [13-01]
  provides: [TRACK_ONLY saldo bifurcation in updateOvertimeAccount, close-month, auto-close cron]
  affects:
    - apps/api/src/routes/time-entries.ts
    - apps/api/src/routes/overtime.ts
    - apps/api/src/plugins/auto-close-month.ts
    - apps/api/src/__tests__/overtime-calc.test.ts
tech_stack:
  added: []
  patterns: [isTrackOnly guard, effectiveCarryOver bifurcation, effectiveBalanceHours bifurcation]
key_files:
  created: []
  modified:
    - apps/api/src/routes/time-entries.ts
    - apps/api/src/routes/overtime.ts
    - apps/api/src/plugins/auto-close-month.ts
    - apps/api/src/__tests__/overtime-calc.test.ts
decisions:
  - "isTrackOnly check requires both MONTHLY_HOURS type AND overtimeMode=TRACK_ONLY to prevent FIXED_WEEKLY schedules from being affected by overtimeMode field"
  - "snapshot.balanceMinutes always stored as-is (informational) regardless of overtimeMode per D-06"
  - "effectiveCarryOver=0 for TRACK_ONLY means each month starts fresh with zero carryover"
metrics:
  duration: "15 minutes"
  completed: "2026-04-13"
  tasks: 1
  files_changed: 4
---

# Phase 13 Plan 02: overtimeMode Saldo Bifurcation Summary

**One-liner:** Bifurcated saldo calculation in 3 API files so TRACK_ONLY employees always have balanceHours=0 and carryOver=0, while CARRY_FORWARD (existing) behavior is completely unchanged.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing tests for TRACK_ONLY behavior | 594fc21 | overtime-calc.test.ts |
| 1 (GREEN) | Bifurcate saldo logic in 3 API files | cde4aa0 | time-entries.ts, overtime.ts, auto-close-month.ts |

## What Was Built

### `updateOvertimeAccount` in `time-entries.ts`

Added `isTrackOnly` guard after `totalBalanceHours` is computed:
- `isTrackOnly = String(schedule.type) === "MONTHLY_HOURS" && schedule.overtimeMode === "TRACK_ONLY"`
- `effectiveBalanceHours = isTrackOnly ? 0 : totalBalanceHours`
- OvertimeAccount upsert now uses `effectiveBalanceHours` — TRACK_ONLY employees always show 0 in the live balance display

### `close-month` handler in `overtime.ts`

Added bifurcation after `carryOver = prevCarryOver + balanceMinutes`:
- `effectiveCarryOver = isTrackOnly ? 0 : carryOver`
- SaldoSnapshot.carryOver stores `effectiveCarryOver` (0 for TRACK_ONLY)
- OvertimeAccount upsert uses `effectiveCarryOver / 60` (0 for TRACK_ONLY)
- `snapshot.balanceMinutes` is NOT changed — always stored for informational reconstruction

### Auto-close cron in `auto-close-month.ts`

Same bifurcation pattern as close-month handler:
- `effectiveCarryOver = isTrackOnly ? 0 : carryOver`
- saldoSnapshot.carryOver = effectiveCarryOver
- overtimeAccount.balanceHours = effectiveCarryOver / 60

### Integration tests in `overtime-calc.test.ts`

New `describe("overtimeMode bifurcation")` block with 3 tests:
1. CARRY_FORWARD regression guard — validates existing behavior is unaffected
2. TRACK_ONLY live balance — asserts balanceHours=0 after working overtime (via POST /time-entries + GET /overtime)
3. TRACK_ONLY close-month — asserts snapshot.carryOver=0 and overtimeAccount.balanceHours=0 after POST /overtime/close-month

All 9 tests pass (6 pre-existing + 3 new).

## Threat Mitigations Applied

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-13-04 | overtimeMode only writable via PUT /settings/work with requireRole guard (from Plan 01) | Pre-existing |
| T-13-05 | isTrackOnly check requires explicit "TRACK_ONLY" string — unknown values fall through to CARRY_FORWARD | Applied (accept) |
| T-13-06 | snapshot.balanceMinutes always stored regardless of mode for audit reconstruction | Applied |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The bifurcation is fully wired in all three execution paths. Plan 03 will add the UI selector to expose overtimeMode to admins.

## Threat Flags

None found. No new network endpoints or auth paths introduced — this is purely internal calculation logic.

## Self-Check: PASSED

- [x] `grep "TRACK_ONLY" apps/api/src/routes/time-entries.ts` → 2 lines (comment + condition)
- [x] `grep "TRACK_ONLY" apps/api/src/routes/overtime.ts` → 2 lines (condition + comment)
- [x] `grep "TRACK_ONLY" apps/api/src/plugins/auto-close-month.ts` → 2 lines (condition)
- [x] `grep "effectiveBalanceHours" apps/api/src/routes/time-entries.ts` → 2 lines (declaration + upsert)
- [x] `grep "effectiveCarryOver" apps/api/src/routes/overtime.ts` → 3 lines
- [x] `grep "effectiveCarryOver" apps/api/src/plugins/auto-close-month.ts` → 3 lines
- [x] `grep -c "TRACK_ONLY" apps/api/src/__tests__/overtime-calc.test.ts` → 10
- [x] All 9 vitest tests pass (overtime-calc.test.ts exits 0)
- [x] Commit 594fc21 exists (RED tests)
- [x] Commit cde4aa0 exists (GREEN implementation)
