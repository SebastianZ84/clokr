---
phase: 14-weekday-configuration-per-day-soll
plan: "01"
subsystem: schedule-config
tags: [MONTHLY_HOURS, weekday-config, admin-ui, bug-fix, integration-tests]
dependency_graph:
  requires: [13-03]
  provides: [SCHED-04-weekday-persistence, SCHED-04-weekday-ui]
  affects: [apps/web/src/routes/(app)/admin/vacation/+page.svelte, apps/api/src/routes/__tests__/minijob.test.ts]
tech_stack:
  added: []
  patterns: [Svelte 5 boolean chip toggle, CSS pill chip (border-radius 999px)]
key_files:
  created: []
  modified:
    - apps/api/src/routes/__tests__/minijob.test.ts
    - apps/web/src/routes/(app)/admin/vacation/+page.svelte
decisions:
  - "Weekday booleans (eMonWd...eSunWd) store 1/0 sentinel values at API boundary, not fractional hours — consistent with MONTHLY_HOURS semantics where day-hours are presence flags not time targets"
  - "Chip picker placed after overtimeMode select (phase 13 addition) inside MONTHLY_HOURS block — groups all MONTHLY_HOURS-specific config together"
  - "Regenerated Prisma client (prisma generate) to unblock pre-existing test failures caused by missing overtimeMode field in generated client — Rule 3 auto-fix"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_changed: 2
---

# Phase 14 Plan 01: SCHED-04 Weekday Config — Integration Tests + saveEmployee Fix + Chip Picker UI Summary

**One-liner:** MONTHLY_HOURS weekday chip picker with Mo-Fr/Sa-So toggle buttons, fixing saveEmployee zero-out bug via eMonWd...eSunWd boolean state, with 2 SCHED-04 integration tests confirming API persistence.

## What Was Built

**Task 1: SCHED-04 integration tests + saveEmployee bug fix**

Added a `describe("SCHED-04: Weekday configuration for MONTHLY_HOURS")` block to `minijob.test.ts` with two integration tests:
- Test 1 verifies that PUT /settings/work/:id with mondayHours=1...fridayHours=1 for MONTHLY_HOURS returns those non-zero values back
- Test 2 verifies that all-zero day fields round-trip correctly

Fixed the `saveEmployee` function in `admin/vacation/+page.svelte` which previously hardcoded all 7 day fields to `0` for MONTHLY_HOURS employees. The fix introduces 7 boolean state variables (`eMonWd`...`eSunWd`) that track which weekdays are active. Each day field now sends `(eWd ? 1 : 0)` instead of `0`.

**Task 2: Weekday toggle chip picker UI**

Added a "Feste Arbeitstage" section inside the `{#if eType === "MONTHLY_HOURS"}` block (after overtimeMode select, before `{:else}`). The section contains 7 pill-shaped toggle chip buttons with:
- German labels: Mo, Di, Mi, Do, Fr, Sa, So
- Active state: `var(--color-brand)` fill
- Inactive state: `var(--color-border)` border with hover color hint
- Svelte 5 `onclick` syntax (not `on:click`)
- Helper text per D-15: "Wenn konfiguriert, wird ein tägliches Soll im Kalender angezeigt (Budget ÷ Arbeitstage im Monat)."

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SCHED-04 integration tests + saveEmployee fix | 508d2f9 | minijob.test.ts, vacation/+page.svelte |
| 2 | Weekday toggle chip picker UI | 03e8566 | vacation/+page.svelte |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated Prisma client for overtimeMode field**
- **Found during:** Task 1 verification — all API integration tests failing
- **Issue:** The Prisma generated client didn't include the `overtimeMode` field that was added to the schema in phase 13-01. The `prisma generate` command had not been run after schema changes, causing `PrismaClientValidationError: Unknown argument overtimeMode` on any WorkSchedule create/update call.
- **Fix:** Ran `pnpm --filter @clokr/db exec prisma generate` to regenerate the client. This is a pre-existing gap from phase 13 work.
- **Files modified:** `packages/db/generated/client/` (in main repo, not worktree)
- **Commit:** N/A (main repo file, not part of worktree diff)

### Remaining Pre-existing Failures

The following test failures exist before this plan and are NOT caused by plan changes:
- `__tests__/overtime-calc.test.ts` > TRACK_ONLY close-month snapshot (1 test)
- `routes/__tests__/time-entries-validation.test.ts` > clock-in conflict with isInvalid entries (2 tests)

These are tracked as deferred issues for future plans.

## Verification Results

- `grep -c "eMonWd" vacation/+page.svelte` → 5 (declaration + openEmpModal init×2 + saveEmployee payload + template×7 chip buttons)
- `grep "mondayHours.*eMonWd" vacation/+page.svelte` → matches fixed save payload line
- `grep "SCHED-04" minijob.test.ts` → matches new describe block
- `grep "stores non-zero mondayHours" minijob.test.ts` → matches Test 1
- `grep "stores all-zero day fields" minijob.test.ts` → matches Test 2
- No `eType === "FIXED_WEEKLY" ? eMon : 0` pattern in saveEmployee
- `grep -c "wd-chip" vacation/+page.svelte` → 10 (7 buttons × class + 3 CSS selectors)
- `grep "Feste Arbeitstage"` → 1 line (section header)
- `grep "Wenn konfiguriert"` → 1 line (helper text)
- `grep -c "wd-chip--active"` → 9 (7 chip class:bindings + .wd-chip--active selector + :hover:not selector)
- `grep "border-radius: 999px"` → matches pill shape
- All minijob.test.ts tests pass (8 tests, including 2 new SCHED-04 tests)

## Known Stubs

None — all weekday state is wired to the save payload and chip UI correctly.

## Threat Flags

No new security surface introduced. PUT /settings/work/:employeeId already has `requireRole("ADMIN", "MANAGER")` guard and Zod validation on all 7 day fields (z.number().min(0).max(24)). Weekday chip UI is only visible to authenticated admin users.

## Self-Check: PASSED

- `508d2f9` commit exists: verified via git log
- `03e8566` commit exists: verified via git log
- `apps/api/src/routes/__tests__/minijob.test.ts` modified: confirmed
- `apps/web/src/routes/(app)/admin/vacation/+page.svelte` modified: confirmed
