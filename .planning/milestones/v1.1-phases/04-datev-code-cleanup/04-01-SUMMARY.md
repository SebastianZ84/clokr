---
phase: 4
plan: 1
title: "Extract duplicate schedule helpers to module scope"
subsystem: api/reports
tags: [refactor, typescript, reports, helpers]
requirements: [DATEV-04]
dependency_graph:
  requires: []
  provides: [module-scope-schedule-helpers]
  affects: [apps/api/src/routes/reports.ts]
tech_stack:
  added: []
  patterns: [module-scope helper extraction, explicit parameter passing]
key_files:
  modified:
    - apps/api/src/routes/reports.ts
decisions:
  - "Used structural WorkScheduleItem type alias to avoid Prisma type import complexity (per D-14, D-15)"
  - "Explicit start/end/tz parameters replace closure captures (per D-15)"
  - "No export keyword on helpers — remain module-private (per threat model)"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-11"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 4 Plan 1: Extract duplicate schedule helpers to module scope — Summary

## One-liner

Lifted `getScheduleForDate`, `calcShouldMinutes`, and `absenceMinutes` from nested handler scope to module scope in `reports.ts`, deleting all three `*Pdf` variants and updating both `/monthly` and `/monthly/pdf` call sites to pass explicit `start`, `end`, `tz` parameters.

## What Was Built

The three helper functions that were duplicated inside the `/monthly` handler (lines 64–120) and inside the `/monthly/pdf` handler (lines 478–523, with `Pdf` suffixes) are now defined exactly once at module scope, above `export async function reportRoutes`.

**New module-scope additions:**
- `type WorkScheduleItem` — structural type alias covering both handler's Prisma-generated schedule types
- `function getScheduleForDate(schedules, date)` — picks the schedule valid on a given date
- `function calcShouldMinutes(schedules, hireDate, start, end, tz)` — calculates target minutes for the month
- `function absenceMinutes(schedules, absStart, absEnd, start, end, tz)` — calculates absence minutes

**Deleted:**
- `getScheduleForDatePdf`, `calcShouldMinutesPdf`, `absenceMinutesPdf` (the `*Pdf` nested variants)
- `type ScheduleList = NonNullable<typeof emp>["workSchedules"]` (nested type alias in pdf handler)

**Call site updates:**
- `/monthly` handler: `calcShouldMinutes(emp.workSchedules, emp.hireDate ?? undefined, start, end, tz)` and `absenceMinutes(..., start, end, tz)`
- `/monthly/pdf` handler: same pattern with identical signatures

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 7e5851e | refactor | extract schedule helpers to module scope in reports.ts |

## Task Results

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 4-1-1 | Extract getScheduleForDate, calcShouldMinutes, absenceMinutes to module scope | DONE | 7e5851e |

## Verification Results

### Automated Checks

- `grep -c "getScheduleForDatePdf|calcShouldMinutesPdf|absenceMinutesPdf|isMonthlyHoursPdf|latestSchedulePdf" reports.ts` → **0** (all *Pdf identifiers eliminated)
- `grep -c "^function getScheduleForDate("` → **1** (exactly one at module scope)
- `grep -c "^function calcShouldMinutes("` → **1** (exactly one at module scope)
- `grep -c "^function absenceMinutes("` → **1** (exactly one at module scope)
- `pnpm --filter @clokr/api exec tsc --noEmit` → **exit 0** (TypeScript compiles cleanly)
- `pnpm --filter @clokr/api test --run` → **291 passed / 2 pre-existing failures** (time-entries-validation.test.ts clock-in conflict tests — unrelated to reports, fail identically on the base commit)

### Manual Verification

The `reports.ts` file was inspected: the three helpers appear at module scope between imports and `export async function reportRoutes`. Both handler call sites use the module-scope versions with the `start, end, tz` explicit parameters. No `export` keyword precedes any helper.

## Deviations from Plan

None — plan executed exactly as written. The `*Pdf` variants were deleted, module-scope helpers added with the exact signatures specified in D-15, and both call site sets updated correctly.

## Known Stubs

None — this is a pure refactor with no data flow changes.

## Threat Flags

No new attack surface introduced. This is a pure internal TypeScript refactor. Routes retain their existing `preHandler: requireRole("ADMIN", "MANAGER")` on `/monthly` and `requireRole("ADMIN")` on `/monthly/pdf`. The extracted helpers are module-private (no `export` keyword).

## Self-Check: PASSED

- File exists: `/Users/sebastianzabel/git/clokr/apps/api/src/routes/reports.ts` — FOUND
- Commit 7e5851e exists — FOUND (verified via git log)
- Zero *Pdf identifiers remain — VERIFIED
- Exactly 3 module-scope function declarations — VERIFIED
- TypeScript compile clean — VERIFIED
