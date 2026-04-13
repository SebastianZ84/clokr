---
phase: 15-tenant-holiday-deduction-configuration
plan: "02"
subsystem: api
tags: [overtime, saldo, monthly-hours, holiday-deduction, tenant-config, integration-test]
requirements: [TENANT-01]

dependency_graph:
  requires:
    - phase: 15-01
      provides: monthlyHoursHolidayDeduction column in TenantConfig (DB + Prisma client)
  provides:
    - All 4 backend saldo computation sites apply dailySoll-based holiday deduction for MONTHLY_HOURS when toggle ON
    - Toggle OFF preserves pre-Phase-15 behavior (no MONTHLY_HOURS-specific deduction)
    - recalculate-snapshots.ts now merges computed getHolidays() with DB holidays (bugfix)
    - Pure tracking (monthlyHours=null) does not crash with toggle ON
    - Integration tests prove toggle on/off/pure-tracking behavior
  affects:
    - apps/api/src/routes/time-entries.ts
    - apps/api/src/routes/overtime.ts
    - apps/api/src/plugins/auto-close-month.ts
    - apps/api/src/utils/recalculate-snapshots.ts
    - apps/api/src/routes/__tests__/minijob.test.ts

tech_stack:
  added: []
  patterns:
    - isMonthlyHoursDeduction guard: checks schedule.type, monthlyHours > 0, and tenantConfig toggle before applying dailySoll formula
    - dailySollMin = (monthlyHours * 60) / workingDaysInRange — used instead of getDayHoursFromSchedule * 60 for MONTHLY_HOURS
    - workingDaysInRange loop: iterates effectiveStart to monthEnd, counting days with getDayHoursFromSchedule > 0
    - Consistent pattern across all 4 sites — same guard block, same formula, different variable names only

key_files:
  created:
    - .planning/phases/15-tenant-holiday-deduction-configuration/15-02-SUMMARY.md
    - .planning/phases/15-tenant-holiday-deduction-configuration/deferred-items.md
  modified:
    - apps/api/src/routes/time-entries.ts
    - apps/api/src/routes/overtime.ts
    - apps/api/src/plugins/auto-close-month.ts
    - apps/api/src/utils/recalculate-snapshots.ts
    - apps/api/src/routes/__tests__/minijob.test.ts

key_decisions:
  - "Guard pattern uses String(schedule.type ?? '') comparison to safely handle null/undefined schedule type"
  - "workingDaysInRange iterates from effectiveStart (post hire-date clamping) to avoid over-counting for new employees"
  - "Division-by-zero guarded by workingDaysInRange > 0 AND Number(schedule.monthlyHours ?? 0) > 0 (T-15-05)"
  - "auto-close-month.ts uses tenant.config?.monthlyHoursHolidayDeduction directly — no extra DB fetch needed"
  - "recalculate-snapshots.ts bugfix: was DB-only for holidays; now merges computed getHolidays() + DB deduplicated by date string"
  - "Test uses DB-stored public holiday on April 6, 2026 (Monday) to isolate from computed national holidays"
  - "Pre-existing test failures in overtime-calc.test.ts and time-entries-validation.test.ts (3 tests) are unrelated to Phase 15"

patterns_established:
  - "MONTHLY_HOURS deduction guard: identical 4-line isMonthlyHoursDeduction block before any holidayMinutes reduce"
  - "dailySollMin formula: always recompute workingDaysInRange per computation window (effectiveStart to monthEnd)"

requirements_completed: [TENANT-01]

duration: 10min
completed: "2026-04-13"
---

# Phase 15 Plan 02: Backend Saldo Computation Sites — Holiday Deduction Guard Summary

**Toggle-guarded dailySoll holiday deduction applied symmetrically across all 4 saldo computation sites (updateOvertimeAccount, close-month, auto-close, recalculate-snapshots), plus computed-holiday merge bugfix in recalculate-snapshots**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-13T21:26:00Z
- **Completed:** 2026-04-13T21:36:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- All 4 backend computation sites read `tenantConfig.monthlyHoursHolidayDeduction` and apply the `dailySollMin` formula for qualifying MONTHLY_HOURS holidays when toggle is ON
- Preserved toggle-OFF behavior exactly: no deduction via dailySoll; FIXED_WEEKLY holiday deduction unaffected
- Fixed a pre-existing bug in `recalculate-snapshots.ts`: was only reading DB-stored holidays, missing computed national holidays from `getHolidays()` — now merges both with deduplication
- 3 new integration tests prove toggle on/off/pure-tracking behavior; all 17 minijob tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Update all 4 backend computation sites** - `4f2698f` (feat)
2. **Task 2: Integration tests** - `efccfa5` (test)

## Files Created/Modified

- `apps/api/src/routes/time-entries.ts` — Added tenantConfig fetch + isMonthlyHoursDeduction guard in updateOvertimeAccount
- `apps/api/src/routes/overtime.ts` — Added tenantConfig fetch + isMonthlyHoursDeduction guard in close-month handler
- `apps/api/src/plugins/auto-close-month.ts` — Added isMonthlyHoursDeduction guard using tenant.config (already available)
- `apps/api/src/utils/recalculate-snapshots.ts` — Added getHolidays import, computed holiday merge, tenantConfig fetch, isMonthlyHoursDeduction guard
- `apps/api/src/routes/__tests__/minijob.test.ts` — New describe block with 3 tests: toggle on/off comparison, pure tracking safety

## Decisions Made

- **Guard uses `String(schedule.type ?? '') === "MONTHLY_HOURS"` pattern** — consistent with existing TRACK_ONLY guards throughout the codebase, safely handles null/undefined schedule type
- **workingDaysInRange uses effectiveStart, not monthStart** — aligns with Pitfall 3 from RESEARCH: avoids over-counting for employees hired mid-month
- **auto-close-month.ts: no extra DB fetch** — `tenant.config` is already available via `include: { config: true }` at line 46, so the guard uses `tenant.config?.monthlyHoursHolidayDeduction` directly
- **Test seeded holiday on April 6, 2026 (Monday)** — falls within the current month's computation window (April 2026); uses DB `publicHoliday.create` to isolate from computed national holidays; includes required `federalState` and `year` fields per schema
- **Pre-existing test failures documented as deferred** — 3 tests in `overtime-calc.test.ts` and `time-entries-validation.test.ts` were failing before Phase 15 work; confirmed by stash + full test run; out of scope

## Deviations from Plan

None — plan executed exactly as written. The `publicHoliday.create` call needed `federalState` and `year` fields (required by schema), which was not in the plan's test code snippet — this was a minor adaptation during GREEN phase, not a deviation from intent.

## Known Stubs

None — all computation is fully wired to the DB `monthlyHoursHolidayDeduction` flag. No placeholder values.

## Threat Flags

No new security surface introduced. All 4 sites fetch tenantConfig by `employee.tenantId` — same tenant isolation as existing queries (T-15-04 mitigated). Division-by-zero guard applied at all sites via `workingDaysInRange > 0` (T-15-05 mitigated).

## Issues Encountered

One minor issue during Task 2 (test writing): the `publicHoliday.create` call in the plan's pseudocode was missing required schema fields (`federalState: "NIEDERSACHSEN"`, `year: 2026`). The test failed on first run with a Prisma validation error, fixed by adding the required fields. Not a code deviation — the plan's pseudocode was illustrative.

## Next Phase Readiness

- Phase 15-03 can proceed: the UI settings toggle (Plan 01) and all 4 backend computation sites (Plan 02) are fully wired
- Phase 15-03 is the calendar UI showing per-day holiday deduction visual indicator for MONTHLY_HOURS employees

---
*Phase: 15-tenant-holiday-deduction-configuration*
*Completed: 2026-04-13*

## Self-Check: PASSED

- [x] `apps/api/src/routes/time-entries.ts` contains `isMonthlyHoursDeduction` (4 occurrences) and `app.prisma.tenantConfig.findUnique` in updateOvertimeAccount
- [x] `apps/api/src/routes/overtime.ts` contains `isMonthlyHoursDeduction` (4 occurrences) and `app.prisma.tenantConfig.findUnique` in close-month handler
- [x] `apps/api/src/plugins/auto-close-month.ts` contains `isMonthlyHoursDeduction` (4 occurrences) and `tenant.config?.monthlyHoursHolidayDeduction`
- [x] `apps/api/src/utils/recalculate-snapshots.ts` contains `isMonthlyHoursDeduction` (4 occurrences), imports `getHolidays`, contains `computedHolidays` merge, and `app.prisma.tenantConfig.findUnique`
- [x] `apps/api/src/routes/__tests__/minijob.test.ts` contains `describe("TENANT-01: Holiday deduction in saldo computation"` with 3 test cases
- [x] `pnpm --filter @clokr/api test --run minijob` — all 17 tests pass
- [x] Commit 4f2698f exists: feat(15-02) backend computation sites
- [x] Commit efccfa5 exists: test(15-02) integration tests
- [x] TypeScript compilation clean (tsc --noEmit exits 0)
