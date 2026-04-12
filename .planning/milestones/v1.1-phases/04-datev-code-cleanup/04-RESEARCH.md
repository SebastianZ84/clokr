# Phase 4: DATEV + Code Cleanup — Research

**Researched:** 2026-04-11
**Domain:** DATEV LODAS ASCII Export, Prisma schema extension, TypeScript refactor
**Confidence:** HIGH (codebase verified), MEDIUM (DATEV format partially verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `[Allgemein]` uses `BeraterNr=0` and `MandantenNr=0` as placeholders. Not added to TenantConfig (deferred DATEV-V2-01).
- **D-02:** `[Allgemein]` emits at minimum: `Versionsnummer`, `BeraterNr=0`, `MandantenNr=0`, `Datumsangaben=DDMMJJJJ`.
- **D-03:** `[Satzbeschreibung]` describes the field layout of the 11-field semicolon data rows.
- **D-04:** `[Bewegungsdaten]` contains the actual employee rows (current output).
- **D-05:** Use `iconv-lite` to encode as CP1252. Final response body is a Buffer. Content-Type: `application/octet-stream`.
- **D-06:** Line endings: `\r\n` throughout — section headers, blank separators, and data rows.
- **D-07:** Filename: `datev-${year}-${month}.txt` (not `.csv`).
- **D-08:** 4 new TenantConfig fields: `datevNormalstundenNr Int @default(100)`, `datevUrlaubNr Int @default(300)`, `datevKrankNr Int @default(200)`, `datevSonderurlaubNr Int @default(302)`.
- **D-09:** Other 6 Lohnartennummern remain hardcoded.
- **D-10:** DATEV route reads TenantConfig (or defaults) before building lines; 4 configurable Lohnartennummern replace hardcoded counterparts.
- **D-11:** New `DATEV Export` section in `admin/system/+page.svelte`, positioned **before** the Phorest-Integration section.
- **D-12:** Section uses `section-label` + `card card-body settings-card` pattern.
- **D-13:** 4 number inputs, German labels: "Normalstunden", "Urlaub", "Krank / AU", "Sonderurlaub". Save button calls `PATCH /api/v1/settings/tenant-config` (see clarification below in Open Questions).
- **D-14:** Extract `getScheduleForDate`, `calcShouldMinutes`, `absenceMinutes` to module scope at the top of `reports.ts`.
- **D-15:** Extracted functions take `start`, `end`, `tz` as explicit parameters.
- **D-16:** `*Pdf` variants deleted; both handler scopes call the single module-level version.

### Claude's Discretion

- Exact `iconv-lite` import style and version pin
- The `[Satzbeschreibung]` exact field descriptors (derive from existing 11-field format)
- Whether to add a `db push` migration note or a proper migration file for the 4 new TenantConfig fields
- Error handling when `TenantConfig` is null (fall back to hardcoded defaults)

### Deferred Ideas (OUT OF SCOPE)

- BeraterNr and MandantenNr TenantConfig fields — DATEV-V2-01
- Making the remaining 6 Lohnartennummern configurable
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATEV-01 | DATEV-Export erzeugt LODAS-kompatibles INI-Format mit `[Allgemein]`, `[Satzbeschreibung]`, `[Bewegungsdaten]` | Format verified via DATEV community and official help center docs |
| DATEV-02 | DATEV-Export verwendet CP1252-Encoding mit CRLF-Zeilenenden | iconv-lite 0.7.2 already in lockfile; encode pattern verified |
| DATEV-03 | Admin kann Lohnartennummern pro Tenant konfigurieren in Systemeinstellungen | Settings route + UI pattern fully analyzed |
| DATEV-04 | Duplizierte Hilfsfunktionen in `reports.ts` werden auf Modulebene extrahiert | All duplicates located, signatures analyzed |
</phase_requirements>

---

## Summary

Phase 4 is a targeted fix-and-cleanup phase with four clearly scoped tasks. The codebase has been fully analyzed and all changes are well-bounded.

The DATEV export currently outputs a plain CSV file with a header row, `text/csv` content type, and LF line endings. It does not conform to the DATEV LODAS ASCII import format that accountants expect. The fix requires adding three INI sections (`[Allgemein]`, `[Satzbeschreibung]`, `[Bewegungsdaten]`), switching to CP1252 encoding via `iconv-lite`, and changing to CRLF line endings.

The helper function duplication is straightforward: three functions exist twice in `reports.ts` — once nested inside the `/monthly` handler (lines 64–120) and once nested inside the `/monthly/pdf` handler (lines 478–523) with `Pdf` suffix variants. Extracting them to module scope with explicit `start, end, tz` parameters eliminates both duplicate sets.

**Primary recommendation:** Implement in four independent tasks in this order: (1) helper extraction (DATEV-04, lowest risk), (2) schema migration + settings API extension (DATEV-03 backend), (3) DATEV route rewrite (DATEV-01/02), (4) settings UI section (DATEV-03 frontend).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| iconv-lite | 0.7.2 | CP1252 (win1252) encoding | Already in pnpm lockfile as transitive dep; needs to be added as direct dep to `apps/api` |
| Prisma | 7.6.0 | Schema migration + TenantConfig query | Already in stack; `prisma db push` syncs schema changes |
| Zod | 4.3.6 | Validation of new DATEV config fields in settings route | Already in stack |

**iconv-lite is already in the lockfile** (version 0.7.2, transitive via other deps). It does NOT appear in `apps/api/package.json` as a direct dependency — it must be added. [VERIFIED: pnpm-lock.yaml]

**Installation:**
```bash
pnpm --filter @clokr/api add iconv-lite
```

**Version verification:** `iconv-lite` current version is 0.7.2. [VERIFIED: pnpm-lock.yaml + npm registry]

---

## Architecture Patterns

### Pattern 1: DATEV LODAS ASCII INI File Structure

**What:** The DATEV LODAS ASCII import format is an INI-like text file with three mandatory sections.
**Source:** [CITED: DATEV Help Center docs.1007833, community thread, gdi-landau example]

```
[Allgemein]
Ziel=LODAS\r\n
Version_SST=1.0\r\n
BeraterNr=0\r\n
MandantenNr=0\r\n
Datumsangaben=DDMMJJJJ\r\n
\r\n
[Satzbeschreibung]\r\n
20;u_lod_bwd_buchung_kst;pnr#bwd;u_lod_lna_nr#bwd;ausfallkennzeichen#bwd;stunden#bwd;tage#bwd;betrag#bwd;faktor#bwd;kuerzung#bwd;kostenstelle#bwd;kostentraeger#bwd\r\n
\r\n
[Bewegungsdaten]\r\n
001;31;100;0;8,00;;;;;\r\n  <-- actual data rows
```

**Key format rules:**
- `Ziel=LODAS` must be present — LODAS rejects files without it [CITED: DATEV help center]
- `Version_SST=1.0` is the interface version [CITED: DATEV community example]
- `Datumsangaben=DDMMJJJJ` tells LODAS the date format used in the file
- Each section is separated by a blank CRLF line
- All lines end with `\r\n`
- Decimal separator is comma (`,`) not period
- File encoding: CP1252 (Windows-1252) [ASSUMED — widely documented requirement for DATEV import files, not independently verified via hex dump test]

**The `[Satzbeschreibung]` row for the 11-field format:**
The existing `datevLine()` function in `reports.ts` (line 348) already produces the correct 11-field semicolon format. The `[Satzbeschreibung]` must describe those 11 fields. Based on the field order already documented in the code comments and DATEV field name conventions: [ASSUMED — exact DATEV internal field identifiers not confirmed; field ORDER is verified from codebase]

```
20;u_lod_bwd_buchung_kst;pnr#bwd;u_lod_lna_nr#bwd;ausfallkennzeichen#bwd;stunden#bwd;tage#bwd;betrag#bwd;faktor#bwd;kuerzung#bwd;kostenstelle#bwd;kostentraeger#bwd
```

The `20` is the record type identifier for Bewegungsdaten in LODAS. [CITED: DATEV community search results 2024]

### Pattern 2: iconv-lite Encoding Buffer Pattern

**What:** Encode a string to CP1252 and return as binary Buffer via Fastify.

```typescript
// Source: iconv-lite docs + existing stack pattern
import iconv from "iconv-lite";

// Build text string with \r\n line endings
const text = lines.join("\r\n");

// Encode to CP1252 Buffer
const buf: Buffer = iconv.encode(text, "win1252");

reply.header("Content-Type", "application/octet-stream");
reply.header("Content-Disposition", `attachment; filename="datev-${year}-${month}.txt"`);
return reply.send(buf);
```

`iconv.encode(text, "win1252")` returns a `Buffer` directly — no additional conversion needed. [VERIFIED: iconv-lite 0.7.2 API]

### Pattern 3: Module-Scope Helper Extraction

**What:** Move nested handler functions to module scope with explicit parameters.

**Current duplicate locations in `reports.ts`:**
- Instance 1 (monthly handler): lines 64–120 — `getScheduleForDate`, `calcShouldMinutes`, `absenceMinutes`
  - Closes over `start`, `end`, `tz` from handler scope
  - `calcShouldMinutes` signature: `(schedules, hireDate?)`
  - `absenceMinutes` signature: `(schedules, absStart, absEnd)`
- Instance 2 (pdf handler): lines 478–523 — `getScheduleForDatePdf`, `calcShouldMinutesPdf`, `absenceMinutesPdf`
  - Same logic, also closes over `start`, `end`, `tz`

**Extracted module-scope signatures (per D-15):**
```typescript
// Source: [VERIFIED: reports.ts lines 64-120, 478-523]
type ScheduleList = { validFrom: Date; type: string; monthlyHours: unknown; [key: string]: unknown }[];

function getScheduleForDate(schedules: ScheduleList, date: Date) { ... }

function calcShouldMinutes(
  schedules: ScheduleList,
  hireDate: Date | undefined,
  start: Date,
  end: Date,
  tz: string
): number { ... }

function absenceMinutes(
  schedules: ScheduleList,
  absStart: Date,
  absEnd: Date,
  start: Date,
  end: Date,
  tz: string
): number { ... }
```

The `ScheduleList` type annotation must be compatible with both the `/monthly` handler's `employees[0]["workSchedules"]` type and the `/monthly/pdf` handler's `NonNullable<typeof emp>["workSchedules"]` type — which are the same Prisma-generated type. A local type alias or direct Prisma type import resolves this. [VERIFIED: reports.ts type usage]

### Pattern 4: TenantConfig Extension

**What:** Add 4 new `Int` fields to TenantConfig model with defaults.

```prisma
// Add to TenantConfig model in packages/db/prisma/schema.prisma
// after the existing compliance fields (around line 139)
// DATEV Lohnartennummern (konfigurierbar pro Mandant)
datevNormalstundenNr Int @default(100)
datevUrlaubNr        Int @default(300)
datevKrankNr         Int @default(200)
datevSonderurlaubNr  Int @default(302)
```

**Migration approach:** `pnpm --filter @clokr/db exec prisma db push` during development (D-08 scope). All 4 fields have `@default` values so existing TenantConfig rows are not invalidated. [VERIFIED: schema.prisma pattern — other Int fields with @default already present]

### Pattern 5: Settings API Extension (correct endpoint)

**What:** Extend the existing `PUT /settings/work` endpoint in `settings.ts` — NOT a new `PATCH /tenant-config`.

**Critical finding:** CONTEXT.md D-13 mentions `PATCH /api/v1/settings/tenant-config` but **this endpoint does not exist** in the codebase. The existing pattern is `PUT /settings/work` (which calls `tenantConfigSchema.parse(req.body)` and upserts TenantConfig). The DATEV config fields should be added to `tenantConfigSchema` in `settings.ts` and saved via `PUT /settings/work`. [VERIFIED: settings.ts + routes search — no tenant-config PATCH endpoint exists]

The 4 new fields to add to `tenantConfigSchema`:
```typescript
datevNormalstundenNr: z.number().int().min(1).max(9999).optional(),
datevUrlaubNr: z.number().int().min(1).max(9999).optional(),
datevKrankNr: z.number().int().min(1).max(9999).optional(),
datevSonderurlaubNr: z.number().int().min(1).max(9999).optional(),
```

The `GET /settings/work` handler must also return these 4 fields in its `base` defaults object (with values 100, 300, 200, 302). [VERIFIED: settings.ts GET /work handler returns base object]

### Pattern 6: UI Section Structure

**What:** The `section-label` + `card card-body settings-card` pattern used for API Keys and Phorest sections.

```html
<!-- ── DATEV Export ───────────────────────────────────────────────────── -->
<div class="section-label">
  <h2>DATEV Export</h2>
  <p class="text-muted">Lohnartennummern für den DATEV LODAS ASCII-Export konfigurieren</p>
</div>

<div class="card card-body settings-card">
  <div class="sys-section">
    <!-- 4 number inputs + save button here -->
  </div>
</div>
```

The `section-label` class is defined at line 1714 of `+page.svelte` (margin-bottom: 1rem). The `settings-card` class adds margin-bottom: 2rem. [VERIFIED: +page.svelte lines 1257-1262, 1714, 1718]

Insert point: **before line 1362** (the `<!-- ── Phorest-Integration ──` comment). [VERIFIED: +page.svelte line 1362]

**Frontend state variables needed:**
```typescript
let datevNormalstundenNr = $state(100);
let datevUrlaubNr = $state(300);
let datevKrankNr = $state(200);
let datevSonderurlaubNr = $state(302);
let datevSaving = $state(false);
let datevSaved = $state(false);
let datevError = $state("");
```

**onMount:** Load from `GET /settings/work` response (the 4 new fields will be in the response once the API is extended).

**Save function:** Call `api.put("/settings/work", { datevNormalstundenNr, datevUrlaubNr, datevKrankNr, datevSonderurlaubNr })`. This matches the `PUT /settings/work` pattern used by `saveFederalState()`. [VERIFIED: +page.svelte lines 357-369]

### Anti-Patterns to Avoid

- **Creating a new PATCH /tenant-config route:** The pattern is to extend the existing `tenantConfigSchema` and `PUT /settings/work`. A new dedicated endpoint would duplicate the audit pattern unnecessarily.
- **UTF-8 encoding for DATEV export:** DATEV LODAS expects CP1252; UTF-8 will produce garbled output for German umlauts (Ä, Ö, Ü, ß etc.) in employee names.
- **LF line endings:** DATEV LODAS ASCII parser expects CRLF. LF will cause import failures or garbled records on Windows-based LODAS clients.
- **Keeping `\n` in the final join:** Must use `\r\n` for ALL lines including section headers and blank separator lines.
- **Using `reply.type("text/plain")` instead of `application/octet-stream`:** The browser must treat the response as a binary download, not display it as text.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CP1252 encoding | Custom char map | `iconv-lite` encode("win1252") | iconv-lite handles all edge cases including multi-byte and undefined codepoints |
| Prisma schema migration | Manual ALTER TABLE | `prisma db push` | Standard project pattern; all 4 fields have defaults so no data migration needed |

---

## Common Pitfalls

### Pitfall 1: Forgetting CRLF on the Final `lines.join()`

**What goes wrong:** Current code uses `lines.join("\n")`. After refactor, if the join remains `\n`, the file will have mixed endings.
**Why it happens:** Easy to miss that the join separator must also be `\r\n`.
**How to avoid:** Change to `lines.join("\r\n")` AND ensure each line in the `lines` array does NOT already end with `\r\n` (to avoid double CRLF).
**Warning signs:** Hex editor shows 0x0A without preceding 0x0D.

### Pitfall 2: Type Error After Helper Extraction

**What goes wrong:** The extracted `getScheduleForDate`, `calcShouldMinutes`, `absenceMinutes` functions reference Prisma-generated array types that differ in name between the two handler scopes.
**Why it happens:** The monthly handler uses `(typeof employees)[0]["workSchedules"]` and the PDF handler uses `NonNullable<typeof emp>["workSchedules"]`. Both are the same runtime type but TypeScript sees different type expressions.
**How to avoid:** Declare one type alias at module scope using the Prisma-generated type directly (e.g., `import { Prisma } from "@clokr/db"`) or use a structural type that covers both.
**Warning signs:** TypeScript error "Argument of type X is not assignable to parameter of type Y" on the extraction call sites.

### Pitfall 3: iconv-lite `encode()` Returns Buffer, Not String

**What goes wrong:** Code attempts to call `.toString()` on the iconv result and then pass that string to `reply.send()`, which re-encodes it as UTF-8.
**Why it happens:** Muscle memory from string-based responses.
**How to avoid:** Pass the `Buffer` directly to `reply.send(buf)`. Set `Content-Type: application/octet-stream` BEFORE the send call.
**Warning signs:** The downloaded file appears but Umlauts are mangled.

### Pitfall 4: TenantConfig Null Handling in DATEV Route

**What goes wrong:** `app.prisma.tenantConfig.findUnique()` returns `null` when no config exists for the tenant (e.g., a freshly seeded dev tenant).
**Why it happens:** TenantConfig is optional (`config TenantConfig?` on Tenant model).
**How to avoid:** Use null-coalescing on all 4 configurable fields: `config?.datevNormalstundenNr ?? 100`. This matches the pattern used throughout the settings route GET handler. [VERIFIED: settings.ts lines 108-146]

### Pitfall 5: `*Pdf` Variant Call Sites Not Updated

**What goes wrong:** After deleting `getScheduleForDatePdf`, `calcShouldMinutesPdf`, `absenceMinutesPdf`, the PDF handler still has call sites referencing the old names.
**Why it happens:** Not all call sites are found (there are 6 call sites: `calcShouldMinutesPdf` at lines 530, `getScheduleForDatePdf` at line 531, `absenceMinutesPdf` within the `emp.leaveRequests.reduce` at line 537).
**How to avoid:** Use grep/search to find ALL occurrences before and after deletion: `getScheduleForDatePdf`, `calcShouldMinutesPdf`, `absenceMinutesPdf`, `isMonthlyHoursPdf`, `latestSchedulePdf`.
**Warning signs:** TypeScript compile error "Cannot find name '...Pdf'".

---

## Code Examples

### Complete DATEV LODAS File Structure

```typescript
// Source: [VERIFIED: reports.ts existing code + CITED: DATEV help center / community]
// Building the INI-format output

const CRLF = "\r\n";

// [Allgemein] section
const header = [
  "[Allgemein]",
  "Ziel=LODAS",
  "Version_SST=1.0",
  "BeraterNr=0",
  "MandantenNr=0",
  "Datumsangaben=DDMMJJJJ",
  "",  // blank line separator
  "[Satzbeschreibung]",
  "20;u_lod_bwd_buchung_kst;pnr#bwd;u_lod_lna_nr#bwd;ausfallkennzeichen#bwd;stunden#bwd;tage#bwd;betrag#bwd;faktor#bwd;kuerzung#bwd;kostenstelle#bwd;kostentraeger#bwd",
  "",  // blank line separator
  "[Bewegungsdaten]",
].join(CRLF);

const dataLines: string[] = [];
// ... populate dataLines with datevLine() calls ...

const text = header + CRLF + dataLines.join(CRLF);
const buf: Buffer = iconv.encode(text, "win1252");

reply.header("Content-Type", "application/octet-stream");
reply.header("Content-Disposition", `attachment; filename="datev-${year}-${month}.txt"`);
return reply.send(buf);
```

### Reading Configurable Lohnartennummern

```typescript
// Source: [VERIFIED: settings.ts pattern, reports.ts DATEV handler]
const config = await app.prisma.tenantConfig.findUnique({
  where: { tenantId: req.user.tenantId },
  select: {
    datevNormalstundenNr: true,
    datevUrlaubNr: true,
    datevKrankNr: true,
    datevSonderurlaubNr: true,
  },
});

const lna = {
  normal:       config?.datevNormalstundenNr ?? 100,
  urlaub:       config?.datevUrlaubNr        ?? 300,
  krank:        config?.datevKrankNr         ?? 200,
  sonderurlaub: config?.datevSonderurlaubNr  ?? 302,
};

// Then pass lna.normal, lna.urlaub etc. to datevLine() calls
lines.push(datevLine(pn, tag, "",  lna.normal,       workedHours, 0));
if (vacationDays > 0)   lines.push(datevLine(pn, tag, "U", lna.urlaub,       0, vacationDays));
if (sickDays > 0)       lines.push(datevLine(pn, tag, "K", lna.krank,        0, sickDays));
if (specialDays > 0)    lines.push(datevLine(pn, tag, "S", lna.sonderurlaub, 0, specialDays));
```

### Module-Scope Helper Placement

```typescript
// Source: [VERIFIED: reports.ts structure]
// Place ABOVE the `export async function reportRoutes(app: FastifyInstance)` declaration

import { FastifyInstance } from "fastify";
import { ... } from "../utils/timezone";

// ── Module-scope schedule helpers ─────────────────────────────────────────

type WorkScheduleItem = {
  validFrom: Date;
  type: string;
  monthlyHours: unknown;
  [key: string]: unknown;
};

function getScheduleForDate(schedules: WorkScheduleItem[], date: Date) {
  return (
    schedules
      .filter((s) => s.validFrom <= date)
      .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0] ?? null
  );
}

function calcShouldMinutes(
  schedules: WorkScheduleItem[],
  hireDate: Date | undefined,
  start: Date,
  end: Date,
  tz: string,
): number { ... }

function absenceMinutes(
  schedules: WorkScheduleItem[],
  absStart: Date,
  absEnd: Date,
  start: Date,
  end: Date,
  tz: string,
): number { ... }
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DATEV LODAS accepts `BeraterNr=0` and `MandantenNr=0` as placeholders | Standard Stack / Format | File may be rejected by LODAS validator — but this is locked per D-01; accountant assigns real numbers manually |
| A2 | The `[Satzbeschreibung]` field identifiers (`u_lod_bwd_buchung_kst`, `pnr#bwd`, etc.) are correct for the 11-field semicolon format | Code Examples | LODAS may show a parse warning but still import the data rows; the existing datevLine() output format is not in question — only the descriptor labels |
| A3 | CP1252 encoding is required (not UTF-8 or ISO-8859-1) | Standard Stack | If LODAS accepts UTF-8 in newer versions, this change would still be correct and not harmful |
| A4 | `Version_SST=1.0` is the correct interface version string | Code Examples | If a newer version is required, LODAS may warn but will still import; the exact version is from community examples |

---

## Open Questions

1. **PATCH vs PUT for DATEV settings save**
   - What we know: CONTEXT.md D-13 says "Save button calls `PATCH /api/v1/settings/tenant-config`" but this endpoint **does not exist** in the codebase.
   - What's unclear: Whether a new `PATCH /settings/tenant-config` endpoint should be created or whether the existing `PUT /settings/work` should be reused.
   - Recommendation: Use `PUT /settings/work` — it already handles TenantConfig upsert with audit log. Simply add the 4 DATEV fields to `tenantConfigSchema`. The frontend calls `api.put("/settings/work", { datevNormalstundenNr, ... })`. This follows the exact same pattern as all other TenantConfig settings on this page.

2. **Type annotation for extracted helpers**
   - What we know: Both handler scopes use Prisma-generated WorkSchedule types that are structurally identical but referenced differently.
   - What's unclear: Whether to use a local structural type alias or import the Prisma-generated `WorkSchedule` type.
   - Recommendation: Use a local structural type alias at module scope (matching the shape needed by `getDayHoursFromSchedule`) to avoid adding a Prisma import purely for type annotation.

---

## Environment Availability

Step 2.6: SKIPPED (no external runtime dependencies — this phase modifies source code and schema only; `iconv-lite` is already in the lockfile and `prisma db push` uses the existing Prisma setup).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @clokr/api test --run` |
| Full suite command | `pnpm --filter @clokr/api test --run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATEV-01 | DATEV route returns [Allgemein], [Satzbeschreibung], [Bewegungsdaten] sections | integration | `pnpm --filter @clokr/api test --run reports` | ❌ Wave 0 |
| DATEV-02 | Exported file is CP1252-encoded with CRLF line endings | integration | `pnpm --filter @clokr/api test --run reports` | ❌ Wave 0 |
| DATEV-03 | Configurable Lohnartennummern appear in export after settings save | integration | `pnpm --filter @clokr/api test --run reports` | ❌ Wave 0 |
| DATEV-04 | `calcShouldMinutes`, `absenceMinutes`, `getScheduleForDate` appear exactly once at module scope | static/unit | TypeScript compile (`tsc --noEmit`) | ✅ (tsc runs on build) |

### Wave 0 Gaps
- [ ] `apps/api/src/routes/__tests__/reports.test.ts` — covers DATEV-01, DATEV-02, DATEV-03. Currently no test file exists for `reports.ts` (only `breaks.test.ts`, etc. exist in `__tests__/`).

*(DATEV-04 is verified by TypeScript compilation — no new test file needed.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `requireRole("ADMIN")` already on DATEV route |
| V5 Input Validation | yes | Zod schema validation for new TenantConfig fields (min/max on Int) |
| V6 Cryptography | no | — |

No new attack surface introduced. The DATEV export route already has `requireRole("ADMIN")` (line 268 of reports.ts). The 4 new TenantConfig fields are non-sensitive integers with no security implications. [VERIFIED: reports.ts line 268]

---

## Exact Duplicate Locations (for DATEV-04)

This is the definitive map of duplicate functions in `reports.ts` for the planner:

| Function | Instance 1 (monthly handler) | Instance 2 (pdf handler) | Action |
|----------|------------------------------|--------------------------|--------|
| `getScheduleForDate` | lines 64–70 | `getScheduleForDatePdf` lines 478–484 | Extract to module scope; delete Pdf variant |
| `calcShouldMinutes` | lines 72–97 | `calcShouldMinutesPdf` lines 487–506 | Extract to module scope; delete Pdf variant |
| `absenceMinutes` | lines 100–120 | `absenceMinutesPdf` lines 508–523 | Extract to module scope; delete Pdf variant |

**Pdf variant call sites to update in the pdf handler (lines 530–539):**
- `calcShouldMinutesPdf(emp.workSchedules, emp.hireDate)` → `calcShouldMinutes(emp.workSchedules, emp.hireDate, start, end, tz)`
- `getScheduleForDatePdf(emp.workSchedules, end)` → `getScheduleForDate(emp.workSchedules, end)`
- `absenceMinutesPdf(emp.workSchedules, lr.startDate, lr.endDate)` → `absenceMinutes(emp.workSchedules, lr.startDate, lr.endDate, start, end, tz)`
- `latestSchedulePdf` variable → `latestSchedule` (or keep as local variable referencing new module-scope function)
- `isMonthlyHoursPdf` variable → `isMonthlyHours` (or keep as local)

**Monthly handler call sites (lines 131–139)** already use the correct names; after extraction they call the module-scope versions automatically.

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/routes/reports.ts` — Complete analysis of current DATEV route and duplicate helpers [VERIFIED]
- `packages/db/prisma/schema.prisma` — TenantConfig model structure [VERIFIED]
- `apps/api/src/routes/settings.ts` — `tenantConfigSchema`, `PUT /settings/work` pattern [VERIFIED]
- `apps/web/src/routes/(app)/admin/system/+page.svelte` — section-label + settings-card UI pattern [VERIFIED]
- `pnpm-lock.yaml` — iconv-lite 0.7.2 presence as transitive dep [VERIFIED]
- npm registry — iconv-lite current version 0.7.2 [VERIFIED]

### Secondary (MEDIUM confidence)
- [DATEV Help Center 1007833](https://help-center.apps.datev.de/documents/1007833) — LODAS Herstellerformat specification
- [DATEV Help Center 9219371](https://apps.datev.de/help-center/documents/9219371) — Bewegungsdaten importieren (ASCII-Import)
- [DATEV Help Center 9243836](https://apps.datev.de/help-center/documents/9243836) — LODAS ASCII-Import Fenster
- [DATEV Community Thread](https://www.datev-community.de/t5/Personalwirtschaft/ASCII-Datei-f%C3%BCr-Lodas/td-p/405817) — ASCII Datei für Lodas examples
- [GDI Landau DATEV Template](https://gdi-landau.de/Setup/Zeit/Schnittstelle_LODAS/DATEV_Lodas_Vorlage.TXT) — Example LODAS import file structure

### Tertiary (LOW confidence)
- [hilfe.saas.de DATEV ASCII-Import](https://hilfe.saas.de/hilfesaas_v2/urlaubsverwaltung/datev-ascii-import) — 11-field format confirmed; section structure not verified
- [DATEV Developer Portal ASCII](https://developer.datev.de/datev/platform/en/schnittstellenvorgaben/ascii) — Not accessible (redirect to homepage)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Duplicate locations: HIGH — verified by line-by-line code read
- DATEV INI format structure: MEDIUM — `[Allgemein]`/`[Satzbeschreibung]`/`[Bewegungsdaten]` section names confirmed by multiple sources; exact `[Satzbeschreibung]` field identifiers are ASSUMED
- Architecture patterns: HIGH — all based on verified codebase patterns

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable libraries; DATEV format specification rarely changes)
