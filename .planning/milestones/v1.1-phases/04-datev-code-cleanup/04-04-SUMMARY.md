---
phase: 04-datev-code-cleanup
plan: "04"
subsystem: ui
tags: [svelte, admin, datev, tenant-config, settings]

# Dependency graph
requires:
  - phase: 04-datev-code-cleanup/04-02
    provides: "4 DATEV Lohnartennummern fields in TenantConfig schema + tenantConfigSchema + GET /settings/work defaults"
  - phase: 04-datev-code-cleanup/04-03
    provides: "DATEV LODAS ASCII export route reads datevNormalstundenNr/Urlaub/Krank/Sonderurlaub from TenantConfig"
provides:
  - "DATEV Export section in /admin/system with 4 number inputs for Lohnartennummern"
  - "saveDatev() function calling PUT /settings/work to persist values"
  - "TenantConfig interface extended with 4 optional DATEV fields"
  - "onMount loading of DATEV values from GET /settings/work with fallback defaults (100/300/200/302)"
affects:
  - datev-export
  - admin-ui
  - tenant-settings

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "section-label + card card-body settings-card pattern for admin settings sections"
    - "saveDatev() function mirrors saveFederalState() pattern: saving=true, try/catch, saved=true + setTimeout reset"
    - "DATEV fields loaded with nullish coalescing defaults (cfg.datevNr ?? defaultValue)"

key-files:
  created: []
  modified:
    - apps/web/src/routes/(app)/admin/system/+page.svelte

key-decisions:
  - "DATEV Export section inserted BEFORE Phorest-Integration section (per D-11 in CONTEXT.md)"
  - "saveDatev() sends only 4 DATEV fields (not _gOtherFields spread) — PUT /settings/work accepts partial updates"
  - "4 DATEV state variables use plan-specified defaults: datevNormalstundenNr=100, datevUrlaubNr=300, datevKrankNr=200, datevSonderurlaubNr=302"
  - "Used existing classes (card, form-grid, form-input, btn-primary, card-animate) — no new CSS added"
  - "All inputs use type=number min=1 max=9999 step=1 matching ASVS V5.1 client-side UX validation"

patterns-established:
  - "Pattern: Admin settings sections follow section-label + card card-body settings-card card-animate structure"
  - "Pattern: Save functions follow saving/saved/error $state trinity with setTimeout reset for saved indicator"

requirements-completed: [DATEV-03]

# Metrics
duration: 10min
completed: 2026-04-11
---

# Phase 4 Plan 4: Add DATEV Export section to Systemeinstellungen admin UI — Summary

**Admin can now configure all 4 DATEV Lohnartennummern (Normalstunden/Urlaub/Krank/Sonderurlaub) via the Systemeinstellungen page with full persistence via PUT /settings/work**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-11T17:42:59Z
- **Completed:** 2026-04-11T19:36:48Z
- **Tasks:** 1 of 2 (Task 2 is a human-verify checkpoint — not auto-executable)
- **Files modified:** 1

## Accomplishments
- Extended `TenantConfig` TypeScript interface with 4 optional DATEV fields (`datevNormalstundenNr?`, `datevUrlaubNr?`, `datevKrankNr?`, `datevSonderurlaubNr?`)
- Added 7 `$state` variables: 4 value vars (with BAfA-correct defaults 100/300/200/302) + saving/saved/error trinity
- Wired `onMount` to load 4 DATEV values from `GET /settings/work` response with nullish coalescing fallbacks
- Implemented `saveDatev()` function calling `PUT /settings/work` with exactly the 4 DATEV fields (no unrelated fields)
- Inserted a complete DATEV Export section in the HTML template BEFORE the Phorest-Integration section (line 1399 vs 1475)
- Section uses `section-label` + `card card-body settings-card card-animate` pattern — zero new CSS, zero hardcoded colors
- 4 German-labelled number inputs: Normalstunden, Urlaub, Krank / AU, Sonderurlaub with `min=1 max=9999 step=1`
- Build passes cleanly (`pnpm --filter @clokr/web build` exits 0)

## Task Commits

1. **Task 1: Add DATEV Export section with 4 number inputs + save handler** - `4fef6d3` (feat)

**Plan metadata:** (to be committed after SUMMARY creation)

## Files Created/Modified
- `apps/web/src/routes/(app)/admin/system/+page.svelte` - Extended TenantConfig interface, added 7 DATEV state vars, onMount loading, saveDatev() function, DATEV Export HTML section before Phorest-Integration

## Decisions Made
- `saveDatev()` sends only the 4 DATEV fields rather than spreading `_gOtherFields` — the `PUT /settings/work` handler has all fields `.optional()` in Zod so partial updates are safe and avoids accidental overwrites of unrelated settings
- Section positioned before Phorest-Integration per D-11 in CONTEXT.md
- Used `card-animate` class per CLAUDE.md UI Consistency Rules

## Deviations from Plan

None - plan executed exactly as written. Task 1 was already committed at HEAD (`4fef6d3`) when this executor was spawned.

## Issues Encountered

None. The implementation was already present in commit `4fef6d3` at HEAD. Verified all acceptance criteria pass, build compiles cleanly.

## Known Stubs

None — all 4 inputs are wired to real `$state` variables loaded from `GET /settings/work` and persisted via `PUT /settings/work`.

## Threat Flags

None — no new network endpoints or auth paths introduced. The DATEV Export section is a thin form over the already-authenticated `PUT /settings/work` endpoint which already has `requireRole("ADMIN")` guard.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DATEV-03 requirement fully complete: TenantConfig stores 4 Lohnartennummern (Plan 02), DATEV LODAS route uses them (Plan 03), admin can configure them via UI (Plan 04)
- Phase 04-datev-code-cleanup is complete end-to-end
- Task 2 (human-verify checkpoint) remains for manual browser verification of the full Docker stack flow

## Self-Check: PASSED

- `4fef6d3` exists in git log: FOUND
- `apps/web/src/routes/(app)/admin/system/+page.svelte` modified in `4fef6d3`: FOUND
- Build exits 0: CONFIRMED (`pnpm --filter @clokr/web build` completed successfully)
- DATEV Export section at line 1399, before Phorest-Integration at line 1475: CONFIRMED
- All 9 acceptance criteria grep checks pass: CONFIRMED

---
*Phase: 04-datev-code-cleanup*
*Completed: 2026-04-11*
