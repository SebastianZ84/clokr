---
phase: 15-tenant-holiday-deduction-configuration
plan: "03"
subsystem: web
tags: [tenant-config, monthly-hours, holiday-deduction, svelte, admin-ui, calendar]
requirements: [TENANT-01]

dependency_graph:
  requires:
    - phase: 15-01
      provides: monthlyHoursHolidayDeduction column in TenantConfig (DB + Prisma client)
    - phase: 15-02
      provides: All 4 backend computation sites apply holiday deduction when toggle ON
  provides:
    - Admin toggle for monthlyHoursHolidayDeduction in system settings under "Arbeitszeit" section
    - Calendar Soll for MONTHLY_HOURS subtracts qualifying holidays from denominator when toggle ON
    - countWorkingDaysInMonth extended with optional excludeHolidayDates parameter
  affects:
    - apps/web/src/routes/(app)/admin/system/+page.svelte
    - apps/web/src/routes/(app)/time-entries/+page.svelte

tech_stack:
  added: []
  patterns:
    - Toggle pattern: existing .toggle-row / .switch / .switch-slider CSS classes
    - saveHolidayDeduction uses PUT /settings/work with _gOtherFields spread (same pattern as saveDatev)
    - monthlyHoursHolidayDeduction loaded in onMount same as DATEV fields
    - qualifyingHolidayDates: filter hols Map keys by isConfiguredWorkday before passing to countWorkingDaysInMonth
    - excludeSet (Set<string>) for O(1) holiday date lookup in countWorkingDaysInMonth loop

key_files:
  created:
    - .planning/phases/15-tenant-holiday-deduction-configuration/15-03-SUMMARY.md
  modified:
    - apps/web/src/routes/(app)/admin/system/+page.svelte
    - apps/web/src/routes/(app)/time-entries/+page.svelte

key_decisions:
  - "saveHolidayDeduction uses _gOtherFields guard (same as saveDatev) to prevent partial work-settings overwrite"
  - "Arbeitszeit section placed after Region & Zeitzone — thematically grouped since Bundesland drives holiday sets"
  - "qualifyingHolidayDates computed as closure variable in buildCalendarDays — matches how arbzgEnabled is accessed"
  - "excludeSet uses Set<string> for O(1) lookup — cleaner than repeated array.includes() in loop"
  - "makeCalDay unchanged (D-04): holiday cells render expectedMin=0 independently; only denominator changes"

decisions:
  - "saveHolidayDeduction uses _gOtherFields guard to prevent partial work-settings overwrite — same pattern as saveDatev"
  - "Arbeitszeit section placed after Region & Zeitzone for thematic grouping (Bundesland drives holiday sets)"

metrics:
  duration_minutes: 15
  completed_date: "2026-04-13"
  tasks_completed: 3
  files_modified: 2
---

# Phase 15 Plan 03: Frontend Toggle + Calendar Soll Holiday Deduction Summary

**One-liner:** Admin toggle for monthlyHoursHolidayDeduction added to system settings "Arbeitszeit" section, and calendar Soll denominator now subtracts qualifying holidays when toggle is enabled for MONTHLY_HOURS employees.

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-13
- **Tasks:** 3
- **Files modified:** 2

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Calendar Soll holiday denominator exclusion | 5a4bb5f | apps/web/src/routes/(app)/time-entries/+page.svelte |
| 2 | Admin toggle in system settings | 391ecb3 | apps/web/src/routes/(app)/admin/system/+page.svelte |
| 3 | Docker build verification (auto-approved) | — | Docker rebuild: clokr-api + clokr-web built and started |

## What Was Built

### Task 1: time-entries/+page.svelte

1. **State variable**: `let monthlyHoursHolidayDeduction = $state(false)` added alongside `arbzgEnabled`.

2. **Config fetch type extended**: `api.get<{ arbzgEnabled?: boolean; defaultBreakStart?: string | null; monthlyHoursHolidayDeduction?: boolean }>("/settings/work")` — includes new field.

3. **Config assignment**: `monthlyHoursHolidayDeduction = rawConfig?.monthlyHoursHolidayDeduction === true;` after existing `defaultBreakStart` assignment in `loadAll()`.

4. **`countWorkingDaysInMonth` extended**: Added optional third parameter `excludeHolidayDates?: string[]`. Uses `Set<string>` for O(1) lookup. Loop condition now also checks `!excludeSet.has(format(cur, "yyyy-MM-dd"))`.

5. **`buildCalendarDays` denominator logic**: When `monthlyHoursHolidayDeduction` is true, computes `qualifyingHolidayDates` by filtering `hols.keys()` through `isConfiguredWorkday(sched, d)`. Passes the array to `countWorkingDaysInMonth` as the third argument.

6. **`makeCalDay` unchanged**: Per D-04, holiday cells already render `expectedMin = 0` via existing logic. Only the denominator needed to change.

### Task 2: admin/system/+page.svelte

1. **TenantConfig interface extended**: `monthlyHoursHolidayDeduction?: boolean` added with comment `// MONTHLY_HOURS: Feiertage reduzieren Monatsstunden-Soll (Phase 15)`.

2. **State variables**: `let monthlyHoursHolidayDeduction = $state(false)` and `let holidayDeductionSaving = $state(false)` added after DATEV state variables.

3. **onMount loading**: `monthlyHoursHolidayDeduction = cfg.monthlyHoursHolidayDeduction ?? false;` after DATEV field assignments.

4. **`saveHolidayDeduction()` function**: Follows the same pattern as `saveDatev()` — guards on `_gOtherFields`, sends full `PUT /settings/work` with `_gOtherFields` spread plus new field, optimistically updates state on success.

5. **"Arbeitszeit" section in template**: Added after "Region & Zeitzone" section with `<hr class="sys-divider" />` separator. Uses `.toggle-row`, `.toggle-info`, `.switch`, `.switch-slider` classes (already defined). German label: "Feiertage kürzen Monatsstunden-Soll". Helper text explains the formula.

### Task 3: Docker Build (Auto-approved)

- Both `clokr-api` and `clokr-web` images built successfully.
- All containers started healthy: `clokr-api-1`, `clokr-web-1`, `clokr-postgres-1`, `clokr-redis-1`, `clokr-minio-1`.

## Decisions Made

- **`saveHolidayDeduction` uses `_gOtherFields` guard**: Same pattern as `saveDatev` to prevent partial work-settings overwrite if the page hasn't fully loaded. Toggle is disabled when `_gOtherFields` is null/undefined.
- **Placement of "Arbeitszeit" section**: After "Region & Zeitzone" because Bundesland directly determines which holidays apply to the deduction calculation. Thematically coherent.
- **Closure access pattern**: `monthlyHoursHolidayDeduction` is accessed as a closure variable in `buildCalendarDays`, consistent with how `arbzgEnabled` is already used in the same file.
- **`Set<string>` for exclusion lookup**: More efficient and readable than `array.includes()` in a loop. The `format(cur, "yyyy-MM-dd")` import from date-fns was already present in the file.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired. The toggle reads from and writes to the live DB via `/settings/work`. The calendar Soll computation uses the live `hols` Map fetched from `/holidays`. No placeholder values.

## Threat Flags

No new security surface introduced. The admin system page is already behind the ADMIN role guard (route-level). The `saveHolidayDeduction` function calls `PUT /settings/work` which has `requireRole("ADMIN")` as `preHandler` (T-15-07 mitigated). The boolean toggle value returned by `GET /settings/work` is not sensitive (T-15-08 accepted per threat model).

## Self-Check: PASSED

- [x] `apps/web/src/routes/(app)/time-entries/+page.svelte` contains `let monthlyHoursHolidayDeduction = $state(false)` (line 109)
- [x] `apps/web/src/routes/(app)/time-entries/+page.svelte` contains `monthlyHoursHolidayDeduction?: boolean` in GET type (line 223)
- [x] `apps/web/src/routes/(app)/time-entries/+page.svelte` contains `excludeHolidayDates?: string[]` (line 489)
- [x] `apps/web/src/routes/(app)/time-entries/+page.svelte` contains `qualifyingHolidayDates` and `countWorkingDaysInMonth(monthStart, sched, qualifyingHolidayDates)` (lines 336-347)
- [x] `apps/web/src/routes/(app)/admin/system/+page.svelte` TenantConfig contains `monthlyHoursHolidayDeduction?: boolean` (line 29)
- [x] `apps/web/src/routes/(app)/admin/system/+page.svelte` contains `let monthlyHoursHolidayDeduction = $state(false)` (line 94)
- [x] `apps/web/src/routes/(app)/admin/system/+page.svelte` contains `let holidayDeductionSaving = $state(false)` (line 95)
- [x] `apps/web/src/routes/(app)/admin/system/+page.svelte` contains `async function saveHolidayDeduction()` (line 419)
- [x] `apps/web/src/routes/(app)/admin/system/+page.svelte` contains `<h3 class="sys-title">Arbeitszeit</h3>` (line 767)
- [x] `apps/web/src/routes/(app)/admin/system/+page.svelte` contains `aria-label="Feiertagsabzug für Monatsstunden aktivieren"` (line 779)
- [x] `apps/web/src/routes/(app)/admin/system/+page.svelte` contains `checked={monthlyHoursHolidayDeduction}` (line 780)
- [x] "Arbeitszeit" section appears after "Region & Zeitzone" (line 698 vs 765)
- [x] Commit 5a4bb5f exists: feat(15-03) time-entries calendar changes
- [x] Commit 391ecb3 exists: feat(15-03) admin system settings changes
- [x] Docker build succeeded: both clokr-api and clokr-web built and started healthy
