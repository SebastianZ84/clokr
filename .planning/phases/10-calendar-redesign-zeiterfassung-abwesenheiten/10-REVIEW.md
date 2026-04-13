---
phase: 10-calendar-redesign-zeiterfassung-abwesenheiten
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - apps/web/src/routes/(app)/time-entries/+page.svelte
  - apps/web/src/routes/(app)/leave/+page.svelte
  - apps/web/src/app.css
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the calendar redesign for Zeiterfassung (time entries) and Abwesenheiten (leave management), plus the global stylesheet update. The code is generally well-structured and follows the project's Svelte 5 rune patterns correctly. However, there are five warnings: three logic bugs (a holiday-name rendering error in the leave calendar, a month-change year-rollover double-load, and a drag selection that does not guard future or past dates), plus two correctness issues with URL-based date initialization and the employee selector always rendering. There are also five informational items covering hardcoded hex colors, a CSS `color-mix()` baseline gap, dead code, and a missing `aria-modal` attribute.

## Warnings

### WR-01: Holiday cells in leave calendar render `firstName` instead of `typeName`

**File:** `apps/web/src/routes/(app)/leave/+page.svelte:1433`
**Issue:** The template renders `{holidays[0].firstName}` inside `cal-holiday-label`, but `CalEntry.firstName` is the employee's first name, not the holiday name. For holidays (`isHoliday: true`) the `typeName` field carries the holiday description. This will silently display an employee first name (or empty string) instead of the public holiday's name on every calendar cell that is a public holiday.
**Fix:**
```svelte
<div class="cal-holiday-label" title={holidays[0].typeName ?? ""}>
  {holidays[0].typeName ?? "Feiertag"}
</div>
```

### WR-02: Year-change triggers `loadData()` redundantly in `prevMonth`/`nextMonth`/`gotoMonthYear`/`gotoToday` — not inside `loadCalendar()`

**File:** `apps/web/src/routes/(app)/leave/+page.svelte:308-341`
**Issue:** Each navigation function calls `loadCalendar()` unconditionally, then calls `loadData()` if the year changed. However `loadData()` always fetches the *current calendar year* (`const year = new Date().getFullYear()`), never the viewed year. Navigating to January of the following year still shows the current year's data. Additionally, navigating forward and back within the same year while already in a future year will never re-fetch data even when `calYear` differs from the real current year. The intent seems to be refreshing data when crossing a year boundary, but the fetch uses `new Date().getFullYear()` so the refreshed data is always for the real current year regardless of what year is displayed.
**Fix:** Either always pass the viewed year to `loadData`:
```typescript
async function loadData(year = calYear) {
  // ...
  const [mine, all] = await Promise.all([
    api.get<LeaveRequest[]>(
      `/leave/requests?year=${year}${myEmployeeId ? `&employeeId=${myEmployeeId}` : ""}`,
    ),
    // ...
  ]);
}
```
Then call `loadData(calYear)` whenever `calYear` changes, not just when it differs from the previous year.

### WR-03: Drag-to-select date range in leave calendar allows selecting past dates and future dates without restriction

**File:** `apps/web/src/routes/(app)/leave/+page.svelte:151-178`
**Issue:** `handleDayMouseDown` only checks `isCurrentMonth` but does not guard against days that are outside the current month's cells being dragged across. More critically, `handleDayMouseUp` sets `formStart` and `formEnd` and opens the form without any validation. A user dragging across to a date in the past will open a leave request form pre-filled with past dates, which the API will accept or reject depending on server-side policy. More importantly, since `dragEnd` is set on `onmouseenter` for all calendar cells (including the gray cells of the adjacent month), a drag that ends in a next-month cell will populate a date in the wrong month. This can silently submit leave requests with incorrect date ranges.
**Fix:** In `handleDayMouseUp`, normalise the range and clamp both `start` and `end` to dates belonging to the current month before opening the form:
```typescript
function handleDayMouseUp() {
  if (!isDragging || !dragStart || !dragEnd) {
    isDragging = false;
    return;
  }
  isDragging = false;
  const start = dragStart < dragEnd ? dragStart : dragEnd;
  const end   = dragStart < dragEnd ? dragEnd   : dragStart;
  // Clamp to current month
  const monthPrefix = `${calYear}-${String(calMonth).padStart(2, "0")}`;
  if (!start.startsWith(monthPrefix) && !end.startsWith(monthPrefix)) {
    dragStart = dragEnd = null;
    return;
  }
  formStart = start;
  formEnd   = end;
  editingRequest = null;
  showForm = true;
  dragStart = dragEnd = null;
}
```

### WR-04: `fromDate` and `toDate` are module-level `let` (not reactive state) but mutated in navigation functions — could silently stale on back-navigation

**File:** `apps/web/src/routes/(app)/time-entries/+page.svelte:114-115`
**Issue:** `fromDate` and `toDate` are declared as plain `let` (not `$state`), so they are mutated but never reactive. In `onMount`, if a `?date=` URL param is present, `fromDate`/`toDate` are updated before `loadAll()` is called. However, if the user navigates away and back in the SPA without a full page reload (SvelteKit's client-side routing), `onMount` will re-run but the initial values computed at module top (`format(startOfMonth(today), ...)`) will be used as the starting point, ignoring any intermediate state. Since `loadAll()` reads `fromDate`/`toDate` as plain variables (not derived), this is not a bug under normal usage — but it is fragile and will break if the component is kept alive. More practically, it also means `$effect`-based reactive patterns cannot watch these values.
**Fix:** Declare them as `$state`:
```typescript
let fromDate = $state(format(startOfMonth(today), "yyyy-MM-dd"));
let toDate   = $state(format(endOfMonth(today), "yyyy-MM-dd"));
```

### WR-05: Employee selector in leave page always rendered, even for non-managers with no employees list

**File:** `apps/web/src/routes/(app)/leave/+page.svelte:959-978`
**Issue:** The employee selector (`<div class="employee-selector card-animate">`) is rendered unconditionally for all users, including regular employees. For a regular employee `calEmployees` will always be empty (employees are only fetched for managers), so the selector shows only the two fixed options "Alle Mitarbeiter" and "Meine Einträge". A regular employee cannot filter by specific colleagues, making "Alle Mitarbeiter" vs "Meine Einträge" the only choices — both of which only show the employee's own entries anyway. This is misleading UX, but more importantly it adds a visible UI element for non-managers that serves no purpose. Compare with the time-entries page where the selector is gated behind `{#if isManager && employees.length > 0}`.
**Fix:**
```svelte
{#if isManager || calEmployees.length > 0}
  <div class="employee-selector card-animate">
    ...
  </div>
{/if}
```

## Info

### IN-01: Hardcoded hex colors inside scoped `<style>` blocks violate project UI convention

**File:** `apps/web/src/routes/(app)/time-entries/+page.svelte:1455-1458, 1714-1718, 1789, 1797-1798, 1803, 1832-1833, 1843`
**Issue:** Several scoped style rules use hardcoded hex values (`#16a34a`, `#dc2626`, `#fef2f2`, `#ef4444`) instead of the defined CSS custom properties (`var(--color-green)`, `var(--color-red)`, `var(--color-red-bg)`, `var(--color-danger)`). This breaks dark-mode and alternative theme rendering. Per CLAUDE.md: "NEVER hardcode hex colors in component `<style>` blocks. Always use CSS custom properties."
**Fix:** Replace all hardcoded hex values:
- `#16a34a` → `var(--color-green)`
- `#dc2626` → `var(--color-red)`
- `#fef2f2` → `var(--color-red-bg)`
- `#ef4444` → `var(--color-danger)`

Same pattern applies in `leave/+page.svelte:2350-2351, 2408, 2417`.

### IN-02: `color-mix()` used without `@supports` fallback in global CSS

**File:** `apps/web/src/app.css:1539, 1547, 1603-1625`
**Issue:** Several calendar cell rules use `color-mix(in srgb, ...)` which has broad but not universal support (Safari 15.4+, Chrome 111+, Firefox 113+). Older in-use browsers (e.g. iOS 15 Safari) will silently receive no background or the `!important` rule from a different selector. There is a `@supports not (backdrop-filter)` fallback for glass surfaces but no equivalent for `color-mix`. This is an info item rather than a warning because the visual degradation is minor (cells appear with the wrong background hue but remain readable).
**Fix:** Either wrap uses in `@supports (color: color-mix(in srgb, red 50%, blue))` with a fallback, or replace with pre-computed static colours for the small set of values used.

### IN-03: Unused import `self` in `time-entries/+page.svelte`

**File:** `apps/web/src/routes/(app)/time-entries/+page.svelte:2`
**Issue:** `self` is imported from `svelte/legacy` (line 2) and used only for `onclick={self(closeModal)}` on the modal backdrop (line 1134). In Svelte 5 with runes, the idiomatic pattern is to check `event.target === event.currentTarget` inside the handler directly. The `self` legacy helper is not needed here and signals a partial Svelte 4 → 5 migration. This is a minor code quality point.
**Fix:**
```svelte
onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
```
Then remove `self` from the import.

### IN-04: `$effect` in `leave/+page.svelte` reads reactive state for side-effect via property access (`.length`) — fragile pattern

**File:** `apps/web/src/routes/(app)/leave/+page.svelte:894-897`
**Issue:** The effect reads `filteredMyRequests.length` as a "dependency access" with no return value, solely to trigger when `filteredMyRequests` changes. This is a valid Svelte 5 pattern but is non-obvious and fragile — a future refactor that replaces the `.length` read with a different access pattern could silently break the reactivity. The intent is to reset `myReqPage` to 1 when the filtered list changes.
**Fix:** Use a cleaner derived+effect pattern, or add an explicit comment:
```typescript
// Reset pagination when filter changes
$effect(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  filteredMyRequests.length; // accessed to subscribe to filteredMyRequests reactivity
  myReqPage = 1;
});
```

### IN-05: Review modal in `leave/+page.svelte` missing `aria-modal="true"` attribute

**File:** `apps/web/src/routes/(app)/leave/+page.svelte:1747`
**Issue:** The review modal `<div class="modal-card card" role="dialog" tabindex="-1">` is missing `aria-modal="true"`, while the equivalent modal in `time-entries/+page.svelte` (line 1135) and the attest modal (line 1905) both correctly include it. Without `aria-modal="true"`, screen readers may continue reading content behind the modal.
**Fix:**
```svelte
<div class="modal-card card" role="dialog" aria-modal="true" tabindex="-1">
```

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
