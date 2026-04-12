---
phase: 07-reporting-dashboards-berstunden-urlaub-anwesenheit
fixed_at: 2026-04-12T00:00:00Z
review_path: .planning/phases/07-reporting-dashboards-berstunden-urlaub-anwesenheit/07-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-04-12T00:00:00Z
**Source review:** .planning/phases/07-reporting-dashboards-berstunden-urlaub-anwesenheit/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Non-null assertion on `endTime` crashes when `endTime` is null

**Files modified:** `apps/api/src/routes/reports.ts`
**Commit:** 1bc69ce
**Applied fix:** Replaced `e.endTime!.getTime()` non-null assertions in both the `workedMin` reducer (line ~181) and the `entries.map` `netHours` calculation (line ~252) with conditional guards that return `0` for entries with no `endTime`. This eliminates the runtime `TypeError` risk for any future caller that passes an open entry.

---

### WR-01: Hardcoded `Europe/Berlin` timezone ignores tenant timezone setting

**Files modified:** `apps/api/src/routes/reports.ts`
**Commit:** e5062c0
**Applied fix:** Added `const tz = await getTenantTimezone(app.prisma, req.user.tenantId)` to both the `/leave-list/pdf` handler and the `/vacation/pdf` handler (neither had a `tz` variable). Replaced all four `"Europe/Berlin"` hardcoded strings with the `tz` variable in the `formatInTimeZone` calls for `startDate` and `endDate` formatting in both handlers.

---

### WR-02: Unvalidated `parseInt` on query params silently produces NaN

**Files modified:** `apps/api/src/routes/reports.ts`
**Commit:** fbd4ddd
**Applied fix:** Added `isNaN(y) || isNaN(m) || m < 1 || m > 12` guards immediately after `parseInt` in all four affected endpoints (`/monthly`, `/datev`, `/monthly/pdf`, `/monthly/pdf/all`), returning `reply.code(400).send({ error: "Ungültige Jahr- oder Monatsangabe" })` on invalid input. Also fixed the `/monthly` handler which was missing the `reply` parameter, and removed a stale duplicate `const m = parseInt(month)` at line ~546 inside the `/datev` handler that caused a TypeScript redeclaration error.

---

### WR-03: `downloadPdf` leaks a URL object — `revokeObjectURL` called too early

**Files modified:** `apps/web/src/routes/(app)/reports/+page.svelte`
**Commit:** b030526
**Applied fix:** Stored the blob URL in a named `objectUrl` variable, appended the anchor element to `document.body` before clicking (consistent with `downloadDatev`), removed it after the click, and deferred `URL.revokeObjectURL(objectUrl)` to a `setTimeout` of 100ms so the browser download manager has time to read the blob before the URL is revoked.

---

### WR-04: DATEV download UI saves file with `.csv` extension, but server sends `.txt`

**Files modified:** `apps/web/src/routes/(app)/reports/+page.svelte`
**Commit:** 835a52c
**Applied fix:** Updated the DATEV export button label from `↓ CSV herunterladen` to `↓ TXT herunterladen`. The download filename (`DATEV_${year}_${month}.txt`) and the card description (`TXT-Datei für DATEV-Lohnabrechnung herunterladen`) were already correct in the current code — only the button label required fixing.

---

### WR-05: `computeEmployeeSummary` double-counts sick days

**Files modified:** `apps/api/src/routes/reports.ts`
**Commit:** bbb4bc0
**Applied fix:** Established `LeaveRequest` (Krankmeldung/Kinderkrank) as the single source of truth for sick-day reporting. Renamed `sickDaysAbsence` to `_sickDaysAbsence` to mark it as non-contributing, changed `sickDaysWithoutAttest` initialization from `sickDaysAbsence` to `0`, and added a multi-line comment documenting the data model invariant (Absence = document tracking, LeaveRequest = sick-day counting). This prevents double-counting when both an `Absence` record and a sick `LeaveRequest` exist for the same period.

**Status:** fixed: requires human verification — the fix assumes `LeaveRequest` is always the canonical source for sick days; verify this holds for all tenant workflows before deploying.

---

_Fixed: 2026-04-12T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
