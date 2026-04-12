---
phase: 04-datev-code-cleanup
plan: 02
subsystem: api, database
tags: [prisma, postgres, zod, datev, tenant-config, settings]
requires:
  - phase: 04-datev-code-cleanup
    provides: DATEV context (D-08 decisions, Lohnartennummern field names and defaults)
provides:
  - 4 new Int columns (datevNormalstundenNr, datevUrlaubNr, datevKrankNr, datevSonderurlaubNr) in TenantConfig
  - Prisma client regenerated with 4 new TenantConfig fields
  - Database schema pushed with 4 new columns (defaults 100/300/200/302)
  - tenantConfigSchema extended with 4 optional DATEV Int fields (min 1, max 9999)
  - GET /settings/work returns DATEV fields (stored value or default)
  - PUT /settings/work accepts and persists DATEV fields via existing spread pattern
affects: [04-03-plan, 04-04-plan, reports-datev, admin-system-ui]
tech-stack:
  added: []
  patterns:
    - Additive TenantConfig schema extension pattern (non-nullable Int with @default)
    - Zod optional Int field extension pattern (z.number().int().min().max().optional())
key-files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - apps/api/src/routes/settings.ts
key-decisions:
  - "4 DATEV fields are non-nullable Int with @default values so existing rows remain valid after db push"
  - "Fields added as .optional() in Zod schema for backward compatibility"
  - "No new routes created -- PUT /settings/work already propagates new fields via ...configBody spread"
  - "Prisma client regenerated via temporary schema copy to main repo packages/db then restored"
patterns-established:
  - "TenantConfig extension -- add non-nullable Int @default fields, extend tenantConfigSchema with .optional(), add defaults to GET /work base"
requirements-completed: [DATEV-03]
duration: 25min
completed: 2026-04-11
---

# Phase 4 Plan 2: Add DATEV Lohnarten fields to TenantConfig schema and settings API Summary

**4 configurable DATEV Lohnartennummern (Normalstunden/Urlaub/Krank/Sonderurlaub) added to TenantConfig Prisma model and exposed via existing PUT/GET /settings/work endpoints with defaults 100/300/200/302**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-11T18:18:00Z
- **Completed:** 2026-04-11T18:43:00Z
- **Tasks:** 3 (Task 2 had no file commit -- DB push + generate are state-only)
- **Files modified:** 2

## Accomplishments

- Added 4 non-nullable Int fields to the TenantConfig Prisma model with required defaults (D-08)
- Pushed schema changes to development PostgreSQL -- all 4 columns now exist in TenantConfig table
- Regenerated Prisma client with new fields; TypeScript type-checks pass
- Extended tenantConfigSchema with z.number().int().min(1).max(9999).optional() for all 4 DATEV fields
- Extended GET /work fallback defaults so tenants without saved config receive correct DATEV defaults
- Verified PUT /work handler requires no changes -- existing ...configBody spread already propagates new fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 4 DATEV Int fields to TenantConfig Prisma model** - 14e8a3a (feat)
2. **Task 2: Push schema to DB and regenerate Prisma client** - no commit (DB state + generated client are gitignored)
3. **Task 3: Extend tenantConfigSchema and GET /work defaults** - 11f6ca9 (feat)

## Files Created/Modified

- packages/db/prisma/schema.prisma - Added 4 DATEV Int fields after dataRetentionYears, before createdAt
- apps/api/src/routes/settings.ts - Extended tenantConfigSchema (lines 63-66) and GET /work base defaults (lines 151-154)

## Decisions and Deviations

**Key decisions:**
- No new routes created; the existing PUT /settings/work canonical pattern handles new fields automatically.
- Fields are .optional() in Zod so existing API callers not sending DATEV fields leave stored values unchanged.
- Worktree shares main repo node_modules -- prisma generate required temporarily copying worktree schema to main repo.

**Deviations from plan:** None - plan executed exactly as written.

## Issues Encountered

- **Worktree node_modules:** git worktree does not have own node_modules. Prisma generate required using main repo prisma binary with worktree schema path. Had to temporarily copy schema for generation to work.
- **Pre-existing test failures:** time-entries-validation.test.ts has 2 failing tests (clock-in conflict checks) unrelated to this plan. All other 24 test files pass. Out-of-scope per deviation rules.

## Known Stubs

None - all 4 DATEV fields are fully wired to the database with proper defaults.

## Threat Flags

None -- the 4 new fields are non-sensitive small integers (Lohnartennummern 1-9999). The existing requireRole ADMIN gate on PUT /settings/work provides sufficient access control.

## Self-Check: PASSED

Files confirmed:
- packages/db/prisma/schema.prisma -- 4 DATEV fields present (grep count = 4)
- apps/api/src/routes/settings.ts -- 8 DATEV references (4 schema + 4 defaults)

Commits confirmed:
- 14e8a3a -- feat(04-02): add 4 DATEV Lohnartennummern fields to TenantConfig schema
- 11f6ca9 -- feat(04-02): extend tenantConfigSchema and GET /work defaults with DATEV fields

## Next Phase Readiness

- Plan 3 (reports.ts DATEV export) can now read TenantConfig DATEV fields via app.prisma.tenantConfig.findUnique
- Plan 4 (admin UI) can bind to GET /settings/work for current values and PUT /settings/work for saving
- TypeScript types are available through the regenerated Prisma client

---
*Phase: 04-datev-code-cleanup*
*Completed: 2026-04-11*
