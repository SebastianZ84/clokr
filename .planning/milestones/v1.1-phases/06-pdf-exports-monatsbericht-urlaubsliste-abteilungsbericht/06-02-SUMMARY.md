---
phase: 06-pdf-exports-monatsbericht-urlaubsliste-abteilungsbericht
plan: "02"
subsystem: web-reports-ui
tags: [pdf, reports, svelte5, frontend, company-monthly, leave-list, ui]
dependency_graph:
  requires:
    - GET /api/v1/reports/monthly/pdf/all (from 06-01)
    - GET /api/v1/reports/leave-list/pdf (from 06-01)
  provides:
    - /reports page — Firmenweiter Monatsbericht card (PDF-01/PDF-03)
    - /reports page — Urlaubsliste PDF card (PDF-02)
  affects:
    - apps/web/src/routes/(app)/reports/+page.svelte
tech_stack:
  added: []
  patterns:
    - Svelte 5 $state() for reactive download state
    - Existing downloadPdf() utility reused for both new handlers
    - Existing .report-card CSS classes reused (no new CSS added)
key_files:
  created: []
  modified:
    - apps/web/src/routes/(app)/reports/+page.svelte
decisions:
  - No new CSS rules added — both new cards reuse existing .report-card, .report-controls, .form-group CSS classes
  - Role selector uses string literals ("all" | "EMPLOYEE" | "MANAGER") matching the API's expected values exactly
  - companyPdfRole typed as union type for compile-time safety
metrics:
  duration_minutes: 10
  tasks_completed: 1
  tasks_total: 2
  files_modified: 1
  completed_date: "2026-04-11"
requirements:
  - PDF-01
  - PDF-02
  - PDF-03
---

# Phase 06 Plan 02: PDF Exports — Frontend Report Cards Summary

Two new report cards added to /reports page wiring the Plan 06-01 backend endpoints (company monthly PDF with role filter + vacation list PDF) to the user interface using Svelte 5 runes, the existing downloadPdf() utility, and the existing .report-card CSS pattern.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add Firmenweiter Monatsbericht + Urlaubsliste PDF cards + download handlers | bab221e | apps/web/src/routes/(app)/reports/+page.svelte |
| 2 | Human verification checkpoint | PENDING | — |

## Changes Made

### apps/web/src/routes/(app)/reports/+page.svelte

**New state variables (added after existing `leaveError` block):**
- `companyPdfMonth` — selected month (default: currentMonth)
- `companyPdfYear` — selected year (default: currentYear)
- `companyPdfRole` — typed `"all" | "EMPLOYEE" | "MANAGER"` (default: "all")
- `companyPdfLoading` — loading state for company monthly PDF download
- `companyPdfError` — error message for company monthly PDF download
- `leaveListYear` — selected year for vacation list PDF (default: currentYear)
- `leaveListLoading` — loading state for vacation list PDF download
- `leaveListError` — error message for vacation list PDF download

**New download handlers (added after existing `downloadLeaveOverviewPdf`):**
- `downloadCompanyMonthlyPdf()` — calls `downloadPdf("/reports/monthly/pdf/all?month=...&year=...&role=...", "Monatsbericht_Alle_{year}_{MM}.pdf")`
- `downloadLeaveListPdf()` — calls `downloadPdf("/reports/leave-list/pdf?year=...", "Urlaubsliste_{year}.pdf")`

**Updated page subtitle:** "Monatsberichte und DATEV-Exporte erstellen" → "Monatsberichte, Urlaubslisten und DATEV-Exporte erstellen"

**New cards in .reports-grid:**
1. "Firmenweiter Monatsbericht" card — `report-card-icon-section--purple`, month/year/role selectors, "PDF herunterladen" button, loading/error states
2. "Urlaubsliste PDF" card — `report-card-icon-section--blue`, year selector, "PDF herunterladen" button, loading/error states

**No new CSS added** — both cards use existing `.report-card`, `.report-controls`, `.form-group`, `.btn`, `.btn-primary`, `.btn-spinner`, `.alert`, `.alert-error` classes.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

The threat model mitigations from the plan were verified:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-06-10 | Error text uses `{companyPdfError}` / `{leaveListError}` Svelte interpolation (auto-escapes) — no `{@html}` used |
| T-06-12 | /reports already gated by `(app)` layout group auth guard — no new guard needed |
| T-06-13 | Download uses Bearer token in Authorization header via existing `downloadPdf()` utility |

## Automated Verification

- `svelte-check` run on apps/web — no errors in `reports/+page.svelte`. Pre-existing errors in other files (dashboard, time-entries, login pages) are out of scope and pre-date this plan.
- Svelte 5 compliance: uses `$state()`, `onclick={fn}` (not `on:click`), no `{@const}` in divs, no hex colors in style block.

## Human Verification Checkpoint

**Status: PENDING** — Task 2 is a `checkpoint:human-verify`. User must complete the 13-step verification defined in the plan.

## Known Stubs

None — both download handlers call live backend endpoints. The role selector has three real values that the API validates.

## Self-Check: PASSED

- FOUND: apps/web/src/routes/(app)/reports/+page.svelte
- FOUND: bab221e (Task 1 — two new cards + download handlers)
- Verified: `companyPdfMonth`, `companyPdfYear`, `companyPdfRole`, `companyPdfLoading`, `companyPdfError` exist in script
- Verified: `leaveListYear`, `leaveListLoading`, `leaveListError` exist in script
- Verified: `downloadCompanyMonthlyPdf()` and `downloadLeaveListPdf()` functions exist
- Verified: page subtitle updated to include "Urlaubslisten"
- Verified: "Firmenweiter Monatsbericht" text exists in card HTML
- Verified: "Urlaubsliste PDF" text exists in card HTML
- Verified: role selector has three options (all/EMPLOYEE/MANAGER)
- Verified: no new CSS rules added to `<style>` block
