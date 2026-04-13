# Phase 14: Weekday Configuration & Per-Day Soll — Research

**Researched:** 2026-04-13
**Domain:** SvelteKit + Fastify schedule UI — calendar per-day Soll for MONTHLY_HOURS
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Reuse existing `WorkSchedule.mondayHours`...`WorkSchedule.sundayHours` for MONTHLY_HOURS employees. Interpretation: 0.0 = does not work, non-zero = works. No schema migration.
- **D-02:** All 7 day fields = 0 → no per-day Soll shown (pure flexible mode). No new flag.
- **D-03:** When admin sets a new MONTHLY_HOURS schedule, day fields default to Mon–Fri = 1.0, Sat/Sun = 0.0 (overrideable via picker).
- **D-04:** `employeeScheduleSchema` in `settings.ts` already includes all 7 day fields — no API schema change needed.
- **D-05:** `dailySoll = monthlyBudget ÷ count of configured working days occurring in that calendar month`.
- **D-06:** On days where the employee's configured weekday falls: show `dailySoll` as target in calendar cell.
- **D-07:** Non-configured weekdays: no Soll shown (same as current MONTHLY_HOURS behavior).
- **D-08:** All day fields = 0: no per-day Soll for any day.
- **D-09:** Show +/- delta per configured day (worked − dailySoll) with same green/red color coding as FIXED_WEEKLY.
- **D-10:** Leave days on configured weekdays: still show dailySoll target.
- **D-11:** Weekday picker in existing schedule edit modal in `admin/vacation/+page.svelte`.
- **D-12:** Picker renders only when `type === "MONTHLY_HOURS"`.
- **D-13:** Toggle chips — abbreviated German day names (Mo/Di/Mi/Do/Fr/Sa/So), pill buttons, filled = selected.
- **D-14:** No separate enable toggle — all-deselected = no per-day Soll.
- **D-15:** German labels: "Feste Arbeitstage", helper "Wenn konfiguriert, wird ein tägliches Soll im Kalender angezeigt (Budget ÷ Arbeitstage im Monat)."

### Claude's Discretion
- Exact pixel sizing/spacing for toggle chips (follow existing modal patterns)
- Whether to expose configured weekdays in GET /employees or only in GET /settings/work/:id
- Audit log action name for weekday config change

### Deferred Ideas (OUT OF SCOPE)
- Saldo calculation adjustment for MONTHLY_HOURS weekday config — saldo stays worked − monthlyBudget total
- Partial-month proration for new hires mid-month (SCHED-V14-01)
- Holiday deduction based on weekday config — Phase 15 (TENANT-01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHED-04 | Admin can configure which weekdays a MONTHLY_HOURS employee regularly works | D-11 to D-15: weekday picker in schedule edit modal; `mondayHours`...`sundayHours` already stored, already sent via API; `saveEmployee` bug fix required (currently zeros all day fields for MONTHLY_HOURS) |
| SCHED-05 | MONTHLY_HOURS employee with configured weekdays sees per-day Soll in the calendar | D-05 to D-10: `makeCalDay` + `buildCalendarDays` changes; new `dailySoll` derived state; calendar cell template changes at lines 1066–1072 |
</phase_requirements>

---

## Summary

Phase 14 is a pure frontend-heavy change with a single critical backend bug fix. The schema is already correct — `WorkSchedule.mondayHours` through `sundayHours` exist and are persisted by the API. The API Zod schema (`employeeScheduleSchema`) already validates all seven day fields. No schema migration is needed.

The two work areas are:

1. **Admin UI bug fix + picker** (`admin/vacation/+page.svelte`): The `saveEmployee` function currently forces all day hours to `0` when `eType === "MONTHLY_HOURS"` (line 362–368). This must be changed so the user-selected weekdays are sent. A toggle-chip picker must be added inside the `{#if eType === "MONTHLY_HOURS"}` block (after the overtimeMode selector at line 1133, before the closing `{:else}` block) so admins can configure which days the employee works.

2. **Calendar per-day Soll** (`time-entries/+page.svelte`): `makeCalDay` passes `monthly=true` and when true immediately sets `expectedMin = 0` (line 382). This must be extended: for MONTHLY_HOURS employees with configured weekdays, compute `dailySoll = monthlyBudget ÷ workingDaysInMonth` and set `expectedMin = dailySoll` on their configured weekdays. The calendar cell template (lines 1066–1072) blocks delta display with `!isMonthlyHours` — this guard must be refined to also allow delta for MONTHLY_HOURS days where `expectedMin > 0`.

**Primary recommendation:** Fix `saveEmployee` bug first (Task 1), add weekday picker (Task 2), then wire per-day Soll into `makeCalDay`/`buildCalendarDays` (Task 3), then update calendar cell rendering (Task 4).

---

## Standard Stack

No new libraries. All work uses the existing stack. [VERIFIED: codebase grep]

| Component | Version | Purpose |
|-----------|---------|---------|
| Svelte 5 runes | 5.55.0 | `$state`, `$derived` for chip state |
| CSS custom properties | n/a | `var(--color-brand)`, `var(--color-border)` for chip styling |
| date-fns | 4.1.0 | Already used for `getDaysInMonth`, `getDay` equivalent via `Date.getDay()` |
| Vitest | 4.1.2 | Integration tests follow `minijob.test.ts` pattern |

---

## Architecture Patterns

### Existing CalDay Data Flow

`buildCalendarDays` (line 300–352) orchestrates all calendar cells. It accepts a `monthly: boolean` parameter passed in from `loadAll` (line 240: `schedule?.type === "MONTHLY_HOURS"`). The `WorkSchedule` object (`schedule`) is available in scope throughout — it is fetched from `GET /settings/work/:employeeId` which returns the full row including all day fields. [VERIFIED: codebase read, lines 206–226]

The `WorkSchedule` interface in `time-entries/+page.svelte` (lines 30–40) already declares all seven day fields (`mondayHours`...`sundayHours` as `string | number`). The data is available without any API change.

### `makeCalDay` signature and extension point

```
function makeCalDay(
  date: Date,
  isCurrentMonth: boolean,
  byDate: Map<string, TimeEntry[]>,
  sched: WorkSchedule | null,
  hols: Map<string, string>,
  absenceByDate: Map<string, { type: string; half: boolean }>,
  hireDateStr: string | null = null,
  monthly: boolean = false,   // ← currently used to zero out expectedMin for MONTHLY_HOURS
): CalDay
```

The per-day Soll formula (D-05) requires knowing the total working-day count for the month. This count must be computed **before** iterating calendar cells, not inside `makeCalDay`. The cleanest approach is:

1. Add a `dailySollMin: number = 0` parameter to `makeCalDay` (or compute it at `buildCalendarDays` level and close over it via a helper).
2. Inside `makeCalDay`, when `monthly && dailySollMin > 0`: check if this `date`'s weekday is configured in `sched`. If yes, set `expectedMin = dailySollMin`. If no (or if `monthly` but `dailySollMin === 0`), keep `expectedMin = 0` (preserving D-07 and D-08).

### Working-day count formula

```typescript
// Source: date-fns eachDayOfInterval alternative — but project uses direct Date iteration already
function countWorkingDaysInMonth(monthStart: Date, sched: WorkSchedule): number {
  const monthEnd = endOfMonth(monthStart);
  const DOW_KEYS = ["sundayHours","mondayHours","tuesdayHours","wednesdayHours",
                    "thursdayHours","fridayHours","saturdayHours"] as const;
  let count = 0;
  const cur = new Date(monthStart);
  while (cur <= monthEnd) {
    const key = DOW_KEYS[cur.getDay()];
    if (Number(sched[key]) > 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
```

This mirrors the existing `getDayExpected` pattern (lines 435–445) that already uses `date.getDay()` → index → `sched[key]`. [VERIFIED: codebase read]

### `getDayExpected` — existing FIXED_WEEKLY pattern

```typescript
// apps/web/src/routes/(app)/time-entries/+page.svelte, lines 435–445
function getDayExpected(s: WorkSchedule, date: Date): number {
  const keys = [
    "sundayHours","mondayHours","tuesdayHours","wednesdayHours",
    "thursdayHours","fridayHours","saturdayHours",
  ] as const;
  return Number(s[keys[date.getDay()] as keyof WorkSchedule] ?? 0);
}
```

For MONTHLY_HOURS, we reuse the same DOW→key lookup, but instead of returning the hour value directly we use it as a boolean (`> 0` means "configured workday").

### `isConfiguredWorkday` helper

```typescript
function isConfiguredWorkday(sched: WorkSchedule, date: Date): boolean {
  const keys = [
    "sundayHours","mondayHours","tuesdayHours","wednesdayHours",
    "thursdayHours","fridayHours","saturdayHours",
  ] as const;
  return Number(sched[keys[date.getDay()]] ?? 0) > 0;
}
```

### CalDay status for MONTHLY_HOURS configured days

Currently (lines 391–395), MONTHLY_HOURS days with entries use `"noExpect"` status. Once `expectedMin > 0` is set for configured weekdays, the existing status logic (lines 396–401) naturally produces `"ok"`, `"partial"`, `"missing"`, `"today-ok"`, etc. — no status enum changes needed.

### Delta display in calendar cell (lines 1066–1072)

Current code:
```svelte
{#if !isMonthlyHours && day.expectedMin > 0}
  {@const b = day.workedMin - day.expectedMin}
  <span class="day-bal {balClass(b)}">{b >= 0 ? "+" : "−"}{fmtMin(Math.abs(b))}</span>
{/if}
...
{:else if day.isCurrentMonth && !isMonthlyHours && day.expectedMin > 0 && !day.isFuture}
  <span class="day-missing">−{fmtMin(day.expectedMin)}&thinsp;h</span>
{/if}
```

The `!isMonthlyHours` guard blocks delta for MONTHLY_HOURS. Change to `(!isMonthlyHours || day.expectedMin > 0)` — i.e., show delta whenever `day.expectedMin > 0` regardless of schedule type. The `day.expectedMin > 0` already acts as the gate. [VERIFIED: codebase read, lines 1066–1072]

### Admin modal — insertion point for weekday picker

The modal `{#if eType === "MONTHLY_HOURS"}` block spans lines 1104–1133. The overtimeMode selector ends at line 1133. The picker must be inserted **after** line 1133 and **before** the `{:else}` at line 1134. This mirrors the pattern used for overtimeMode (added in Phase 13, now visible at lines 1124–1133).

### `saveEmployee` bug — lines 358–372

```typescript
// CURRENT — zeros all day hours for MONTHLY_HOURS:
const updated = await api.put<WorkSchedule>(`/settings/work/${empModal.id}`, {
  type: eType,
  weeklyHours: eType === "FIXED_WEEKLY" ? eWeekly : 0,
  monthlyHours: eType === "MONTHLY_HOURS" ? eMonthlyHours : null,
  mondayHours: eType === "FIXED_WEEKLY" ? eMon : 0,   // ← bug
  tuesdayHours: eType === "FIXED_WEEKLY" ? eTue : 0,  // ← bug
  ...
```

Fix: for MONTHLY_HOURS, send the chip-selected boolean values (represented as `1.0` for selected, `0` for deselected). Since `mondayHours` semantics for MONTHLY_HOURS = 0 or 1 (flag, not actual hours), the API accepts values in `[0, 24]` so `1.0` is valid. The existing `employeeScheduleSchema` Zod schema has `z.number().min(0).max(24)` for each field — no backend change required.

### `openEmpModal` — pre-population for weekday picker (line 318–328)

```typescript
// CURRENT — already reads mondayHours...sundayHours from existing schedule:
eMon = s ? Number(s.mondayHours) : gMon;
eTue = s ? Number(s.tuesdayHours) : gTue;
...
```

These values are non-zero for FIXED_WEEKLY employees (real hours). For MONTHLY_HOURS employees with existing weekday config, they will be 0 or 1. When `eType` switches to MONTHLY_HOURS for a new/switching employee, D-03 requires defaulting to Mon–Fri selected. This can be implemented with a `$effect` or `$derived` on `eType` — when switching to MONTHLY_HOURS and all day variables are ≥ 7 (FIXED_WEEKLY leftover values), reset to Mo–Fr=1, Sa/So=0.

### D-03 — default weekday state

When admin opens a fresh MONTHLY_HOURS schedule (no prior config, all days = 8 from FIXED_WEEKLY defaults), the picker must show Mo–Fr selected, Sa/So deselected. The state variables `eMon...eSun` are shared between FIXED_WEEKLY (hour values) and MONTHLY_HOURS (0/1 flags). A clean approach: introduce **separate state variables** for weekday chip state (`eMonWd`, `eTueWd`, etc.) that the picker binds to, and `saveEmployee` uses these when `eType === "MONTHLY_HOURS"`. Initialize them in `openEmpModal`:

```typescript
// When opening modal for MONTHLY_HOURS employee:
eMonWd = Number(s.mondayHours) > 0;   // true/false
eTueWd = Number(s.tuesdayHours) > 0;
...
// When eType has no prior MONTHLY_HOURS schedule: default Mo–Fr
eMonWd = true; eTueWd = true; eWedWd = true; eThuWd = true; eFriWd = true;
eSatWd = false; eSunWd = false;
```

This avoids collision with the FIXED_WEEKLY hour inputs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Working day count in month | Custom calendar walk | Reuse the existing date-iteration pattern from `buildCalendarDays` |
| DOW → schedule field lookup | New map structure | Reuse the `keys[]` array from `getDayExpected` (line 436–444) |
| Chip styling | External component library | Pure CSS pill buttons with `var(--color-brand)` + `var(--color-border)` |

---

## Common Pitfalls

### Pitfall 1: Shared state variables eMon...eSun collision

**What goes wrong:** `eMon` is used both as an hour value (FIXED_WEEKLY) and as a 0/1 flag (MONTHLY_HOURS). If the picker binds to these same variables, switching between schedule types leaves stale hour values that become flags or vice versa.

**How to avoid:** Introduce separate boolean state variables (`eMonWd`...`eSunWd`) for weekday chip state. FIXED_WEEKLY uses `eMon`–`eSun` (numeric). MONTHLY_HOURS uses `eMonWd`–`eSunWd` (boolean → 1.0/0.0 in save payload). Initialize in `openEmpModal`.

### Pitfall 2: `saveEmployee` sends wrong day fields for MONTHLY_HOURS

**What goes wrong:** The current code (line 362–368) explicitly sets all day hours to `0` for MONTHLY_HOURS. Even after adding the picker, if `saveEmployee` is not updated, the config is lost on save.

**How to avoid:** Change the save payload so `mondayHours: eType === "MONTHLY_HOURS" ? (eMonWd ? 1 : 0) : eMon` etc. This is the single most critical bug to fix in Task 1.

### Pitfall 3: Working-day count includes days before hire

**What goes wrong:** `countWorkingDaysInMonth` naively counts all configured weekdays in the calendar month, but for new hires mid-month the actual working days are fewer, inflating `dailySoll`.

**Status:** D-03 in CONTEXT.md defers partial-month proration to v1.4+. This is documented as out of scope. The planner must ensure the implementation does NOT handle this case — just use the full month count.

### Pitfall 4: CalDay.status remains "noExpect" for configured MONTHLY_HOURS days

**What goes wrong:** The status block (lines 391–395) sets MONTHLY_HOURS days to `"noExpect"` unconditionally before the generic status logic runs. If `makeCalDay` sets `expectedMin > 0`, the generic logic (lines 396–401) handles it correctly — but only if the `monthly` branch does NOT override status to `"noExpect"` after the generic block.

**How to avoid:** When `monthly && expectedMin > 0`, do NOT enter the `monthly` special branch — fall through to the generic `FIXED_WEEKLY`-equivalent logic. The simplest fix: change the monthly branch condition to `monthly && expectedMin === 0`.

### Pitfall 5: Delta display blocked by `!isMonthlyHours` guard

**What goes wrong:** Even if `expectedMin > 0` is correctly set in `CalDay`, the template at line 1066 blocks delta display with `!isMonthlyHours`. The delta span never renders for MONTHLY_HOURS employees.

**How to avoid:** Change guard to `day.expectedMin > 0` (dropping the `!isMonthlyHours` check) in both the delta span (line 1066) and the missing-hours span (line 1070). `expectedMin > 0` is the semantically correct gate.

### Pitfall 6: Phase 15 needs `mondayHours > 0` interpretation, not hour values

**What goes wrong:** Phase 15 reads `WorkSchedule.{weekday}Hours` to determine holiday deduction eligibility. If implementers store actual hours (e.g., `eMon = 8`) instead of 1.0 flags for MONTHLY_HOURS, Phase 15's `> 0` check still works — but semantics are ambiguous.

**How to avoid:** Store 1.0 (selected) or 0.0 (deselected) for MONTHLY_HOURS weekday config. This is already the D-01 semantic. The API's `z.number().min(0).max(24)` accepts 1.0. No special Phase 15 accommodation needed.

---

## Exact File Locations & Line Ranges

### `apps/web/src/routes/(app)/admin/vacation/+page.svelte`

| Area | Lines | Action |
|------|-------|--------|
| State declarations | 172–181 | Add `eMonWd`...`eSunWd` boolean state variables after `eSun` (line 178) |
| `openEmpModal` — weekday init | 318–328 | Add initialization of `eMonWd`...`eSunWd` from `s.{weekday}Hours > 0`; default Mo–Fr=true when no prior MONTHLY_HOURS schedule |
| `saveEmployee` — payload | 358–372 | Fix: send `mondayHours: eType === "MONTHLY_HOURS" ? (eMonWd ? 1 : 0) : eMon` etc. |
| Modal — MONTHLY_HOURS block | 1104–1133 | Insert weekday chip picker after line 1133 (after overtimeMode `</div>`) and before `{:else}` at line 1134 |

### `apps/web/src/routes/(app)/time-entries/+page.svelte`

| Area | Lines | Action |
|------|-------|--------|
| `getDayExpected` / new helper | 435–446 | Add `isConfiguredWorkday(sched, date)` helper alongside `getDayExpected` |
| `makeCalDay` signature | 354–363 | Add `dailySollMin: number = 0` parameter; alternatively compute inside via `buildCalendarDays` |
| `makeCalDay` — expectedMin logic | 380–386 | Change: `let expectedMin = monthly ? (dailySollMin > 0 && isConfiguredWorkday(sched, date) ? dailySollMin : 0) : ...` |
| `makeCalDay` — status for monthly | 391–395 | Change condition: `else if (monthly && expectedMin === 0)` to keep "noExpect" only for unconfigured days |
| `buildCalendarDays` | 300–352 | Add `countWorkingDaysInMonth` call when `monthly && sched` to get `dailySollMin`; pass to `makeCalDay` |
| Calendar cell — delta display | 1066–1068 | Change `{#if !isMonthlyHours && day.expectedMin > 0}` to `{#if day.expectedMin > 0}` |
| Calendar cell — missing display | 1070–1072 | Change `{:else if day.isCurrentMonth && !isMonthlyHours && day.expectedMin > 0 && !day.isFuture}` to `{:else if day.isCurrentMonth && day.expectedMin > 0 && !day.isFuture}` |

### `apps/api/src/routes/settings.ts`

No changes required. `employeeScheduleSchema` (lines 76–95) already accepts all 7 day fields. `PUT /settings/work/:employeeId` handler (lines 273–343) already saves all day fields from the request body. [VERIFIED: codebase read]

### `packages/db/prisma/schema.prisma`

No changes required. `WorkSchedule` model (lines 250–274) already has `mondayHours`...`sundayHours` with `@default(8)` for weekdays and `@default(0)` for weekend. [VERIFIED: codebase read]

---

## Code Examples

### New `countWorkingDaysInMonth` function

```typescript
// apps/web/src/routes/(app)/time-entries/+page.svelte — add alongside getDayExpected
// Source: [ASSUMED] — mirrors getDayExpected pattern at lines 435-445
function countWorkingDaysInMonth(monthStart: Date, sched: WorkSchedule): number {
  const keys = [
    "sundayHours","mondayHours","tuesdayHours","wednesdayHours",
    "thursdayHours","fridayHours","saturdayHours",
  ] as const;
  let count = 0;
  const end = endOfMonth(monthStart);
  const cur = new Date(monthStart);
  while (cur <= end) {
    if (Number(sched[keys[cur.getDay()] as keyof WorkSchedule] ?? 0) > 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
```

### Updated `makeCalDay` — expectedMin for MONTHLY_HOURS

```typescript
// Line 382 changes from:
let expectedMin = monthly ? 0 : sched ? getDayExpected(sched, date) * 60 : 0;

// To:
let expectedMin: number;
if (monthly) {
  if (dailySollMin > 0 && sched && Number(sched[DOW_KEYS[date.getDay()] as keyof WorkSchedule] ?? 0) > 0) {
    expectedMin = dailySollMin;
  } else {
    expectedMin = 0;
  }
} else {
  expectedMin = sched ? getDayExpected(sched, date) * 60 : 0;
}
```

### `buildCalendarDays` — dailySollMin computation

```typescript
// Add before the day-iteration loops:
let dailySollMin = 0;
if (monthly && sched && monthlyBudgetMin > 0) {
  const workingDays = countWorkingDaysInMonth(monthStart, sched);
  if (workingDays > 0) dailySollMin = Math.round(monthlyBudgetMin / workingDays);
}
```

Note: `monthlyBudgetMin` is available as `monthlyTarget` in the page scope — it must be passed into `buildCalendarDays` as a parameter, or computed inside the function from `sched.monthlyHours`.

### Toggle chip template (admin modal)

```svelte
<!-- Insert after overtimeMode form-group at line 1133, before {:else} -->
{#if eType === "MONTHLY_HOURS"}
  <div class="form-group" style="margin-bottom:1.25rem;">
    <span class="form-label">Feste Arbeitstage</span>
    <div class="weekday-chips">
      {#each [
        { key: 'eMonWd', label: 'Mo' },
        { key: 'eTueWd', label: 'Di' },
        { key: 'eWedWd', label: 'Mi' },
        { key: 'eThuWd', label: 'Do' },
        { key: 'eFriWd', label: 'Fr' },
        { key: 'eSatWd', label: 'Sa' },
        { key: 'eSunWd', label: 'So' },
      ] as chip (chip.key)}
        <!-- bind dynamically or use individual buttons -->
      {/each}
    </div>
    <p class="form-hint text-muted">
      Wenn konfiguriert, wird ein tägliches Soll im Kalender angezeigt (Budget ÷ Arbeitstage im Monat).
    </p>
  </div>
{/if}
```

Note: Svelte 5 cannot `bind:value` dynamically from a loop key string. Use individual buttons with `onclick` toggling the boolean state variables directly. [VERIFIED: Svelte 5 reactivity rules]

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|-----------------|--------|
| MONTHLY_HOURS: no per-day Soll at all | MONTHLY_HOURS: per-day Soll when weekdays configured | Phase 14 delivers this |
| MONTHLY_HOURS saveEmployee zeros all day hours | MONTHLY_HOURS saveEmployee sends chip-selected flags | Phase 14 fixes the bug |

---

## Runtime State Inventory

Step 2.5: SKIPPED — This phase is not a rename/refactor. The schema fields already exist and no data migration is needed.

---

## Environment Availability

Step 2.6: No external dependencies beyond the project stack. The test suite uses the existing dev PostgreSQL database. [VERIFIED: setup.ts]

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`). [VERIFIED: config.json]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/minijob.test.ts` |
| Full suite command | `pnpm --filter @clokr/api test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-04 | PUT /settings/work/:id stores mondayHours=1 for MONTHLY_HOURS | integration | `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/minijob.test.ts` | ✅ (extend minijob.test.ts) |
| SCHED-04 | PUT /settings/work/:id with all zeros stores 0 for all days | integration | same | ✅ (extend minijob.test.ts) |
| SCHED-05 | dailySoll = monthlyBudget / workingDaysInMonth | unit | `pnpm --filter @clokr/api test --run` (logic is frontend-only) | ❌ Wave 0 |
| SCHED-05 | Calendar cell shows delta when MONTHLY_HOURS day has expectedMin > 0 | manual/visual | visual check | manual |

### Sampling Rate
- **Per task commit:** `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/minijob.test.ts`
- **Per wave merge:** `pnpm --filter @clokr/api test --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Add `countWorkingDaysInMonth` unit tests — can be done as a pure-function test file or verified manually against the formula. No new test file is strictly required since the function is frontend-only (no server-side equivalent), but the formula should be verified against known months.

---

## Security Domain

Security enforcement applies. Phase 14 changes are restricted to ADMIN/MANAGER roles via existing `requireRole("ADMIN", "MANAGER")` preHandler on `PUT /settings/work/:employeeId`. No new endpoints. No new data exposure.

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V4 Access Control | yes | Existing `requireRole("ADMIN","MANAGER")` on PUT /settings/work/:id — no change needed |
| V5 Input Validation | yes | Existing `employeeScheduleSchema` Zod validation already covers all 7 day fields with `min(0).max(24)` |

---

## Open Questions

1. **monthlyBudgetMin availability inside `buildCalendarDays`**
   - What we know: `monthlyTarget` is a `$derived` computed at page level (line 720–722) from `schedule.monthlyHours`. `buildCalendarDays` receives `sched` but not the computed minute value.
   - What's unclear: The cleanest parameter passing strategy — add `monthlyBudgetMin` as an 8th parameter to `buildCalendarDays`, or compute `Number(sched.monthlyHours ?? 0) * 60` inside the function.
   - Recommendation: Compute inside `buildCalendarDays` from `sched.monthlyHours` directly. This avoids changing the call signature significantly and keeps the function self-contained.

2. **Chip state for type-switching in modal**
   - What we know: When admin switches `eType` from FIXED_WEEKLY to MONTHLY_HOURS, the existing `eMon`...`eSun` variables hold actual hour values (e.g., 8). The chip boolean variables need to initialize to a sensible default.
   - Recommendation: Use a `$effect` on `eType` that runs when `eType` changes to MONTHLY_HOURS and initializes `eMonWd`...`eSunWd` to Mon–Fri true, Sa/So false. This implements D-03.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storing 1.0 as the flag value for "configured workday" is sufficient for Phase 15 to detect `> 0` | Code Examples | Low — Phase 15 CONTEXT.md confirms it reads `{weekday}Hours > 0` |
| A2 | `endOfMonth` from date-fns is already in scope at the point where `countWorkingDaysInMonth` is called | Code Examples | Low — `endOfMonth` is imported at line 6 of time-entries/+page.svelte |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/routes/(app)/time-entries/+page.svelte` — lines 1–800, 920–1090 (full calendar logic)
- `apps/web/src/routes/(app)/admin/vacation/+page.svelte` — lines 1–394 (script), 1077–1335 (modal template)
- `apps/api/src/routes/settings.ts` — lines 60–343 (Zod schema + PUT handler)
- `packages/db/prisma/schema.prisma` — lines 246–274 (WorkSchedule model)
- `.planning/phases/14-weekday-configuration-per-day-soll/14-CONTEXT.md`
- `.planning/phases/13-overtime-handling-mode-carry-forward-track-only/13-CONTEXT.md`
- `apps/api/src/routes/__tests__/minijob.test.ts` — test pattern reference
- `apps/api/src/routes/__tests__/schedule-versioning.test.ts` — test pattern reference

### Secondary (MEDIUM confidence)
- `apps/api/src/__tests__/setup.ts` — test infrastructure pattern

---

## Metadata

**Confidence breakdown:**
- Exact line numbers: HIGH — all verified by direct file read
- API contract (no schema change): HIGH — verified by reading schema.prisma and settings.ts
- `saveEmployee` bug: HIGH — line 362–368 explicitly confirmed
- Toggle chip pattern: HIGH — confirmed existing modal CSS patterns in vacation/+page.svelte
- dailySoll formula: HIGH — locked in CONTEXT.md D-05, algorithm is arithmetic

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain)
