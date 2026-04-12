---
phase: 07-reporting-dashboards-berstunden-urlaub-anwesenheit
verified: 2026-04-11T22:00:00Z
status: human_needed
score: 16/16
overrides_applied: 0
human_verification:
  - test: "Open /reports as ADMIN or MANAGER, confirm Heutige Anwesenheit card renders with 4 summary chips and employee status table"
    expected: "Section shows Anwesend / Eingestempelt / Abwesend / Fehlend counters and a table with Name, Nr., Status columns; badges are colored correctly"
    why_human: "Client-side role guard + Chart.js rendering can only be confirmed visually in a browser"
  - test: "Click Mitarbeiter and Saldo (h) column headers on Überstunden-Übersicht table"
    expected: "Table re-sorts; arrow indicator toggles between asc/desc; no 'Canvas is already in use' browser console errors; sparklines redraw cleanly"
    why_human: "Chart.js destroy-before-recreate lifecycle and DOM behavior require browser observation"
  - test: "Open /reports as EMPLOYEE role"
    expected: "Heutige Anwesenheit, Überstunden-Übersicht, and Urlaubsübersicht sections are completely absent from the page"
    why_human: "Client-side role guard rendering requires browser verification"
  - test: "Change year selector in Urlaubsübersicht"
    expected: "Table reloads with data for the selected year; shows 'Keine Einträge für dieses Jahr' when appropriate"
    why_human: "Year-change trigger (onchange handler) behavior requires browser observation"
  - test: "Verify employee with ≥2 SaldoSnapshot entries shows a sparkline; employee with 0–1 snapshots shows '(kein Verlauf)' text"
    expected: "Sparklines render as 100×28 px Chart.js line charts; no blank canvas elements visible"
    why_human: "Chart.js canvas rendering requires visual confirmation"
---

# Phase 7: Reporting Dashboards — Verification Report

**Phase Goal:** Reporting Dashboards — Überstunden, Urlaub, Anwesenheit (RPT-01, RPT-02, RPT-03, SALDO-03)
**Verified:** 2026-04-11T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `GET /api/v1/dashboard/today-attendance` returns per-employee status + summary counts (tenant-scoped) | VERIFIED | Handler at dashboard.ts:291–443; 9 test cases passing in reports.test.ts:405 |
| 2 | `GET /api/v1/dashboard/overtime-overview` returns balanceHours + last-6-months SaldoSnapshot sparkline data | VERIFIED | Handler at dashboard.ts:446–512; 10 test cases passing in reports.test.ts:1037 |
| 3 | `GET /api/v1/reports/leave-overview` response includes `pendingDays` field per employee/leaveType/year | VERIFIED | Handler at reports.ts:367–419; `pendingMap` lookup at line 416; 6 test cases passing |
| 4 | All three endpoints guarded by `requireRole("ADMIN", "MANAGER")` and scoped by `tenantId` | VERIFIED | dashboard.ts lines 293, 448 use `requireRole("ADMIN", "MANAGER")`; reports.ts line 370 unchanged; tenant isolation verified by cross-tenant test cases |
| 5 | Integration tests cover: status resolution, bulk overtime list with snapshots, pendingDays arithmetic | VERIFIED | `reports.test.ts` — 25 new test cases (6 + 9 + 10) all passing; full suite: 48 tests passed |
| 6 | Manager opening /reports sees "Heutige Anwesenheit" card with summary chips + employee status table | VERIFIED | +page.svelte:638–693; `{#if isManager}` guard; `todayAttendance` state wired to `api.get("/dashboard/today-attendance")` in `onMount` |
| 7 | Manager sees "Überstunden-Übersicht" sortable table with Chart.js sparklines per employee | VERIFIED | +page.svelte:695–749; `sortedOvertime $derived.by()`; `toggleSort()` function; `Chart` instances created in `$effect` |
| 8 | Sparkline data comes from `carryOver` field of SaldoSnapshot returned by `/dashboard/overtime-overview` | VERIFIED | +page.svelte:253 — `s.carryOver / 60` explicitly maps carryOver to sparkline Y-axis |
| 9 | Table is sortable by employee name (asc/desc) and balanceHours (asc/desc) — client-side only | VERIFIED | `toggleSort()` at +page.svelte:477–484; `sortedOvertime` derived at lines 159–169; `onclick={() => toggleSort(...)}` on both headers |
| 10 | Sparklines destroyed and recreated via `Map<employeeId, Chart>` on sort/data change, no DOM leaks | VERIFIED | `sparklineCharts` Map at +page.svelte:190; `$effect` at 223–285 destroys before recreating; `onDestroy` at 215–219 clears all |
| 11 | Both Anwesenheit + Überstunden sections auto-load on mount for ADMIN/MANAGER; hidden for EMPLOYEE role | VERIFIED | `onMount` at +page.svelte:205–213 calls loaders only when `isManager`; `{#if isManager}` wraps both sections |
| 12 | Manager sees "Urlaubsübersicht" section on /reports with year selector | VERIFIED | +page.svelte:751–805; `leaveOverviewYear $state(currentYear)`, `onchange={loadLeaveOverview}` selector |
| 13 | Each row shows Mitarbeiter, Nr., Urlaubsart, Gesamt, Übertrag, Genommen, Geplant, Rest | VERIFIED | +page.svelte:776–785 — 8 column headers match spec; `pendingDays` wired to Geplant column at line 796 |
| 14 | Section defaults to current year and reloads on year change | VERIFIED | `leaveOverviewYear = $state(currentYear)` at +page.svelte:173; `onchange={loadLeaveOverview}` on select element |
| 15 | Data from `GET /api/v1/reports/leave-overview` (pendingDays included) | VERIFIED | +page.svelte:318–320 calls `/reports/leave-overview?year=${leaveOverviewYear}`; `pendingDays` used at line 796 |
| 16 | Urlaubsübersicht section only visible for ADMIN/MANAGER | VERIFIED | `{#if isManager}` wrapper at +page.svelte:752 |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/routes/dashboard.ts` | today-attendance and overtime-overview handlers | VERIFIED | Both handlers implemented with 5 and 2 bulk queries respectively; `resolvePresenceState` reused |
| `apps/api/src/routes/reports.ts` | leave-overview extended with pendingDays | VERIFIED | `pendingMap` lookup added to existing handler; no N+1 queries |
| `apps/api/src/routes/__tests__/reports.test.ts` | Integration tests for all 3 additions | VERIFIED | 3 new describe blocks: pendingDays (6 cases), today-attendance (9 cases), overtime-overview (10 cases) |
| `apps/web/src/routes/(app)/reports/+page.svelte` | Heutige Anwesenheit + Überstunden-Übersicht + Urlaubsübersicht sections | VERIFIED | All 3 sections present; Chart.js registered locally; use:registerCanvas action for canvas refs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `dashboard.ts` | `utils/presence.ts` | `resolvePresenceState()` reused for today-attendance | VERIFIED | Confirmed at dashboard.ts:259 (team-week) and 413 (today-attendance) |
| `dashboard.ts` | `prisma.overtimeAccount + prisma.saldoSnapshot` | Two bulk findMany calls | VERIFIED | `overtimeAccount.findMany` at line 453; `saldoSnapshot.findMany` at line 471 |
| `reports.ts` | `prisma.leaveRequest` | findMany for PENDING days per employee+leaveType+year | VERIFIED | `leaveRequest.findMany` with PENDING status + year filter at reports.ts:387 |
| `+page.svelte` | `/api/v1/dashboard/today-attendance` | `api.get()` in onMount guarded by authStore role | VERIFIED | `loadTodayAttendance()` at line 293; called from onMount at line 209 |
| `+page.svelte` | `/api/v1/dashboard/overtime-overview` | `api.get()` in onMount | VERIFIED | `loadOvertimeOverview()` at line 305; called from onMount at line 210 |
| `+page.svelte` | `chart.js` | Chart registration + Map<employeeId, Chart> for sparklines | VERIFIED | `new Chart(canvas, ...)` at line 259; `sparklineCharts` Map at line 190 |
| `+page.svelte` | `/api/v1/reports/leave-overview` | `api.get()` triggered by year change or on mount | VERIFIED | `loadLeaveOverview()` at line 313; `onchange={loadLeaveOverview}` at line 758 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `+page.svelte` — Heutige Anwesenheit | `todayAttendance` | `api.get("/dashboard/today-attendance")` → `dashboard.ts` handler → 5 bulk Prisma queries | Yes — real DB queries for employees, timeEntries, leaveRequests, absences, workSchedules | FLOWING |
| `+page.svelte` — Überstunden-Übersicht | `overtimeOverview` | `api.get("/dashboard/overtime-overview")` → `dashboard.ts` handler → 2 bulk Prisma queries | Yes — `overtimeAccount.findMany` + `saldoSnapshot.findMany` with real data | FLOWING |
| `+page.svelte` — Urlaubsübersicht | `leaveOverview` | `api.get("/reports/leave-overview")` → `reports.ts` handler → `leaveEntitlement.findMany` + `leaveRequest.findMany` | Yes — real entitlement data with PENDING days aggregated | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Reports test suite (48 tests) | `pnpm vitest run src/routes/__tests__/reports.test.ts` | 48 passed, 0 failed | PASS |
| `today-attendance` endpoint accessible | Verified via test injection: GET /api/v1/dashboard/today-attendance → 200 | 200 OK with `{date, employees[], summary{}}` | PASS |
| `overtime-overview` endpoint accessible | Verified via test injection | 200 OK with `{employees[]}` including `balanceHours`, `status`, `snapshots[]` | PASS |
| Role guard on both endpoints | Tests Case 8 (today-attendance) + Case 10 (overtime-overview) | 403 for EMPLOYEE role | PASS |
| Tenant isolation | Cross-tenant test cases in all 3 describe blocks | Tenant B data not returned to Tenant A caller | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RPT-01 | 07-01, 07-02 | Manager sieht Überstunden-Saldo aller Mitarbeiter in einer sortierbaren Tabelle mit Sparkline-Trend | SATISFIED | `/dashboard/overtime-overview` endpoint + Überstunden-Übersicht section with sortable table and Chart.js sparklines |
| RPT-02 | 07-01, 07-03 | Manager sieht Urlaubsübersicht (Resturlaub, genommen, geplant) | SATISFIED | `/reports/leave-overview` extended with `pendingDays` + Urlaubsübersicht section with Gesamt/Übertrag/Genommen/Geplant/Rest columns |
| RPT-03 | 07-01, 07-02 | Manager sieht Anwesenheitsübersicht des heutigen Tages | SATISFIED | `/dashboard/today-attendance` endpoint + Heutige Anwesenheit section with 4 summary chips |
| SALDO-03 | 07-01, 07-02 | Manager kann Saldo-Trend der letzten 6 Monate als Sparkline sehen | SATISFIED | SaldoSnapshot 6-month filter in `overtime-overview`; carryOver field mapped to Chart.js sparkline Y-axis |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `+page.svelte` | 256–257 | Hardcoded hex `#8b5a8c` as fallback in JS expression (not in `<style>` block) | Info | Only used when `--color-brand` CSS variable is absent; runtime-only fallback for Chart.js. Not a `<style>` violation per CLAUDE.md but minor consistency concern. |
| `+page.svelte` | 373, 556, 584 | DATEV download filename `.csv` and labels "CSV-Datei"/"CSV herunterladen" — should be `.txt`/TXT | Warning (regression) | Phase 6 fix (commit `1d14a67`) was overwritten by Phase 7-02 worktree merge (`ee0fe90`). DATEV LODAS import requires `.txt` extension. This is a pre-Phase-7 feature regression caused by merge overwrite, not new code introduced by Phase 7. |

### Human Verification Required

#### 1. Heutige Anwesenheit Card Visual Rendering

**Test:** Log in as ADMIN or MANAGER in docker compose, navigate to /reports, observe the Heutige Anwesenheit section.
**Expected:** Section appears immediately below `.reports-grid`; 4 summary chips display (Anwesend, Eingestempelt, Abwesend, Fehlend) with numeric values; employee table below shows Name, Nr., Status with colored badges.
**Why human:** Client-side data fetch + DOM rendering requires browser.

#### 2. Überstunden-Übersicht Sort Behavior and Sparklines

**Test:** Click Mitarbeiter column header; then click Saldo (h) header; toggle each multiple times. Observe browser console for errors.
**Expected:** Arrow indicator flips between ▲/▼; rows re-sort correctly; sparklines redraw without "Canvas is already in use" console errors. Employees with <2 snapshots show "(kein Verlauf)" text.
**Why human:** Chart.js canvas lifecycle and sort behavior requires browser observation.

#### 3. EMPLOYEE Role Guard

**Test:** Log in as an EMPLOYEE role user, navigate to /reports.
**Expected:** The three new sections (Heutige Anwesenheit, Überstunden-Übersicht, Urlaubsübersicht) are completely absent. Existing Monatsbericht and DATEV Export cards are still visible.
**Why human:** Client-side `{#if isManager}` conditional requires browser rendering verification.

#### 4. Urlaubsübersicht Year Selector

**Test:** Navigate to /reports as ADMIN; observe Urlaubsübersicht defaults to current year; change year selector to a prior year.
**Expected:** Table reloads; if data exists for prior year, rows update; if no data, "Keine Einträge für dieses Jahr" placeholder appears.
**Why human:** `onchange` handler trigger and API reload requires browser.

#### 5. Sparkline Rendering for Employees with Snapshots

**Test:** Ensure at least one employee has ≥2 MONTHLY SaldoSnapshot rows in the DB (last 6 months). View Überstunden-Übersicht.
**Expected:** Sparkline canvas renders as a small line chart (100×28 px) with brand color line.
**Why human:** Canvas rendering requires visual confirmation.

### Gaps Summary

No blocking gaps found. All 16 must-have truths are verified programmatically. The 48-test `reports.test.ts` suite passes with 0 failures.

**Notable findings (non-blocking):**

1. **DATEV regression (Warning):** The Phase 7-02 worktree merge overwrote the `fix(datev): rename button label CSV → TXT` fix (commit `1d14a67`). The `downloadDatev()` function at +page.svelte:373 still uses `.csv` extension and the button label still reads "CSV herunterladen". This is a DATEV-02 (Phase 4) regression, not a Phase 7 requirement failure. It should be re-applied in a subsequent fix commit.

2. **Sequential async loaders (Info):** `onMount` calls `loadTodayAttendance()`, `loadOvertimeOverview()`, and `loadLeaveOverview()` sequentially with `await`. These are independent API calls that could run in parallel with `Promise.all`. Not a correctness issue — just a performance improvement opportunity noted in REVIEW.md (IN-03).

3. **Hex fallback in JS (Info):** `"#8b5a8c"` at +page.svelte:257 is a Chart.js runtime fallback for when `--color-brand` is unavailable. Per CLAUDE.md, hex literals are prohibited in `<style>` blocks; this is in a `<script>` expression as a safe fallback. Not a violation but worth tracking.

---

_Verified: 2026-04-11T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
