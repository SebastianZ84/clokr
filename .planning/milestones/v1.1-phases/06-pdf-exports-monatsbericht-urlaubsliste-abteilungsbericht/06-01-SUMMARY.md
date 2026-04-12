---
phase: 06-pdf-exports-monatsbericht-urlaubsliste-abteilungsbericht
plan: "01"
subsystem: api-reports-pdf
tags: [pdf, reports, streaming, pdfkit, company-monthly, leave-list]
dependency_graph:
  requires: []
  provides:
    - GET /api/v1/reports/monthly/pdf/all (PDF-01/PDF-03/PDF-05)
    - GET /api/v1/reports/leave-list/pdf (PDF-02/PDF-05)
    - streamCompanyMonthlyReportPdf utility function
    - streamLeaveListPdf utility function
    - computeEmployeeSummary private helper (DRY monthly calc)
  affects:
    - apps/api/src/utils/pdf.ts
    - apps/api/src/routes/reports.ts
    - apps/api/src/routes/__tests__/reports.test.ts
tech_stack:
  added: []
  patterns:
    - PDFKit streaming via doc.end() + reply.send(doc) — Fastify pipes Readable stream
    - pageAdded event for streaming footers with re-entrancy guard
    - bufferPages: true only for single-employee Buffer-based PDF (not streaming)
    - Role allowlist validation (MANAGER | EMPLOYEE | undefined) before Prisma query
key_files:
  created: []
  modified:
    - apps/api/src/utils/pdf.ts
    - apps/api/src/routes/reports.ts
    - apps/api/src/routes/__tests__/reports.test.ts
decisions:
  - pageAdded re-entrancy guard required — drawing footer text inside pageAdded can trigger doc.text() overflow detection which re-triggers addPage which re-fires pageAdded → stack overflow
  - lineBreak:false on footer text to prevent PDFKit overflow detection within fixed-position footer rendering
  - computeEmployeeSummary extracted as module-level function — removes duplication from GET /monthly and GET /monthly/pdf, now shared with GET /monthly/pdf/all
  - Leave-list endpoint returns all employees (even those with no leave) for completeness — empty periods list shows graceful "no leave" state in PDF
metrics:
  duration_minutes: 9
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
  completed_date: "2026-04-11"
requirements:
  - PDF-01
  - PDF-02
  - PDF-03
  - PDF-04
  - PDF-05
---

# Phase 06 Plan 01: PDF Exports — Company Monthly Report + Leave List Summary

Company-wide streaming PDF export endpoints (Monatsbericht-alle + Urlaubsliste) added to Fastify reports API using PDFKit streaming, with tenant-branded single-employee PDF layout improvement and DRY computeEmployeeSummary helper extraction.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Refactor pdf.ts — PDF-04 layout + streaming filler functions | cfcc499, d330758 | apps/api/src/utils/pdf.ts |
| 2 | Add /monthly/pdf/all + /leave-list/pdf endpoints + computeEmployeeSummary | 64b0ea4 | apps/api/src/routes/reports.ts |
| 3 | Integration tests (14 tests) | 098ddc0 | apps/api/src/routes/__tests__/reports.test.ts |

## Changes Made

### apps/api/src/utils/pdf.ts

- **PDF-04**: `generateMonthlyReportPdf` now renders a colored header band (`#4f46e5`, 44px) with tenant name in white + "Monatsbericht" subtitle in light blue. Uses `bufferPages: true` for "Seite X von Y" footer via `bufferedPageRange` + `switchToPage` pass.
- **PDF-01/PDF-03**: New `streamCompanyMonthlyReportPdf(doc, data)` — synchronous void filler. Summary table on page 1, per-employee detail pages. Uses `pageAdded` event for footer (with re-entrancy guard).
- **PDF-02**: New `streamLeaveListPdf(doc, data)` — synchronous void filler. Groups leave periods by employee in a 4-column table with row-overflow guard. Same footer pattern.
- Both streaming functions export `CompanyMonthlyReportData` and `LeaveListData` interfaces.

### apps/api/src/routes/reports.ts

- **DRY refactor**: Extracted `computeEmployeeSummary(emp, start, end, tz)` as a module-level function. Called by `GET /monthly`, `GET /monthly/pdf`, and new `GET /monthly/pdf/all`. Eliminates ~150 lines of duplicated calculation logic.
- **PDF-01/PDF-03/PDF-05**: `GET /monthly/pdf/all?year=&month=&role=` — ADMIN/MANAGER only, role allowlist (`EMPLOYEE | MANAGER | undefined`), streaming via `doc.end()` + `reply.send(doc)`, `app.audit()` with `COMPANY_MONTHLY_PDF`.
- **PDF-02/PDF-05**: `GET /leave-list/pdf?year=` — ADMIN/MANAGER only, `deletedAt:null + status:APPROVED`, streaming, `app.audit()` with `LEAVE_LIST_PDF`.
- Both endpoints: no response schema declared (per RESEARCH.md Pitfall 3), `tenantId: req.user.tenantId` on all queries.
- Added `import PDFDocument from "pdfkit"` and imports for new streaming utility functions.
- Added `buildEmployeeInclude(start, end)` helper to avoid duplicating the large Prisma include shape.

### apps/api/src/routes/__tests__/reports.test.ts

- Added 11 new integration tests across 4 describe blocks covering:
  - 200+application/pdf for ADMIN, 401, 403 for EMPLOYEE
  - role=MANAGER (200 or 404), role=EMPLOYEE (200), role=SUPERADMIN → normalizes to "all" (200)
  - Tenant isolation (two tenants, each gets valid PDF with %PDF magic bytes)
  - `GET /leave-list/pdf`: 200+application/pdf, 401, 403
  - `GET /monthly/pdf` PDF-04 backward compat: still returns %PDF buffer
- Total: 14 tests pass (3 existing + 11 new)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pageAdded infinite recursion in streaming PDF functions**
- **Found during:** Task 3 test execution
- **Issue:** `streamCompanyMonthlyReportPdf` caused `RangeError: Maximum call stack size exceeded` on first request. Root cause: `drawSmallFooter` called `doc.text()` inside `pageAdded` event handler. PDFKit's `text()` can trigger `continueOnNewPage` → `addPage` → `pageAdded` → `drawSmallFooter` → `text()` recursion.
- **Fix:** Added re-entrancy guard (`drawingFooter: boolean` flag) to both `streamCompanyMonthlyReportPdf` and `streamLeaveListPdf`. Also added `lineBreak: false` to footer text to prevent PDFKit overflow detection, and `doc.y = savedY` restore to prevent cursor advancement from footer drawing.
- **Files modified:** apps/api/src/utils/pdf.ts
- **Commit:** d330758

## Threat Surface Scan

All mitigations from the plan's threat register were implemented:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-06-01 | All Prisma queries include `tenantId: req.user.tenantId` |
| T-06-02 | `requireRole("ADMIN", "MANAGER")` on both new endpoints |
| T-06-03 | Role allowlist: `role === "MANAGER" ? "MANAGER" : role === "EMPLOYEE" ? "EMPLOYEE" : undefined` |
| T-06-04 | All LeaveRequest queries include `deletedAt: null AND status: "APPROVED"` |
| T-06-05 | Both endpoints call `app.audit()` with `action: "EXPORT"` |
| T-06-06 | Streaming via `doc.end() + reply.send(doc)` — no `Buffer.concat` in new endpoints |
| T-06-07 | TimeEntry queries include `isInvalid: false` |

No new threat surface introduced beyond what was planned.

## Self-Check: PASSED

- FOUND: apps/api/src/utils/pdf.ts
- FOUND: apps/api/src/routes/reports.ts
- FOUND: apps/api/src/routes/__tests__/reports.test.ts
- FOUND: cfcc499 (Task 1 — pdf.ts layout + streaming functions)
- FOUND: 64b0ea4 (Task 2 — new endpoints + computeEmployeeSummary)
- FOUND: d330758 (Bug fix — pageAdded re-entrancy guard)
- FOUND: 098ddc0 (Task 3 — integration tests, 14/14 pass)
