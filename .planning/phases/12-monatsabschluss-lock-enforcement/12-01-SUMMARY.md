---
phase: 12-monatsabschluss-lock-enforcement
plan: 01
subsystem: api
tags: [prisma, fastify, lock-enforcement, audit-trail, monatsabschluss, saldo-snapshot]

# Dependency graph
requires: []
provides:
  - POST /time-entries lock check via SaldoSnapshot composite key (HTTP 403)
  - POST /overtime/unlock-month endpoint (atomic snapshot delete + entry unlock)
  - auto-close-month grace period (DEFAULT_CLOSE_AFTER_DAY = 15)
  - close-month earlyClose response field with gracePeriodEnds ISO date
affects:
  - 12-02-PLAN (UI indicators consume isLocked entries + unlockMonth function)
  - 12-03-PLAN (any UI for manual close-month will see earlyClose field)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lock check via SaldoSnapshot composite unique key (not entry-count based) — authoritative even when no entries exist yet"
    - "Atomic unlock transaction: delete snapshot + updateMany entries in single $transaction"
    - "earlyClose informational hint on manual close-month (Date.UTC month 0-based offset for following month)"

key-files:
  created:
    - apps/api/src/routes/__tests__/saldo-snapshot.test.ts
  modified:
    - apps/api/src/routes/time-entries.ts
    - apps/api/src/routes/overtime.ts
    - apps/api/src/plugins/auto-close-month.ts
    - apps/api/src/routes/__tests__/time-entries-validation.test.ts

key-decisions:
  - "Use findUnique on composite key (not findFirst with date range) for lock check — matches how close-month creates snapshots"
  - "DEFAULT_CLOSE_AFTER_DAY = 15 hardcoded constant (TenantConfig schema change deferred)"
  - "updateOvertimeAccount called after unlock transaction to recalculate stored balance"
  - "Audit action UNLOCK with oldValue=snap preserves deleted snapshot data for reconstruction (D-06)"
  - "Test timestamps use Europe/Berlin UTC offsets (UTC+1) to match monthRangeUtc composite key"

patterns-established:
  - "Lock enforcement pattern: findUnique on employeeId_periodType_periodStart composite key"
  - "Unlock pattern: $transaction(delete snapshot + updateMany entries) + updateOvertimeAccount + audit UNLOCK"

requirements-completed: [BUG-02]

# Metrics
duration: 45min
completed: 2026-04-13
---

# Phase 12 Plan 01: Lock Enforcement + Unlock Endpoint + Grace Period Summary

**SaldoSnapshot-based POST /time-entries lock guard (403), atomic unlock-month endpoint with audit trail, and configurable 15-day grace period in auto-close-month**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-13T18:05:00Z
- **Completed:** 2026-04-13T18:20:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 source + 1 test added)

## Accomplishments

- Closed the mutation gap where a manager could POST a time entry into a locked month — now returns HTTP 403 with German error message
- Added POST /overtime/unlock-month with full security: role enforcement (ADMIN/MANAGER only), tenant isolation (404 on cross-tenant), atomic transaction (snapshot delete + entry unlock), overtime account recalculation, and UNLOCK audit log entry preserving deleted snapshot data
- Replaced hard-coded 10-day auto-close guard with configurable DEFAULT_CLOSE_AFTER_DAY = 15, preventing premature auto-close during the 14-day correction window; added earlyClose informational field to manual close-month response

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: SaldoSnapshot lock check test** - `bee628a` (test)
2. **Task 1 GREEN: Add lock check to POST /time-entries** - `325b306` (feat)
3. **Task 2 RED: unlock-month tests** - `a0f7055` (test)
4. **Task 2 GREEN: Add unlock-month endpoint** - `e6a35bd` (feat)
5. **Task 3: Grace period + earlyClose** - `14f6d7e` (feat)

## Files Created/Modified

- `apps/api/src/routes/time-entries.ts` - Lock check inserted after duplicate-entry check, before overlap check; uses monthRangeUtc + saldoSnapshot.findUnique composite key
- `apps/api/src/routes/overtime.ts` - Added unlock-month endpoint; added earlyClose/gracePeriodEnds to close-month response; imported updateOvertimeAccount
- `apps/api/src/plugins/auto-close-month.ts` - Replaced `dayOfMonth > 10` guard with `dayOfMonth < DEFAULT_CLOSE_AFTER_DAY` (15)
- `apps/api/src/routes/__tests__/time-entries-validation.test.ts` - Added 3 tests for SaldoSnapshot lock isolation
- `apps/api/src/routes/__tests__/saldo-snapshot.test.ts` - Created: 4 tests for unlock-month (role, 404, tenant isolation, atomic unlock)

## Decisions Made

- **findUnique over findFirst for lock check:** The composite key `employeeId_periodType_periodStart` ensures an exact match with how close-month creates snapshots. Using findFirst with a date range would require timezone-safe range calculations and could theoretically miss edge cases. findUnique is authoritative.
- **Test timestamps use Berlin UTC offsets:** `monthRangeUtc` returns timezone-aware UTC timestamps (e.g. Jan 1 Berlin = Dec 31 23:00 UTC). Tests must create snapshots with matching timestamps for the composite key lookup to succeed.
- **DEFAULT_CLOSE_AFTER_DAY hardcoded at 15:** TenantConfig schema change was intentionally deferred (per plan note: "TenantConfig.closeAfterDay is not yet in the schema"). Constant is ready for future migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test snapshot timestamps for Europe/Berlin UTC offset**
- **Found during:** Task 1 (GREEN phase — test was still failing after implementation)
- **Issue:** Test created SaldoSnapshot with `new Date("2024-03-01T00:00:00Z")` (pure UTC) but `monthRangeUtc` for Europe/Berlin returns `2024-02-29T23:00:00Z` (UTC+1 offset). The composite key lookup failed because timestamps didn't match.
- **Fix:** Updated test timestamps to use correct Berlin-offset UTC values (`2024-02-29T23:00:00Z` for March start, `2023-12-31T23:00:00Z` for January start)
- **Files modified:** `apps/api/src/routes/__tests__/time-entries-validation.test.ts`, `apps/api/src/routes/__tests__/saldo-snapshot.test.ts`
- **Verification:** Tests pass with correct 403/200 responses
- **Committed in:** `325b306` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary for test correctness. No scope change. Implementation code unchanged.

## Issues Encountered

- Worktree had staged changes from another agent's commit (`93e4f3c`) after `git reset --soft`. Resolved by unstaging all files not belonging to this plan and restoring them to HEAD state.
- Three pre-existing test failures exist in the suite (clock-in conflict tests + overtime-calc test). These are NOT introduced by this plan and were confirmed pre-existing.

## Threat Surface Scan

All mitigations from the plan's threat model implemented:
- T-12-01: `requireRole("ADMIN", "MANAGER")` blocks EMPLOYEE on unlock-month
- T-12-02: Tenant isolation via `employee.tenantId !== req.user.tenantId` returns 404
- T-12-03: Lock check uses SaldoSnapshot composite unique key (atomic, race-safe)
- T-12-04: Delete snapshot + updateMany inside `$transaction` (partial unlock impossible)
- T-12-05: Cross-tenant response is 404 (not 403) — avoids confirming employee exists in another tenant
- T-12-06: `app.audit(UNLOCK, oldValue=snap)` logged after transaction

No new threat surface introduced beyond what was planned.

## Known Stubs

None - all features fully wired.

## Self-Check: PASSED

- [x] `apps/api/src/routes/time-entries.ts` exists and contains lock check
- [x] `apps/api/src/routes/overtime.ts` contains unlock-month endpoint
- [x] `apps/api/src/plugins/auto-close-month.ts` contains DEFAULT_CLOSE_AFTER_DAY = 15
- [x] `apps/api/src/routes/__tests__/saldo-snapshot.test.ts` created
- [x] Commits bee628a, 325b306, a0f7055, e6a35bd, 14f6d7e all exist on worktree-agent-a7442c24

## Next Phase Readiness

- Plan 12-02 (UI indicators) can now consume `isLocked` from entries and call `POST /overtime/unlock-month`
- Plan 12-03 (if applicable) can rely on `earlyClose` response from manual close-month
- The unlock → correct → re-close correction pattern is now fully supported on the API side

---
*Phase: 12-monatsabschluss-lock-enforcement*
*Completed: 2026-04-13*
