# Phase 4: DATEV + Code Cleanup - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the broken DATEV LODAS export so it produces a valid LODAS ASCII-importable `.txt` file, and extract the three duplicated schedule helper functions in `reports.ts` to module scope before further reporting work begins. No new reporting features — this is a targeted fix + cleanup phase.

</domain>

<decisions>
## Implementation Decisions

### DATEV INI Format ([Allgemein] section)
- **D-01:** The `[Allgemein]` section uses `BeraterNr=0` and `MandantenNr=0` as placeholders. LODAS accepts 0 — the file imports and the accountant assigns the real numbers manually. BeraterNr/MandantenNr are NOT added to TenantConfig now (deferred to v2 per REQUIREMENTS.md DATEV-V2-01).
- **D-02:** The `[Allgemein]` section emits at minimum: `Versionsnummer`, `BeraterNr=0`, `MandantenNr=0`, `Datumsangaben=DDMMJJJJ`.
- **D-03:** The `[Satzbeschreibung]` section describes the field layout of the data rows (the 11-field semicolon format already in the code).
- **D-04:** The `[Bewegungsdaten]` section contains the actual employee rows (what is currently being output).

### CP1252 Encoding and CRLF (Claude's Discretion)
- **D-05:** Use `iconv-lite` to encode the output as CP1252. The final response body is a Buffer from `iconv.encode(text, "win1252")`. Content-Type changes to `application/octet-stream` (binary).
- **D-06:** Line endings change from `\n` to `\r\n` throughout — including the INI section headers, blank separator lines, and data rows.
- **D-07:** Filename changes from `datev-${year}-${month}.csv` to `datev-${year}-${month}.txt`.

### Configurable Lohnartennummern (DATEV-03)
- **D-08:** Only 4 fields are added to `TenantConfig` (exactly matching SC-3): `datevNormalstundenNr Int @default(100)`, `datevUrlaubNr Int @default(300)`, `datevKrankNr Int @default(200)`, `datevSonderurlaubNr Int @default(302)`.
- **D-09:** The other 6 Lohnartennummern (Krankheit Kind=201, Überstundenausgleich=301, Bildungsurlaub=303, Unbezahlter Urlaub=304, Mutterschutz=310, Elternzeit=320) remain hardcoded — these are rare edge cases that seldom need customization.
- **D-10:** The DATEV route reads `TenantConfig` (or defaults) before building lines; the 4 configurable Lohnartennummern replace their hardcoded counterparts in the `datevLine()` calls.

### Systemeinstellungen UI (DATEV-03)
- **D-11:** Add a new `DATEV Export` section in `apps/web/src/routes/(app)/admin/system/+page.svelte`, positioned **before** the Phorest-Integration section.
- **D-12:** Section uses the existing `sys-section` card pattern and `section-label` header pattern (matching all other sections on that page).
- **D-13:** 4 number inputs — one per configurable Lohnartennummer. Labels in German: "Normalstunden", "Urlaub", "Krank / AU", "Sonderurlaub". Show current values from TenantConfig. Save button calls `PATCH /api/v1/settings/tenant-config`.

### Helper Extraction (DATEV-04)
- **D-14:** Extract `getScheduleForDate`, `calcShouldMinutes`, and `absenceMinutes` to **module scope at the top of `reports.ts`**, above all route registrations. Not a new file.
- **D-15:** The extracted functions take `start`, `end`, `tz` as explicit parameters (they currently close over these from their enclosing route handler). Signature example: `calcShouldMinutes(schedules, hireDate, start, end, tz)`.
- **D-16:** The `*Pdf` variants (`getScheduleForDatePdf`, `calcShouldMinutesPdf`, `absenceMinutesPdf`) are deleted — both handler scopes call the single module-level version instead.

### Claude's Discretion
- Exact `iconv-lite` import style and version pin
- The `[Satzbeschreibung]` exact field descriptors (derive from existing 11-field format)
- Whether to add a `db push` migration note or a proper migration file for the 4 new TenantConfig fields
- Error handling when `TenantConfig` is null (fall back to hardcoded defaults)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current DATEV implementation
- `apps/api/src/routes/reports.ts` — Full DATEV route at line 265; duplicate helpers at lines 64–115 (monthly) and 478–523 (pdf)

### Schema
- `packages/db/prisma/schema.prisma` — `TenantConfig` model at line 37; needs 4 new `Int` fields added

### Systemeinstellungen UI
- `apps/web/src/routes/(app)/admin/system/+page.svelte` — Existing section/card pattern to follow; DATEV section goes before Phorest block (~line 1362)

### Requirements
- `.planning/REQUIREMENTS.md` — DATEV-01 through DATEV-04 (Phase 4 requirements); DATEV-V2-01 (confirms BeraterNr/MandantenNr are out of scope for Phase 4)
- `.planning/ROADMAP.md` — Phase 4 success criteria (4 acceptance tests)

### Settings API
- `apps/api/src/routes/settings.ts` — Existing `PATCH /tenant-config` handler to extend for new DATEV fields

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `datevLine()` helper (line 348 in reports.ts): already builds the 11-field semicolon row — keep as-is, just pass configurable Lohnartennummer values
- `workDaysInMonthRange()` and `daysForName()` helpers (lines 328–344): no duplicates, no changes needed
- `sys-section` + `section-label` pattern in `admin/system/+page.svelte`: copy-paste for DATEV UI section
- `PATCH /api/v1/settings/tenant-config` route in `settings.ts`: already handles TenantConfig updates with audit log — just add 4 new fields to the Zod schema there

### Established Patterns
- TenantConfig updates go through `settings.ts` — don't add a new DATEV-specific route
- All mutations use `app.audit()` — the settings route already does this, no extra work needed
- `pnpm --filter @clokr/db exec prisma db push` syncs schema changes during development
- Content-Type for binary downloads: `application/octet-stream` with `Content-Disposition: attachment`

### Integration Points
- `reports.ts` DATEV route reads `TenantConfig` via `app.prisma.tenantConfig.findUnique({ where: { tenantId } })` — pattern already used in other routes (e.g., settings.ts line 160)
- Frontend settings page loads config via `GET /api/v1/settings/tenant-config` on `onMount` — existing pattern
- `iconv-lite` is not currently a dependency — needs to be added to `apps/api/package.json`

</code_context>

<specifics>
## Specific Ideas

No specific references — decisions derived from success criteria and codebase analysis.

</specifics>

<deferred>
## Deferred Ideas

- BeraterNr and MandantenNr TenantConfig fields — DATEV-V2-01 (full SSH LODAS Native header)
- Making the remaining 6 Lohnartennummern configurable — out of SC-3 scope, add to backlog if needed

</deferred>

---

*Phase: 04-datev-code-cleanup*
*Context gathered: 2026-04-11*
