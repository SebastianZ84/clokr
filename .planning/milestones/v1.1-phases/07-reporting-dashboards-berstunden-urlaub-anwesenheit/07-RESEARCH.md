# Phase 7: Reporting Dashboards — Überstunden, Urlaub, Anwesenheit — Research

**Researched:** 2026-04-11
**Domain:** Fastify REST API + Svelte 5 dashboard UI (reporting layer over existing Prisma models)
**Confidence:** HIGH — all findings verified against actual codebase files

## Summary

Phase 7 adds three manager-facing reporting views on top of an existing, well-structured API. The most important discovery is that **all underlying data models already exist** (OvertimeAccount, SaldoSnapshot, LeaveEntitlement, LeaveRequest, Absence) and two relevant API patterns are already proven in production (team-week presence aggregation in dashboard.ts, leave-overview in reports.ts). No new schema migrations are required.

The phase requires three new API endpoints (one per RPT requirement + SALDO-03 which piggybacks on the overtime table endpoint), and one new frontend page route or extension of `/reports`. The `resolvePresenceState()` utility (RPT-04, completed in Phase 5) can be reused verbatim for RPT-03 — the today's-attendance view is a specialised single-day call to the same pattern used in `team-week`.

The primary architectural risk is N+1 queries: multi-employee endpoints must bulk-fetch all data up front and group in memory, never calling per-employee queries inside a loop. The existing `team-week` handler in `dashboard.ts` shows the correct pattern — five parallel `findMany` calls followed by in-memory grouping.

**Primary recommendation:** Three new GET endpoints in `dashboard.ts` (or a new `reports-dashboards.ts` route file), one new frontend page `/reports/dashboards` (or extend `/reports`), reuse `resolvePresenceState()` for RPT-03 without any modification.

---

## Project Constraints (from CLAUDE.md)

- Soft delete: ALL queries on TimeEntry, LeaveRequest, Absence MUST include `deletedAt: null`
- Tenant isolation: ALL queries filter by `tenantId: req.user.tenantId`
- Role guards: manager-facing endpoints use `requireRole("ADMIN", "MANAGER")`
- Audit logs: `app.audit()` required on every export/download action; viewing data (GET) does not require audit log
- Svelte 5 runes: `$state`, `$derived`, `$effect` — no Svelte 4 syntax
- UI: `card-animate` class on every primary content block; CSS custom properties only (no hardcoded hex); glass surfaces on top-level cards
- Language: UI labels in German, code/comments in English
- No hard deletes, no locked-month edits
- Chart.js is already registered in `dashboard/+page.svelte` — reuse registration pattern if charting on the same page; for new pages, register needed controllers only

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RPT-01 | Manager sieht Überstunden-Saldo aller Mitarbeiter in einer sortierbaren Tabelle mit Sparkline-Trend | OvertimeAccount.balanceHours exists and is O(1) (SALDO-01 done). SaldoSnapshot rows per employee exist for sparkline data. Need: new GET /dashboard/overtime-overview endpoint + sortable table + sparkline column in UI |
| RPT-02 | Manager sieht Urlaubsübersicht aller Mitarbeiter (Resturlaub, genommen, geplant) | GET /reports/leave-overview already returns all LeaveEntitlement rows for the tenant/year. Need: frontend view consuming this endpoint |
| RPT-03 | Manager sieht Anwesenheitsübersicht des heutigen Tages (da / Urlaub / krank) | resolvePresenceState() is ready. team-week in dashboard.ts shows the exact pattern (bulk fetch, in-memory group). Need: single-day "today" endpoint variant + frontend view |
| SALDO-03 | Manager kann Saldo-Trend der letzten 6 Monate als Sparkline pro Mitarbeiter sehen | SaldoSnapshot model with MONTHLY periodType rows exists. GET /overtime/snapshots/:employeeId already returns all snapshots per employee. Need: bulk snapshot endpoint (all employees, last 6 months) for efficient sparkline rendering |
</phase_requirements>

---

## What's Already Built

### API Endpoints (Verified Against Codebase)

| Endpoint | File | What it Returns | Usable for |
|----------|------|-----------------|------------|
| `GET /api/v1/dashboard` | dashboard.ts:18 | Personal stats (today, week, overtime, vacation) for current user | — (personal only) |
| `GET /api/v1/dashboard/team-week?date=` | dashboard.ts:107 | All employees × 7 days: presence status, workedHours, shift, isWorkday | RPT-03 (today is a subset of team-week) |
| `GET /api/v1/dashboard/open-items` | dashboard.ts:346 | Per-employee missing days, pending requests, invalid entries | — |
| `GET /api/v1/overtime/:employeeId` | overtime.ts:29 | Single employee OvertimeAccount (balanceHours, transactions, status) | RPT-01 (per employee, but no bulk endpoint) |
| `GET /api/v1/overtime/snapshots/:employeeId` | overtime.ts:846 | All SaldoSnapshot rows for one employee | SALDO-03 (but per employee — no bulk endpoint) |
| `GET /api/v1/reports/monthly` | reports.ts:312 | All employees × month: workedHours, shouldHours, sickDays, vacationDays | Used by /reports page table and dashboard charts |
| `GET /api/v1/reports/leave-overview` | reports.ts:367 | All LeaveEntitlement rows for tenant × year with employee + leaveType | **Directly usable for RPT-02** — returns remainingDays, usedDays, totalDays |
| `GET /api/v1/leave/entitlements/:employeeId` | leave.ts:1250 | Entitlements for one employee | — (per employee, no bulk) |

**Critical gap:** No endpoint returns `OvertimeAccount` for ALL employees in one call (needed for RPT-01 sortable table). No endpoint returns SaldoSnapshot for all employees × last N months in one call (needed for SALDO-03 sparklines).

### Frontend Pages (Verified Against Codebase)

| Page | Route | What Exists |
|------|-------|-------------|
| `/dashboard` | `(app)/dashboard/+page.svelte` | Personal stats cards, team-week grid, my-week widget, open-items, Chart.js charts (bar + line × 2), 5s polling for team-week |
| `/reports` | `(app)/reports/+page.svelte` | 4 cards: Monatsbericht (table view), DATEV Export, Urlaubsbericht PDF, Firmenweiter Monatsbericht PDF. No manager dashboard views. |

**The `/reports` page currently has NO dynamic manager dashboard views** — it only has report cards that trigger PDF/file downloads or load a paginated table. RPT-01, RPT-02, RPT-03 need interactive dashboard-style views, NOT just download buttons.

### Utilities (Verified)

| Utility | File | Signature | Notes |
|---------|------|-----------|-------|
| `resolvePresenceState()` | `apps/api/src/utils/presence.ts` | `(params: {entries, leave, absence, isWorkday, isFuture, hasShift}) → {status, reason}` | Pure function, no DB dependency. 13 unit tests passing. Directly reusable for RPT-03. |
| `computeEmployeeSummary()` | `apps/api/src/routes/reports.ts:88` | `(emp, start, end, tz) → {workedHours, targetHours, vacationDays, ...}` | Module-level in reports.ts. Used by monthly and PDF endpoints. |
| `buildEmployeeInclude()` | `apps/api/src/routes/reports.ts:282` | `(start, end) → Prisma include shape` | Avoids duplicating the large include shape. Reusable. |

### Chart.js Integration (Verified)

`dashboard/+page.svelte` already imports and registers: `BarController`, `LineController`, `DoughnutController`, `BarElement`, `LineElement`, `PointElement`, `ArcElement`, `CategoryScale`, `LinearScale`, `Tooltip`, `Legend`, `Filler`. The charting pattern uses `bind:this` canvas refs, `tick()` after flipping `chartsLoading` flag, and `chart.destroy()` in `onDestroy`.

For sparklines in a table row, a mini Canvas element (e.g. 80×24px) with `type: "line"`, `pointRadius: 0`, no axes, no legend is the correct pattern. Each sparkline is a separate Chart.js instance.

### Schema Models (Verified from schema.prisma)

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `SaldoSnapshot` | `employeeId, periodType (MONTHLY/YEARLY), periodStart, periodEnd, workedMinutes, expectedMinutes, balanceMinutes, carryOver, closedAt` | Unique constraint: `(employeeId, periodType, periodStart)`. Index on `(employeeId, periodType)`. |
| `OvertimeAccount` | `employeeId (unique), balanceHours (Decimal 7,2), updatedAt` | One per employee. Updated by `updateOvertimeAccount()` on every write. |
| `LeaveEntitlement` | `employeeId, leaveTypeId, year, totalDays, usedDays, carriedOverDays, carryOverDeadline` | Unique: `(employeeId, leaveTypeId, year)`. |
| `LeaveRequest` | `employeeId, startDate, endDate, status (APPROVED/PENDING/CANCELLATION_REQUESTED/CANCELLED/REJECTED), days, deletedAt` | Soft delete. |
| `Absence` | `employeeId, startDate, endDate, type (SICK/SICK_CHILD/MATERNITY/PARENTAL), deletedAt` | Soft delete. |

---

## What Needs to Be Built

### New API Endpoints Required

| Endpoint | For | Status | Complexity |
|----------|-----|--------|------------|
| `GET /api/v1/dashboard/overtime-overview` | RPT-01 + SALDO-03 | NEW | Medium — bulk OvertimeAccount + SaldoSnapshot join in 2 queries |
| `GET /api/v1/dashboard/today-attendance` | RPT-03 | NEW | Low — single-day specialization of team-week handler; reuses resolvePresenceState() |
| — | RPT-02 | NONE NEEDED | `GET /api/v1/reports/leave-overview` already exists and returns exactly what's needed |

### New Frontend Work Required

| Requirement | What to Build | Where |
|-------------|--------------|-------|
| RPT-01 | Sortable table: employee name, current saldo, trend badge, sparkline mini-chart | New section on `/reports` page or new `/reports/dashboards` sub-route |
| RPT-02 | Table: employee name, leaveType, total, used, carried-over, remaining, deadline | New section on `/reports` page (calls existing `/reports/leave-overview`) |
| RPT-03 | Status grid: employee rows with today status badge (anwesend/Urlaub/krank/fehlend) | New section on `/reports` page (calls new `/dashboard/today-attendance`) |
| SALDO-03 | Sparkline column in RPT-01 table (6-month trend of monthly balanceMinutes) | Part of RPT-01 table — data comes from the same `overtime-overview` endpoint |

**Decision on page structure:** All three dashboard views should go on `/reports` as new sections below the existing cards, consistent with how the Monatsbericht table already appears as a `{#if}` section below the cards. This avoids creating a new route and keeps "Berichte" as the single entry point for manager reporting.

---

## API Design

### RPT-03: `GET /api/v1/dashboard/today-attendance`

**Role guard:** `requireRole("ADMIN", "MANAGER")`
**No audit log required** (read-only view)

**Implementation pattern** (mirrors team-week but for today only):

```typescript
// Source: modeled on dashboard.ts team-week handler — verified pattern
const tz = await getTenantTimezone(app.prisma, tenantId);
const today = todayInTz(tz);

// 1. Bulk fetch all active employees for tenant
const employees = await app.prisma.employee.findMany({
  where: { tenantId, exitDate: null, user: { isActive: true } },
  select: { id: true, firstName: true, lastName: true, employeeNumber: true },
  orderBy: { lastName: "asc" },
});

// 2. Bulk fetch time entries for today (single query, NOT per employee)
const timeEntries = await app.prisma.timeEntry.findMany({
  where: { employee: { tenantId }, deletedAt: null, date: today, type: "WORK" },
  select: { employeeId: true, endTime: true, isInvalid: true },
});

// 3. Bulk fetch leaves overlapping today
const leaves = await app.prisma.leaveRequest.findMany({
  where: {
    employee: { tenantId },
    status: { in: ["APPROVED", "CANCELLATION_REQUESTED"] },
    startDate: { lte: today }, endDate: { gte: today },
    deletedAt: null,
  },
  select: { employeeId: true, status: true, leaveType: { select: { name: true } } },
});

// 4. Bulk fetch absences overlapping today
const absences = await app.prisma.absence.findMany({
  where: {
    employee: { tenantId },
    deletedAt: null,
    startDate: { lte: today }, endDate: { gte: today },
  },
  select: { employeeId: true, type: true },
});

// 5. In-memory grouping + resolvePresenceState() per employee
// Group by employeeId using Map, then call resolvePresenceState() for each
```

**Response shape:**
```typescript
{
  date: string; // "2026-04-11"
  employees: Array<{
    id: string;
    name: string;
    employeeNumber: string;
    status: "present" | "absent" | "clocked_in" | "missing" | "scheduled" | "none";
    reason: string | null; // e.g. "Urlaub", "Krankmeldung", null
  }>;
  summary: {
    present: number;
    absent: number;
    clockedIn: number;
    missing: number;
  };
}
```

**Note on `isWorkday` and `isFuture`:** For today's attendance, `isFuture` is always false. `isWorkday` requires a WorkSchedule lookup per employee. To avoid N+1: bulk-fetch all active schedules in one query (same pattern as team-week lines 181-186), then look up per employee in memory.

### RPT-01 + SALDO-03: `GET /api/v1/dashboard/overtime-overview`

**Role guard:** `requireRole("ADMIN", "MANAGER")`

**Implementation:** Two queries (not N+1):

```typescript
// Query 1: All OvertimeAccounts for tenant employees
const accounts = await app.prisma.overtimeAccount.findMany({
  where: { employee: { tenantId } },
  include: {
    employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
  },
  orderBy: { employee: { lastName: "asc" } },
});

// Query 2: Last 6 monthly SaldoSnapshots for each employee (bulk)
const sixMonthsAgo = /* compute first day of month 6 months ago */;
const snapshots = await app.prisma.saldoSnapshot.findMany({
  where: {
    employeeId: { in: accounts.map(a => a.employeeId) },
    periodType: "MONTHLY",
    periodStart: { gte: sixMonthsAgo },
  },
  orderBy: { periodStart: "asc" },
  select: { employeeId: true, periodStart: true, balanceMinutes: true, carryOver: true },
});

// Group snapshots by employeeId in memory, attach to each account row
```

**Response shape:**
```typescript
{
  employees: Array<{
    id: string;
    name: string;
    employeeNumber: string;
    balanceHours: number;          // from OvertimeAccount.balanceHours
    status: "NORMAL" | "ELEVATED" | "CRITICAL"; // same logic as overtime.ts:66-69
    snapshots: Array<{             // last 6 MONTHLY entries, for sparkline
      periodStart: string;         // "2026-01-01"
      balanceMinutes: number;
      carryOver: number;
    }>;
  }>;
}
```

**Sorting:** Handled client-side — the endpoint returns all rows, the frontend table sorts in memory on `balanceHours`. This avoids pagination complexity and is reasonable for up to ~200 employees.

### RPT-02: No New Endpoint Needed

`GET /api/v1/reports/leave-overview?year=` already returns:
```typescript
Array<{
  employee: { firstName, lastName, employeeNumber },
  leaveType: { name, ... },
  year: number,
  totalDays: number,
  carriedOverDays: number,
  usedDays: number,
  remainingDays: number, // computed in endpoint: totalDays + carriedOverDays - usedDays
}>
```

The frontend should call this endpoint and display the data in a table grouped by employee. The existing `/reports` page already has `loadMonthlyReport()` as a pattern for a button-triggered data load.

**Caveat:** The leave-overview endpoint does NOT include "planned" days (approved future leave requests not yet taken). RPT-02 says "Resturlaub, genommen, geplant". The existing `remainingDays` field represents remaining entitlement, not future-planned days. The planner should clarify: either (a) add planned days to the existing endpoint response, or (b) interpret "geplant" as "pending" leave that hasn't been approved yet. Based on the data model, a clean addition would be: fetch count of PENDING leave days per employee separately and add as `plannedDays` field.

**Recommendation for planner:** Add a `pendingDays` field to the leave-overview response (count of days in PENDING leave requests for the year). This is one additional `findMany` or a group-by in the same endpoint.

---

## Frontend Design

### Page Structure

All three dashboard views added as new sections on the existing `/reports` page (`apps/web/src/routes/(app)/reports/+page.svelte`).

Add below the existing `.reports-grid` cards:

```
[existing: 4 report cards in .reports-grid]
[NEW: "Manager Dashboard" section header]
[NEW: RPT-03: Heute Anwesenheit (status grid, auto-loads on mount)]
[NEW: RPT-01+SALDO-03: Überstunden-Übersicht (sortable table + sparklines, loads on button click or mount)]
[NEW: RPT-02: Urlaubsübersicht (table with year selector, loads on button click)]
```

Auto-load RPT-03 (today's attendance) on mount since managers expect it immediately. RPT-01 and RPT-02 can load on mount too — the data is not expensive.

### Sorting (RPT-01)

Client-side only. State variables:
```typescript
let sortColumn = $state<"name" | "balance">("name");
let sortDir = $state<"asc" | "desc">("asc");
let sortedRows = $derived(/* sort overtimeRows by sortColumn+sortDir */);
```

Click on column header toggles direction. Use `$derived` for sorted array — never mutate state directly.

### Sparklines (SALDO-03)

Each row in the RPT-01 table gets a `<canvas>` element (80×24px or 100×28px). Chart.js `type: "line"` with:
- `pointRadius: 0` (no dots)
- No x/y axes, no legend, no title
- No grid lines
- `fill: true` with brand-color + 20% alpha
- `responsive: false`, fixed pixel size
- `borderWidth: 1.5`

Lifecycle: create Chart instances in `$effect(() => { ... })` that watches `overtimeRows`. Destroy all on page unmount (`onDestroy`).

**Critical:** Each canvas element needs a unique `bind:this` ref. In a table `{#each}` loop, use an array of refs:

```svelte
<!-- Svelte 5 approach — bind:this in each loop -->
{#each sortedRows as row, i (row.id)}
  <canvas bind:this={sparklineEls[i]} width="80" height="24"></canvas>
{/each}
```

Then in a `$effect` that watches `sortedRows`, destroy old charts and create new ones. The pattern is established in `dashboard/+page.svelte` (see `weeklyChart?.destroy()` + `new Chart()`).

**CLAUDE.md gotcha:** `{@const}` cannot be used in `{#each}` template for computed values — use `$derived` at script level or inline expressions.

### Status Badges (RPT-03)

Use CSS custom properties for colors (no hardcoded hex per CLAUDE.md):

```css
.status-present { background: var(--color-green-bg); color: var(--color-green); }
.status-absent { background: var(--color-yellow-bg); color: var(--color-yellow); }
.status-missing { background: var(--color-red-bg); color: var(--color-red); }
.status-clocked-in { background: var(--color-brand-tint); color: var(--color-brand); }
.status-scheduled { background: var(--color-bg-subtle); color: var(--color-text-muted); }
```

German labels: `present/clocked_in` → "Anwesend", `absent` → reason string, `missing` → "Fehlend", `scheduled` → "Geplant".

---

## Pitfalls

### Pitfall 1: N+1 Queries in Multi-Employee Endpoints
**What goes wrong:** Calling `prisma.overtimeAccount.findUnique()` or `prisma.saldoSnapshot.findMany()` inside a `for...of employees` loop creates N+1 DB round trips. With 50 employees this is 50 separate queries.
**Why it happens:** The single-employee patterns in `overtime.ts` look straightforward and get copy-pasted into a loop.
**How to avoid:** Fetch ALL accounts/snapshots in one query with `employeeId: { in: [...] }`, then group in memory with a `Map<string, T>`.
**Warning signs:** Any `await prisma.*` call inside a `for` loop.

### Pitfall 2: SaldoSnapshot May Be Empty (SALDO-03)
**What goes wrong:** SaldoSnapshot rows only exist after a `POST /overtime/close-month` is called. For a fresh tenant with no closed months, `snapshots` array will be empty for every employee.
**Why it happens:** Monatsabschluss is a manual manager action, not automatic (auto-close cron exists but may not have fired).
**How to avoid:** Sparkline falls back gracefully when `snapshots.length === 0` — render empty canvas or placeholder text. Do NOT fail the endpoint or hide the row.
**Warning signs:** Chart.js will throw if `data` array is empty and `labels` is also empty — always ensure labels.length === data.length.

### Pitfall 3: Chart.js in {#each} — Canvas Refs Array
**What goes wrong:** In a `{#each}` loop, `bind:this` on canvas elements doesn't work with a fixed variable — you need an array. If rows re-order (sort direction changes), old Chart instances on detached canvases cause "canvas already in use" errors.
**Why it happens:** Chart.js attaches to the DOM canvas element; when Svelte re-renders the list, canvases get re-created.
**How to avoid:** Keep a `Map<string, Chart>` keyed by employee ID. In `$effect` watching `sortedRows`, iterate the map and call `.destroy()` on removed entries, create new entries for new/changed rows. Call `chart.destroy()` before `new Chart(canvas, ...)`.
**Warning signs:** Console error "Canvas is already in use" or memory leaks on re-sort.

### Pitfall 4: leave-overview Doesn't Include Pending/Planned Days
**What goes wrong:** RPT-02 says "geplant" — but `GET /reports/leave-overview` only returns entitlement totals (used, remaining). Pending or future-approved leave days are not in the response.
**Why it happens:** The endpoint was built for the "how much vacation is left" use case, not "what is planned".
**How to avoid:** Either extend the endpoint to include a `pendingDays` field, or call an additional request and merge client-side. The cleaner approach is extending the backend response.

### Pitfall 5: `requireRole` vs `requireAuth` for today-attendance
**What goes wrong:** Using `requireAuth` instead of `requireRole("ADMIN", "MANAGER")` would let employees see all colleagues' attendance.
**Why it happens:** Copy-paste from personal dashboard endpoint which uses `requireAuth`.
**How to avoid:** All three new endpoints (`overtime-overview`, `today-attendance`) MUST use `requireRole("ADMIN", "MANAGER")`.

### Pitfall 6: `isWorkday` Requires Schedule Bulk Fetch for RPT-03
**What goes wrong:** `resolvePresenceState()` needs `isWorkday` which requires knowing the employee's schedule. Calling `getEffectiveSchedule()` per employee in a loop = N+1.
**How to avoid:** Bulk fetch `WorkSchedule.findMany({ where: { employeeId: { in: [...] }, validFrom: { lte: today } }, orderBy: { validFrom: "desc" } })`. Then find the relevant schedule per employee in memory (same pattern as `team-week` lines 181-186 in dashboard.ts).

### Pitfall 7: Svelte 5 `$state` Mutability
**What goes wrong:** Sorting in place with `overtimeRows.sort(...)` won't trigger reactivity because `$state` arrays track reference, not element mutations.
**How to avoid:** Use `$derived(overtimeRows.slice().sort(...))` for sorted display — never mutate the state array directly. This is already the pattern used in the existing reports page (`reportRows.slice(...)` for pagination).

---

## Code Examples

### Bulk-fetch + group pattern for N+1 avoidance
```typescript
// Source: verified pattern from dashboard.ts lines 119-285
// Fetch all data up front, group in memory
const employeeMap = new Map(employees.map(e => [e.id, e]));
const entryMap = new Map<string, typeof timeEntries>();
for (const e of timeEntries) {
  const list = entryMap.get(e.employeeId) ?? [];
  list.push(e);
  entryMap.set(e.employeeId, list);
}
// Then per employee: const empEntries = entryMap.get(emp.id) ?? [];
```

### SaldoSnapshot bulk query (6 months)
```typescript
// [VERIFIED: schema.prisma SaldoSnapshot model + overtime.ts snapshots endpoint]
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
sixMonthsAgo.setDate(1); // first of month
const snapshots = await app.prisma.saldoSnapshot.findMany({
  where: {
    employeeId: { in: employeeIds },
    periodType: "MONTHLY",
    periodStart: { gte: sixMonthsAgo },
  },
  orderBy: { periodStart: "asc" },
  select: { employeeId: true, periodStart: true, balanceMinutes: true, carryOver: true },
});
// Group by employeeId:
const snapshotsByEmployee = new Map<string, typeof snapshots>();
for (const s of snapshots) {
  const list = snapshotsByEmployee.get(s.employeeId) ?? [];
  list.push(s);
  snapshotsByEmployee.set(s.employeeId, list);
}
```

### Minimal sparkline Chart.js config
```typescript
// Source: established pattern from dashboard.ts lines 454-491
new Chart(canvasEl, {
  type: "line",
  data: {
    labels: snapshots.map(s => s.periodStart.slice(0, 7)), // "2026-01"
    datasets: [{
      data: snapshots.map(s => s.balanceMinutes / 60),
      borderColor: brandColor,
      backgroundColor: brandColor + "15",
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 1.5,
    }],
  },
  options: {
    responsive: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  },
});
```

### resolvePresenceState() usage for RPT-03
```typescript
// Source: presence.ts + dashboard.ts lines 243-266 — verified working pattern
import { resolvePresenceState } from "../utils/presence";
import type { PresenceEntry, PresenceLeave, PresenceAbsence } from "../utils/presence";

const presenceEntries: PresenceEntry[] = empEntries.map(e => ({
  endTime: e.endTime,
  isInvalid: e.isInvalid,
}));
const presenceLeave: PresenceLeave | null = leave
  ? { status: leave.status as "APPROVED" | "CANCELLATION_REQUESTED", leaveTypeName: leave.leaveType.name }
  : null;
const presenceAbsence: PresenceAbsence | null = absence ? { type: absence.type } : null;

const { status, reason } = resolvePresenceState({
  entries: presenceEntries,
  leave: presenceLeave,
  absence: presenceAbsence,
  isWorkday,
  isFuture: false, // today is never future
  hasShift: false, // shifts not needed for daily attendance
});
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `apps/api/vitest.config.ts` (inferred from package.json) |
| Quick run command | `node_modules/.bin/vitest run apps/api/src/routes/__tests__/reports.test.ts` |
| Full suite command | `node_modules/.bin/vitest run apps/api/src` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPT-03 | today-attendance returns correct status for present/absent/missing employees | integration | `vitest run apps/api/src/routes/__tests__/reports.test.ts` | Partial — reports.test.ts exists; needs new describe block |
| RPT-01 | overtime-overview returns balanceHours for all tenant employees | integration | `vitest run apps/api/src/routes/__tests__/reports.test.ts` | Partial — needs new describe block |
| SALDO-03 | overtime-overview.snapshots returns 6-month SaldoSnapshot array per employee | integration | `vitest run apps/api/src/routes/__tests__/reports.test.ts` | Partial — needs new describe block |
| RPT-02 | leave-overview returns remainingDays correctly (no new test needed — endpoint is unchanged) | integration | `vitest run apps/api/src/routes/__tests__/reports.test.ts` | Existing tests cover GET /leave-overview response shape |

### Sampling Rate
- Per task commit: `node_modules/.bin/vitest run apps/api/src/routes/__tests__/reports.test.ts`
- Per wave merge: `node_modules/.bin/vitest run apps/api/src`
- Phase gate: full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New `describe("GET /api/v1/dashboard/overtime-overview")` block in `reports.test.ts` (or `dashboard.test.ts`)
- [ ] New `describe("GET /api/v1/dashboard/today-attendance")` block
- [ ] `apps/api/src/__tests__/` already has `setup.ts` with `seedTestData` helper — reuse without modification

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireRole("ADMIN", "MANAGER")` preHandler on all 3 new endpoints |
| V3 Session Management | no | JWT handled globally by existing middleware |
| V4 Access Control | yes | tenantId filter on all queries; employees of other tenants must never appear |
| V5 Input Validation | yes | year/month query params validated with `z.coerce.number()` (Zod) |
| V6 Cryptography | no | Read-only reporting — no encryption needed |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data leakage | Info disclosure | `employee: { tenantId }` in every Prisma where clause |
| Employee escalation viewing team data | Elevation of privilege | `requireRole("ADMIN", "MANAGER")` on all 3 dashboard endpoints |
| Parameter injection via year/month | Tampering | `z.coerce.number().int().min(2020).max(2099)` Zod validation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "planned" in RPT-02 means PENDING leave requests (not scheduled future APPROVED leave) | API Design — RPT-02 | If "geplant" means future-dated APPROVED leave, query must change to filter by startDate > today with status APPROVED |
| A2 | Sparklines should use `balanceMinutes` (monthly delta) not `carryOver` (cumulative) | API Design — SALDO-03 | If cumulative trend is preferred, response should return `carryOver` field instead; both are in SaldoSnapshot |
| A3 | All three views go on `/reports` not a new route | Frontend Design | If user prefers a separate `/reports/dashboards` route, a new `+page.svelte` and route group folder is needed |

---

## Open Questions

1. **RPT-02 "geplant" definition**
   - What we know: LeaveEntitlement tracks `usedDays` and `remainingDays`. LeaveRequest has `status: PENDING` for not-yet-approved requests.
   - What's unclear: Does "geplant" mean PENDING requests, or future-dated APPROVED requests, or both?
   - Recommendation: Interpret as PENDING (most actionable for manager). If user wants future-approved: add a `futureApprovedDays` field.

2. **SALDO-03 sparkline data when no snapshots exist**
   - What we know: SaldoSnapshot rows are created by `POST /overtime/close-month`. New tenants will have zero rows.
   - What's unclear: Should the RPT-01 table row hide the sparkline, show a placeholder, or show the live `balanceHours` as a single point?
   - Recommendation: Show sparkline if ≥ 2 snapshots exist; otherwise show plain text "(kein Verlauf)".

3. **RPT-01 sort persistence**
   - What we know: Client-side sort state in `$state` is lost on navigation.
   - Recommendation: No persistence needed for v1.1 — sort state resets on mount. URL params would add complexity.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 7 is a code-only change. No new external services, CLIs, or runtimes are introduced beyond what the existing API + web stack already uses (PostgreSQL, Node.js, pnpm).

---

## Sources

### Primary (HIGH confidence — verified against codebase)
- `apps/api/src/routes/dashboard.ts` — team-week handler, presence bulk-fetch pattern
- `apps/api/src/routes/overtime.ts` — OvertimeAccount GET, SaldoSnapshot endpoints, close-month logic
- `apps/api/src/routes/reports.ts` — leave-overview endpoint, monthly endpoint, computeEmployeeSummary
- `apps/api/src/utils/presence.ts` — resolvePresenceState() signature, PresenceEntry/Leave/Absence types
- `packages/db/prisma/schema.prisma` — SaldoSnapshot, OvertimeAccount, LeaveEntitlement schema
- `apps/web/src/routes/(app)/reports/+page.svelte` — existing report cards, CSS classes, download pattern
- `apps/web/src/routes/(app)/dashboard/+page.svelte` — Chart.js registration pattern, sparkline-style charts
- `.planning/phases/05-*/05-03-SUMMARY.md` — RPT-04 completed status
- `.planning/phases/05-*/05-VERIFICATION.md` — all 9 truths verified for Phase 5
- `.planning/phases/06-*/06-01-SUMMARY.md` — PDF endpoint additions confirmed
- `.planning/phases/06-*/06-02-SUMMARY.md` — frontend report cards confirmed
- `CLAUDE.md` — all project constraints

### Secondary (MEDIUM confidence)
- None needed — all findings are directly from codebase inspection

---

## Metadata

**Confidence breakdown:**
- What's already built: HIGH — direct file inspection, no assumptions
- API design: HIGH — modeled directly on verified existing patterns (team-week, leave-overview)
- Frontend design: HIGH — follows established patterns from dashboard.ts and reports page
- N+1 pitfall identification: HIGH — pattern verified in existing handler and easily checked
- SALDO-03 sparkline availability risk: MEDIUM — depends on whether any months have been closed; graceful fallback specified

**Research date:** 2026-04-11
**Valid until:** 2026-06-11 (60 days — stable codebase, no fast-moving dependencies)

---

## User Decisions (2026-04-11)

### RPT-02 "geplant" → PENDING-Anträge
User confirmed: "geplant" = PENDING leave requests (not yet approved). The dashboard's "Anstehende Urlaube" section already shows APPROVED future-dated leaves, so RPT-02 should show entitlement overview + pendingDays (from PENDING requests).

### SALDO-03 Sparkline → Kumulativer Saldo (carryOver)
User confirmed: sparkline shows `carryOver` from SaldoSnapshot (cumulative running balance), not `balanceMinutes` (monthly delta). Update API response to include `carryOver` as the sparkline data field.

### Dashboard overlap — avoid duplication
Dashboard already has:
- "Anstehende Urlaube" — APPROVED future leaves for all employees
- "Team-Wochenübersicht" — week-by-week presence grid for all employees

RPT-03 (Heutige Anwesenheit) should be a clean summary-style view on /reports that complements (not duplicates) the Team-Wochenübersicht. Key difference: RPT-03 is a simple list with today's status badge + counts (anwesend/fehlend/urlaub/krank summary). Team-Wochenübersicht is a calendar grid showing the full week.

RPT-02 is an entitlement table (Resturlaub, genommen, pending) — completely different from "Anstehende Urlaube" (which shows leave periods, not entitlement balances).
