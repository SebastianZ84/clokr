---
phase: 09-widget-menu-page-redesign-clockodeo
plan: "03"
subsystem: frontend/ui
tags: [visual-polish, glass-cards, card-animate, admin-layout, route-deletion]
dependency_graph:
  requires: [09-01]
  provides: [D-05, D-06, D-09]
  affects:
    - apps/web/src/routes/(app)/time-entries/+page.svelte
    - apps/web/src/routes/(app)/leave/+page.svelte
    - apps/web/src/routes/(app)/admin/+layout.svelte
    - apps/web/src/routes/(app)/admin/employees/+page.svelte
    - apps/web/src/routes/(app)/admin/system/+page.svelte
    - apps/web/src/routes/(app)/admin/audit/+page.svelte
    - apps/web/src/routes/(app)/admin/import/+page.svelte
tech_stack:
  added: []
  patterns: [glass-card-surface, card-animate-entrance, global-section-header-CSS]
key_files:
  created: []
  modified:
    - apps/web/src/routes/(app)/time-entries/+page.svelte
    - apps/web/src/routes/(app)/leave/+page.svelte
    - apps/web/src/routes/(app)/admin/+layout.svelte
    - apps/web/src/routes/(app)/admin/employees/+page.svelte
    - apps/web/src/routes/(app)/admin/system/+page.svelte
    - apps/web/src/routes/(app)/admin/audit/+page.svelte
    - apps/web/src/routes/(app)/admin/import/+page.svelte
  deleted:
    - apps/web/src/routes/(app)/overtime/+page.svelte
decisions:
  - "Retain modal backgrounds (background:#fff) in vacation and employees — modals are not card surfaces"
  - "shifts, shutdowns, special-leave, vacation, monatsabschluss: no .card overrides found, no h2 section headers inside cards — no changes applied"
  - "section-header CSS placed as :global() in admin/+layout.svelte so all child sub-pages inherit without re-declaring"
  - "audit/import h2 inline styles removed in favor of .section-header class (cleaner, theme-aware)"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-12"
  tasks_completed: 3
  files_changed: 8
  files_deleted: 1
---

# Phase 09 Plan 03: Route Deletion, Page Polish & Admin Consistency Summary

**One-liner:** Deleted /overtime route, applied card-animate entrance animation to Zeiterfassung/Abwesenheiten pages, replaced hardcoded white card background in admin/employees with global glass card, and introduced a :global(.section-header) CSS rule for consistent admin section headers.

## What Was Done

### Task 1: Delete /overtime Route (commit 9e8f81e)
- Deleted `apps/web/src/routes/(app)/overtime/+page.svelte` and the empty `overtime/` directory
- Confirmed no `href="/overtime"` navigation links exist anywhere in `apps/web/src/`
- API endpoints `/overtime/:employeeId` and `/overtime/close-month` remain intact (not affected)

### Task 2: Visual Polish — time-entries and leave pages (commit 554d1d3)
- **time-entries:** Added `card-animate` to `.employee-selector` div; upgraded `.cal-nav` from hardcoded `var(--gray-50)` / `var(--gray-200)` to theme tokens `var(--color-bg-subtle)` / `var(--color-border-subtle)`
- **leave:** Added `card-animate` to `.employee-selector` div and `.vac-summary` block
- Both pages already had `card-animate` on `.month-summary`, `.cal-section`, and alert elements (confirmed, no duplicate changes)

### Task 3: Admin Pages — Glass Card Fix + Section Headers (commit ad8ae7a)
- **admin/+layout.svelte:** Added `:global(.section-header)` CSS rule (1.25rem/600, border-bottom: 1px solid var(--color-border-subtle)) — available to all child sub-pages via {#render children}
- **admin/employees:** Removed local `.card { background: #fff; border: ...; border-radius: ...; overflow: hidden }` override — global `.card` glass surface now applies
- **admin/employees:** Added `card-animate` to main table card div
- **admin/system:** Added `card-animate` to `sys-card`, API Keys settings-card, and Phorest settings-card; upgraded `<h2>` headings for API Keys, DATEV Export, and Phorest-Integration to use `class="section-header"`
- **admin/audit:** Replaced `<h2 style="font-size:1.125rem;font-weight:600;">` inline style with `class="section-header"` (theme-aware)
- **admin/import:** Replaced `<h2 style="...">` inline style with `class="section-header"`; added `card-animate` to the CSV input card
- **shifts, shutdowns, special-leave, vacation, monatsabschluss:** No `.card { background: #fff }` overrides found; h2 elements are either page-title headers or modal-title elements — no changes applied (correct per plan scope)

## Deviations from Plan

None — plan executed exactly as written.

The plan's "Change 7 for remaining admin sub-pages" said to inspect each file and only apply changes where patterns exist. After reading each file:
- shifts: no .card containers, h2 is a page-title (not a card section header)
- shutdowns: same as shifts
- special-leave: h2 elements are modal-title elements (inside modal dialogs)
- vacation: background:#fff is on .modal-header (sticky modal chrome, not a card override)
- monatsabschluss: no .card containers

This is expected per the plan's scope boundary: "do not force glass on non-card containers like modals or form dialogs."

## Threat Flags

None. Changes are CSS-only visual modifications. Auth enforcement and data access patterns are unaffected.

## Known Stubs

None. No data stubs introduced. All changes are visual (class additions and CSS rule changes).

## Self-Check

**Files verified:**

- `apps/web/src/routes/(app)/overtime/+page.svelte` — DELETED (confirmed)
- `apps/web/src/routes/(app)/overtime/` — DELETED (confirmed)
- `apps/web/src/routes/(app)/time-entries/+page.svelte` — FOUND with 3 card-animate classes
- `apps/web/src/routes/(app)/leave/+page.svelte` — FOUND with 4 card-animate classes
- `apps/web/src/routes/(app)/admin/+layout.svelte` — FOUND with :global(.section-header)
- `apps/web/src/routes/(app)/admin/employees/+page.svelte` — FOUND, no .card override

**Commits verified:**
- 9e8f81e — feat(09-03): delete /overtime route and directory (D-05)
- 554d1d3 — feat(09-03): visual polish — glass cards and card-animate on time-entries and leave (D-06)
- ad8ae7a — feat(09-03): admin pages — glass card fix + section headers (D-09)

## Self-Check: PASSED
