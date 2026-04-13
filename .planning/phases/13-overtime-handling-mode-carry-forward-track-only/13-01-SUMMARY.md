---
phase: 13-overtime-handling-mode-carry-forward-track-only
plan: 01
subsystem: api/db
tags: [schema, prisma, settings, overtime]
dependency_graph:
  requires: []
  provides: [WorkSchedule.overtimeMode, PUT /settings/work accepts overtimeMode]
  affects: [apps/api/src/routes/time-entries.ts, apps/api/src/routes/settings.ts, packages/db/prisma/schema.prisma]
tech_stack:
  added: []
  patterns: [Prisma String field with @default, z.enum validation]
key_files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - apps/api/src/routes/settings.ts
    - apps/api/src/routes/time-entries.ts
decisions:
  - "Used String (not Prisma enum) for overtimeMode per plan D-02 to avoid schema migration complexity"
  - "Used z.enum on API layer for strict validation of CARRY_FORWARD | TRACK_ONLY (Threat T-13-01)"
  - "GET /work/:employeeId returns overtimeMode automatically — handler returns full Prisma object"
metrics:
  duration: "15 minutes"
  completed: "2026-04-13"
  tasks: 2
  files_changed: 3
---

# Phase 13 Plan 01: overtimeMode Schema + Settings API Summary

**One-liner:** Added `overtimeMode String @default("CARRY_FORWARD")` to WorkSchedule model and wired it through the settings API with z.enum validation and Prisma persistence.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add overtimeMode to WorkSchedule schema, push DB, regenerate client, add fallback | 553668a | schema.prisma, time-entries.ts |
| 2 | Add overtimeMode to employeeScheduleSchema Zod + scheduleData PUT handler | 1c9d21f | settings.ts |

## What Was Built

- `WorkSchedule` Prisma model has new `overtimeMode String @default("CARRY_FORWARD")` field
- Database column `overtimeMode text NOT NULL DEFAULT 'CARRY_FORWARD'::text` applied via `prisma db push`
- Prisma client regenerated with the new field
- `getEffectiveSchedule` fallback return includes `overtimeMode: "CARRY_FORWARD" as const`
- `employeeScheduleSchema` Zod schema includes `overtimeMode: z.enum(["CARRY_FORWARD", "TRACK_ONLY"]).default("CARRY_FORWARD")`
- `scheduleData` mapping in PUT `/work/:employeeId` handler includes `overtimeMode: body.overtimeMode`
- GET `/work/:employeeId` automatically returns `overtimeMode` (returns full Prisma object)

## Threat Mitigations Applied

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-13-01 | z.enum(["CARRY_FORWARD", "TRACK_ONLY"]) in employeeScheduleSchema rejects invalid values | Applied |
| T-13-02 | Existing requireRole("ADMIN", "MANAGER") preHandler guards PUT route | Pre-existing |
| T-13-03 | overtimeMode is non-sensitive config; existing role guard sufficient | Accepted |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The field is fully wired from DB → Prisma client → API validation → persistence. Downstream plans (02: saldo bifurcation, 03: UI selector) will consume this field.

## Self-Check: PASSED

- [x] `grep "overtimeMode" packages/db/prisma/schema.prisma` → line 265: `overtimeMode String @default("CARRY_FORWARD")`
- [x] `grep "overtimeMode" apps/api/src/routes/settings.ts` → 2 lines: Zod schema (89) + scheduleData (299)
- [x] `grep "overtimeMode" apps/api/src/routes/time-entries.ts` → line 1440: fallback `overtimeMode: "CARRY_FORWARD" as const`
- [x] Database column: `overtimeMode | text | 'CARRY_FORWARD'::text` (verified via psql)
- [x] Commit 553668a exists
- [x] Commit 1c9d21f exists
