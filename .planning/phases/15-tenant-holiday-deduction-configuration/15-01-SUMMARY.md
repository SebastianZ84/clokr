---
phase: 15-tenant-holiday-deduction-configuration
plan: "01"
subsystem: api
tags: [tenant-config, settings, schema, prisma, integration-test]
requirements: [TENANT-01]

dependency_graph:
  requires: []
  provides:
    - monthlyHoursHolidayDeduction column in TenantConfig (DB + Prisma client)
    - PUT /settings/work accepts and persists monthlyHoursHolidayDeduction boolean
    - GET /settings/work returns monthlyHoursHolidayDeduction (false by default)
  affects:
    - packages/db/prisma/schema.prisma
    - apps/api/src/routes/settings.ts
    - apps/api/src/routes/__tests__/minijob.test.ts

tech_stack:
  added: []
  patterns:
    - Boolean Prisma field with @default(false) — zero-migration approach for existing tenants
    - Zod z.boolean().optional() for optional boolean toggle in API body
    - GET base defaults object provides false when no TenantConfig row exists

key_files:
  created:
    - .planning/phases/15-tenant-holiday-deduction-configuration/15-01-SUMMARY.md
  modified:
    - packages/db/prisma/schema.prisma
    - apps/api/src/routes/settings.ts
    - apps/api/src/routes/__tests__/minijob.test.ts

decisions:
  - "Added monthlyHoursHolidayDeduction before datevNormalstundenNr block for logical grouping with MONTHLY_HOURS comment"
  - "PUT handler auto-propagates new field via existing configBody spread — no handler changes needed"
  - "GET base defaults return false when no TenantConfig row exists, consistent with @default(false)"
  - "prisma db push with --accept-data-loss safely adds NOT NULL column with default false"

metrics:
  duration_minutes: 7
  completed_date: "2026-04-13"
  tasks_completed: 3
  files_modified: 3
---

# Phase 15 Plan 01: Tenant Holiday Deduction Config — Schema + API Summary

**One-liner:** Added `monthlyHoursHolidayDeduction Boolean @default(false)` to TenantConfig with Zod validation in settings API and roundtrip integration tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add schema field + Zod schema + GET default | 8c5a90f | packages/db/prisma/schema.prisma, apps/api/src/routes/settings.ts |
| 2 | Prisma db push + generate | (DB-level, no tracked files) | DB column created, Prisma client regenerated, Docker rebuilt |
| 3 | Integration test — toggle persistence via PUT /settings/work | fd942a8 | apps/api/src/routes/__tests__/minijob.test.ts |

## What Was Built

1. **Schema field**: `monthlyHoursHolidayDeduction Boolean @default(false)` added to TenantConfig model in `schema.prisma` before the DATEV number fields, with section comment `// MONTHLY_HOURS: Feiertage reduzieren Monatsstunden-Soll`.

2. **Zod validation**: `monthlyHoursHolidayDeduction: z.boolean().optional()` added to `tenantConfigSchema` in `settings.ts`. The existing PUT handler's `configBody` spread automatically propagates the field to Prisma upsert — no handler changes required.

3. **GET default**: `monthlyHoursHolidayDeduction: false` added to the `base` fallback object in GET /work handler, ensuring tenants without a config row receive the correct default.

4. **DB push**: Column added to live PostgreSQL via `prisma db push --accept-data-loss`. Column is `boolean NOT NULL DEFAULT false` — all existing tenants default to disabled.

5. **Prisma client**: Regenerated with `prisma generate` to include the new field in TypeScript types.

6. **Docker rebuild**: Containers rebuilt with `docker compose up --build -d` to include updated schema and routes.

7. **Integration tests**: 4 new test cases in `describe("TENANT-01: Holiday deduction toggle")` block in `minijob.test.ts`:
   - GET returns false by default (no prior PUT)
   - PUT with true returns 200 and persists
   - GET confirms true after PUT
   - PUT with false reverts, GET confirms false
   - All 14 minijob tests pass (10 existing + 4 new)

## Decisions Made

- **PUT handler unchanged**: The existing spread `{ ...configBody }` in the Prisma upsert automatically includes `monthlyHoursHolidayDeduction` when present in the Zod-parsed body. The existing `app.audit()` call at lines 239-244 logs `newValue` which includes the field.
- **Ordering in schema**: Placed before DATEV block with a `// MONTHLY_HOURS` section comment for discoverability alongside related MONTHLY_HOURS configuration.
- **Test cleanup**: Last test case reverts toggle to false, leaving state clean for subsequent test runs.

## Deviations from Plan

None — plan executed exactly as written.

Task 2 ("Prisma db push + generate") produced no tracked file changes (generated client is gitignored, DB changes are DB-level). The task was executed successfully — confirmed by:
- `prisma db push` output: "Your database is now in sync with your Prisma schema"
- Column confirmed in DB: `SELECT monthlyHoursHolidayDeduction FROM "TenantConfig"` returns `boolean NOT NULL DEFAULT false`
- Prisma client confirmed: `grep monthlyHoursHolidayDeduction packages/db/generated/client/index.js` returns match
- Docker containers rebuilt and healthy

## Known Stubs

None — all data is wired. The GET endpoint returns the persisted value from DB (or `false` as default). No placeholder data.

## Threat Flags

No new security surface introduced. The existing `requireRole("ADMIN")` preHandler on PUT /settings/work (line 160 of settings.ts) controls who can toggle the flag. The Zod `z.boolean().optional()` validation rejects non-boolean input. The existing audit call logs changes automatically.

## Self-Check: PASSED

- [x] `packages/db/prisma/schema.prisma` contains `monthlyHoursHolidayDeduction Boolean @default(false)` (line 140)
- [x] `apps/api/src/routes/settings.ts` contains `monthlyHoursHolidayDeduction: z.boolean().optional()` (line 68) and `monthlyHoursHolidayDeduction: false` default (line 153)
- [x] `apps/api/src/routes/__tests__/minijob.test.ts` contains `describe("TENANT-01: Holiday deduction toggle"` with 4 test cases
- [x] Commit 8c5a90f exists: feat(15-01) schema and settings changes
- [x] Commit fd942a8 exists: test(15-01) integration tests
- [x] DB column exists: `monthlyHoursHolidayDeduction | boolean | not null | false`
- [x] All 14 minijob tests pass
