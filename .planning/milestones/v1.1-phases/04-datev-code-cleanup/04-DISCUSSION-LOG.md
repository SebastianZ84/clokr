# Phase 4: DATEV + Code Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-11
**Phase:** 04-datev-code-cleanup
**Mode:** discuss
**Areas discussed:** DATEV INI [Allgemein] header, Lohnartennummern UI placement, Helper extraction target

## Gray Areas Presented

| Area | Question | Options presented |
|------|----------|-------------------|
| DATEV INI [Allgemein] header | What goes in [Allgemein] when BeraterNr/MandantenNr are deferred? | 0 as placeholders / Omit entirely / Make configurable now |
| Lohnartennummern scope | 4 per SC-3 or all 10? | Only 4 from SC-3 / All 10 configurable |
| Lohnartennummern UI placement | Where in Systemeinstellungen? | Before Phorest / After Phorest |
| Helper extraction target | Module scope in reports.ts or new utility file? | Module scope in reports.ts / New utils/report-calc.ts |

## Decisions Made

### DATEV INI [Allgemein] header
- **Decision:** Use 0 as placeholders (`BeraterNr=0`, `MandantenNr=0`)
- **Rationale:** LODAS accepts 0; file imports and accountant assigns real numbers. Avoids schema fields now — deferred to v2.

### Lohnartennummern scope
- **Decision:** Only the 4 from SC-3 (Normalstunden, Urlaub, Krank, Sonderurlaub)
- **Rationale:** Matches acceptance criteria exactly. Other 6 are rare edge cases.

### Lohnartennummern UI placement
- **Decision:** New section before Phorest-Integration
- **Rationale:** DATEV is higher priority than Phorest; same card pattern as existing sections.

### Helper extraction target
- **Decision:** Module scope in reports.ts
- **Rationale:** Matches SC-4 wording exactly ("at module scope"); no new files.

## No Corrections
All decisions confirmed on first pass.
