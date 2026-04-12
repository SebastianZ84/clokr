---
phase: 07-reporting-dashboards-berstunden-urlaub-anwesenheit
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - apps/api/src/routes/dashboard.ts
  - apps/api/src/routes/reports.ts
  - apps/api/src/routes/__tests__/reports.test.ts
  - apps/web/src/routes/(app)/reports/+page.svelte
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase delivers the reporting and dashboard layer: a dashboard API (`dashboard.ts`) serving personal stats, team-week overview, today-attendance, overtime overview, and open-items; a reports API (`reports.ts`) with monthly summaries, DATEV LODAS export, and several PDF endpoints; integration tests (`reports.test.ts`); and a frontend reports page (`+page.svelte`).

The overall design is solid — bulk-fetching, tenant isolation, soft-delete filters, and audit logging are consistently applied. However there are several correctness issues ranging from a null-pointer dereference that can crash the server in production to timezone hardcoding bugs, silent NaN propagation from unvalidated query parameters, a wrong file extension in the UI, and a URL object leak.

---

## Critical Issues

### CR-01: Non-null assertion on `endTime` crashes when `endTime` is null

**File:** `apps/api/src/routes/reports.ts:181`

**Issue:** `computeEmployeeSummary` asserts `e.endTime!` is non-null on line 181 and again on line 252, but the `buildEmployeeInclude` query on line 291 already filters `endTime: { not: null }`. This is safe for `buildEmployeeInclude`. However, the DATEV endpoint (`/datev`, line 431–456) uses its **own** include block that also filters `endTime: { not: null }`, but the subsequent `workedMinutes` calculation at line 543–547 accesses `e.endTime` without the assertion — which is fine. The real crash risk is the non-null assertion at line 181 used from `computeEmployeeSummary`, which is called only via `buildEmployeeInclude`-filtered data in the current code. **The actual bug** is on line 252 — the same `e.endTime!` assertion is inside `entries.map()` which is called for time entries fetched through `buildEmployeeInclude`. While the query filter protects this path today, the `TimeEntryRecord` type (line 66) declares `endTime: Date | null`, so the assertion is a contract violation that will silently bypass TypeScript's safety net. Any future caller that passes an entry with `endTime: null` will get a runtime `TypeError: Cannot read properties of null (reading 'getTime')` crashing the request.

**Fix:**
```typescript
// line 181 — replace assertion with guard
const slotMin = e.endTime
  ? (e.endTime.getTime() - e.startTime.getTime()) / 60000
  : 0;
return sum + slotMin - Number(e.breakMinutes ?? 0);

// line 252 — same treatment
netHours: e.endTime
  ? Math.round(
      (((e.endTime.getTime() - e.startTime.getTime()) / 60000 -
        Number(e.breakMinutes ?? 0)) / 60) * 100,
    ) / 100
  : 0,
```

---

## Warnings

### WR-01: Hardcoded `Europe/Berlin` timezone ignores tenant timezone setting

**File:** `apps/api/src/routes/reports.ts:801` and `apps/api/src/routes/reports.ts:893`

**Issue:** Two separate places in the leave-list PDF endpoints format dates using the hardcoded string `"Europe/Berlin"` instead of the tenant's configured timezone (`tz` is already fetched from `getTenantTimezone` in both handlers). This means tenants in other timezones (e.g., Austria `Europe/Vienna`, Switzerland `Europe/Zurich`) will get correctly-ranged data but incorrectly formatted display dates.

Both occurrences are in the same pattern:
```typescript
startDate: formatInTimeZone(lr.startDate, "Europe/Berlin", "dd.MM.yyyy"),
endDate:   formatInTimeZone(lr.endDate,   "Europe/Berlin", "dd.MM.yyyy"),
```

**Fix:**
```typescript
// Use the `tz` variable already declared at the top of each handler
startDate: formatInTimeZone(lr.startDate, tz, "dd.MM.yyyy"),
endDate:   formatInTimeZone(lr.endDate,   tz, "dd.MM.yyyy"),
```

This applies to both the `/leave-list/pdf` handler (lines ~801–802) and the `/vacation/pdf` handler (lines ~893–894).

### WR-02: Unvalidated `parseInt` on query params silently produces NaN, which propagates into Prisma queries

**File:** `apps/api/src/routes/reports.ts:323–325`, `apps/api/src/routes/reports.ts:427–429`, `apps/api/src/routes/reports.ts:620–621`, `apps/api/src/routes/reports.ts:686–687`

**Issue:** Every report endpoint parses `year` and `month` with `parseInt(year)` / `parseInt(month)` without any validation. If either param is missing or non-numeric (e.g., `?year=abc&month=1`), `parseInt` returns `NaN`. This `NaN` is passed to `monthRangeUtc()` which computes a `Date` from it — `new Date(NaN, ...)` returns an `Invalid Date`. That invalid date object is then used in Prisma `where: { date: { gte: InvalidDate } }` queries. Prisma will throw an error, which the global handler will convert to a 500 response rather than a proper 400.

The test at line 244–254 acknowledges the 500 behavior ("so Fastify returns 500 rather than 400") but this is incorrect behavior — the server should return 400 with a descriptive error.

**Fix:**
```typescript
const y = parseInt(year);
const m = parseInt(month);
if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
  return reply.code(400).send({ error: "Ungültige Jahr- oder Monatsangabe" });
}
```

### WR-03: `downloadPdf` leaks a URL object — `revokeObjectURL` is called before the browser can initiate the download

**File:** `apps/web/src/routes/(app)/reports/+page.svelte:399–402`

**Issue:** The `downloadPdf` function creates a blob URL, assigns it to the anchor, calls `a.click()`, and then **immediately** revokes the URL on the next line. The `click()` call is synchronous but the browser's download initiation is asynchronous — the URL is revoked before the download manager has read the blob. On some browsers (notably Firefox) this causes the download to silently fail with a 0-byte file or a network error.

```typescript
a.href = URL.createObjectURL(blob);
a.download = filename;
a.click();
URL.revokeObjectURL(a.href);  // <-- too early
```

The `downloadDatev` function at line 370–375 correctly revokes after a small tick by also appending the element to the DOM, but `downloadPdf` does not.

**Fix:**
```typescript
const objectUrl = URL.createObjectURL(blob);
a.href = objectUrl;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
// Revoke after a tick to ensure the download has started
setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
```

### WR-04: DATEV download UI saves the file with `.csv` extension, but server sends `.txt`

**File:** `apps/web/src/routes/(app)/reports/+page.svelte:373`

**Issue:** The `downloadDatev` function sets the download filename to `DATEV_${datevYear}_${...}.csv`, but the server sends `Content-Disposition: attachment; filename="datev-${year}-${month}.txt"` (confirmed by `reports.ts:604` and the DATEV-02d test at `reports.test.ts:148–154`). The browser will override the server's `Content-Disposition` filename when the download attribute is set on the anchor element, so users will receive a `.csv` file instead of the required `.txt`. DATEV LODAS import requires the `.txt` extension.

Additionally, the UI label (line 583) calls it "CSV herunterladen" while the product description (line 511) calls it "CSV-Datei" — both are wrong as this is a DATEV LODAS ASCII `.txt` format.

**Fix:**
```typescript
// line 373
a.download = `DATEV_${datevYear}_${String(datevMonth).padStart(2, "0")}.txt`;
```

Also update the UI label at line 583:
```html
↓ TXT herunterladen
```

And the card description at line 557:
```html
<p class="report-card-desc text-muted">DATEV-LODAS-Datei für Lohnabrechnung herunterladen</p>
```

### WR-05: `computeEmployeeSummary` double-counts sick days when an employee has both `Absence` records and sick `LeaveRequest` records for the same period

**File:** `apps/api/src/routes/reports.ts:199–226`

**Issue:** The `sickDaysWithoutAttest` counter is initialized to `sickDaysAbsence` (total sick days from the `Absence` model, lines 199–205). Then the code iterates over sick `LeaveRequest` records (lines 207–227) and adds more days to `sickDaysWithoutAttest` and `sickDaysWithAttest`. If the workflow creates both an `Absence` record (for tracking) and a `LeaveRequest` of type "Krankmeldung" (for leave balance), the same calendar days will be counted twice.

The severity depends on how the application uses both models. If `Absence` and sick `LeaveRequest` are always created together for the same event, every sick day will appear doubled in reports. This leads to inaccurate payroll data in a legally-sensitive context.

**Fix:** Establish a single source of truth. If sick leave is tracked exclusively via `LeaveRequest` records of type "Krankmeldung"/"Kinderkrank", then `sickDaysAbsence` from the `Absence` model should not contribute to the same counters, or the `Absence`-model days should only be counted when no corresponding sick `LeaveRequest` exists. Add a comment documenting the intended data model.

---

## Info

### IN-01: `my-week` endpoint uses non-null assertion `req.user.employeeId!` without guard

**File:** `apps/api/src/routes/dashboard.ts:519`

**Issue:** The `/my-week` and `/open-items` endpoints use `req.user.employeeId!` (lines 519, 574) — a non-null assertion — but `requireAuth` (not `requireRole`) is used as `preHandler`, meaning API-key users or users without an employee record can reach these handlers. The `/` endpoint (line 22–31) correctly handles `!employeeId` with an early return; the other two endpoints do not.

**Fix:**
```typescript
const employeeId = req.user.employeeId;
if (!employeeId) {
  return reply.code(403).send({ error: "Kein Mitarbeiterdatensatz verknüpft" });
}
```

### IN-02: `$effect` dependency tracking uses unused variable as side-effect trigger

**File:** `apps/web/src/routes/(app)/reports/+page.svelte:117–120`

**Issue:** The `$effect` block reads `reportRows.length` into `_len` (an underscore-prefixed variable that is never used) solely to trigger the effect when the length changes and reset `reportPage = 1`. This pattern is fragile and unclear.

**Fix:** A cleaner Svelte 5 pattern is to use `$derived` with a dependency on `reportRows`:
```typescript
// This effect is unnecessary if reportPage is derived from reportRows
// Alternative: reset via a proper effect
$effect(() => {
  void reportRows; // explicit dependency declaration
  reportPage = 1;
});
```
Or better, make `reportPage` reset part of `loadMonthlyReport()` directly (already sets `monthlyReport = null` but not `reportPage`).

### IN-03: `onMount` calls three async loaders sequentially instead of in parallel

**File:** `apps/web/src/routes/(app)/reports/+page.svelte:205–213`

**Issue:** `loadTodayAttendance()`, `loadOvertimeOverview()`, and `loadLeaveOverview()` are called with `await` in sequence. Each is an independent API call; running them in parallel would reduce initial load time by ~2/3.

**Fix:**
```typescript
onMount(async () => {
  const auth = getStore(authStore);
  currentRole = auth.user?.role ?? null;
  if (isManager) {
    await Promise.all([
      loadTodayAttendance(),
      loadOvertimeOverview(),
      loadLeaveOverview(),
    ]);
  }
});
```

### IN-04: Test for missing query params accepts 500 instead of documenting it as a known bug

**File:** `apps/api/src/routes/__tests__/reports.test.ts:244–254`

**Issue:** The test comment states "Fastify returns 500 rather than 400" and accepts `statusCode !== 200`. This normalizes a defect — a missing required parameter should always return 400, not 500. The test passes but provides no regression protection against fixing the behavior (WR-02 above). The test should be updated once input validation is added.

---

_Reviewed: 2026-04-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
