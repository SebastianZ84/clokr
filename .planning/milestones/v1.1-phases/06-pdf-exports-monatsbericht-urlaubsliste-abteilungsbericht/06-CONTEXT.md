# Phase 6: PDF Exports — Monatsbericht, Urlaubsliste, Abteilungsbericht — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss — autonomous mode)

<domain>
## Phase Boundary

Add company-wide PDF export capabilities to the existing reports system:
- Company-wide monthly report PDF (all employees, Ist/Soll/Saldo in one file) — PDF-01
- Vacation list PDF (all employees, individual leave periods by year) — PDF-02
- Monthly report PDF filterable by role (EMPLOYEE / MANAGER / all) — PDF-03
- Improved single-employee PDF layout with tenant branding — PDF-04
- Streaming PDF response to avoid Buffer.concat for 50+ employees — PDF-05

**Key insight:** PDF-02 ("Urlaubsliste") ≠ existing `leave-overview/pdf` ("Urlaubsübersicht"). The existing endpoint shows entitlement summaries (totalDays/usedDays/remainingDays). PDF-02 requires individual vacation periods (who took vacation when — approved leave requests with dates).

</domain>

<decisions>
## Implementation Decisions

### PDF-01 + PDF-03: Company-wide monthly PDF with role filter
New endpoint: `GET /api/v1/reports/monthly/pdf/all?year=&month=&role=`
- `role`: `all` (default) | `EMPLOYEE` | `MANAGER` — filters employees by their user role
- Returns one multi-page PDF for all matching employees
- Uses streaming (PDFKit piped to reply directly — no Buffer.concat)
- One employee section per page, sorted by lastName

### PDF-02: Vacation list PDF (individual periods)
New endpoint: `GET /api/v1/reports/leave-list/pdf?year=`
- Queries approved `LeaveRequest` records filtered by year (startDate/endDate overlap with year range)
- Groups by employee (sorted by lastName), lists individual periods with leave type and days
- Streaming response
- This is a separate document from the existing `leave-overview/pdf` (entitlement summary)

### PDF-04: Improve existing single-employee PDF
Modify `generateMonthlyReportPdf` in `apps/api/src/utils/pdf.ts`:
- Move tenant name to prominent header with a colored band (use `#4f46e5` as header color)
- Add employee role/position info placeholder
- Add page numbers (`Seite X von Y` in footer)
- Keep the same data structure — backward-compatible

### PDF-05: Streaming implementation
New multi-employee PDF functions use streaming:
```typescript
// Instead of Buffer.concat pattern:
const doc = new PDFDocument({ ...options });
reply.header("Content-Type", "application/pdf");
reply.header("Content-Disposition", `attachment; filename="..."`);
doc.end();
return reply.send(doc); // Fastify streams Readable directly
```
Single-employee PDF keeps Buffer.concat (only 1 employee, not a perf concern).

### New PDF utility functions
In `apps/api/src/utils/pdf.ts`:
- Update `generateMonthlyReportPdf` — improve layout (PDF-04)
- Add `streamCompanyMonthlyReportPdf(doc, data)` — fills an existing PDFDocument (PDF-01)
- Add `streamLeaveListPdf(doc, data)` — fills an existing PDFDocument (PDF-02)

Route functions in `reports.ts` create the PDFDocument, pipe to reply, call utility functions.

### Frontend additions
In `apps/web/src/routes/(app)/reports/+page.svelte`:
- Add "Firmenweiter Monatsbericht" card (PDF-01/PDF-03) with month/year/role selectors
- Add download function `downloadCompanyMonthlyPdf()` calling the new all-employees endpoint
- Role options in German: "Alle Mitarbeiter" / "Nur Mitarbeiter" / "Nur Manager"
- Use the existing `downloadPdf()` utility function

### Tests
- Add test in `reports.test.ts` for the new endpoints:
  - `GET /reports/monthly/pdf/all` → 200 with content-type application/pdf
  - `GET /reports/leave-list/pdf` → 200 with content-type application/pdf
  - Both endpoints return 401 without auth

</decisions>

<code_context>
## Existing Code Insights

**`apps/api/src/utils/pdf.ts`** (191 lines)
- `generateMonthlyReportPdf(data)` → Promise<Buffer> — single employee, uses Buffer.concat
- `generateVacationOverviewPdf(data)` → Promise<Buffer> — all employees entitlement summary
- Both use PDFKit, standard A4/landscape A4 sizes

**`apps/api/src/routes/reports.ts`** (741 lines)
- `GET /monthly` — JSON summary (all employees)
- `GET /monthly/pdf` — single employee PDF
- `GET /leave-overview` — JSON vacation entitlement summary
- `GET /leave-overview/pdf` — vacation entitlement PDF (existing "Urlaubsübersicht")
- `GET /datev` — DATEV CSV export
- Uses `monthRangeUtc`, `getTenantTimezone`, `getDayHoursFromSchedule`, `getDayOfWeekInTz`

**`apps/web/src/routes/(app)/reports/+page.svelte`** (533 lines)
- 3 cards: Monatsbericht (JSON view), DATEV Export, Urlaubsübersicht PDF
- `downloadPdf(url, filename)` utility handles auth + blob download
- `downloadMonthlyPdf(employeeId)` — per-employee PDF download

**Role model**: employees don't have a `role` field directly — role is on the `User` model. To filter by role, need to join: `employee.user.role`.

</code_context>

<specifics>
## Specific Ideas

- The "Firmenweiter Monatsbericht" PDF should include a summary page at the start: all employees in a compact table (same layout as existing JSON view), then individual employee detail pages
- For the leave-list PDF, group by employee with a sub-table of their leave periods
- "Abteilungsbericht" in the phase name refers to PDF-03's role filter (EMPLOYEE/MANAGER) — no separate Abteilung entity exists yet
- PDF-05 streaming: use `return reply.send(doc)` — Fastify 5 supports Readable streams directly
- Keep `generateMonthlyReportPdf` returning `Promise<Buffer>` for backward compat; just improve the layout
- The page description on the reports page should be updated to mention the new PDF options

</specifics>

<deferred>
## Deferred Ideas

- Abteilungs-entity-based filtering (no Abteilung entity in v1.1 — role-based filter is the scope)
- PDF/A archival format (not required for v1.1)
- Async PDF generation with webhook callback (sync streaming is sufficient for v1.1 scope)
- Custom fonts / company logo embedding (no logo upload feature exists yet)

</deferred>
