# Phase 5: Saldo Performance & Presence Resolver - Research

**Researched:** 2026-04-11
**Domain:** Fastify API — OvertimeAccount write-path coverage, dashboard presence state logic
**Confidence:** HIGH (all findings from direct codebase reads, no assumed knowledge)

---

## Missing updateOvertimeAccount Callers

### Current call sites (confirmed by grep + direct read)

| File | Line | Operation |
|------|------|-----------|
| `routes/overtime.ts` | 36 | **GET handler** — must be REMOVED (D-01) |
| `routes/time-entries.ts` | 409 | NFC clock-out |
| `routes/time-entries.ts` | 636 | Manual clock-out / entry update |
| `routes/time-entries.ts` | 883 | Entry create (POST) |
| `routes/time-entries.ts` | 1045 | Break end / clock-out variant |
| `routes/time-entries.ts` | 1152 | Entry status update |
| `routes/time-entries.ts` | 1204 | Soft delete (DELETE) |

### Missing callers — leave.ts

`leave.ts` imports `recalculateSnapshots` but **never calls `updateOvertimeAccount`**.

`recalculateSnapshots` (in `utils/recalculate-snapshots.ts`) does upsert `OvertimeAccount.balanceHours` at its end (line 166–170) — but only when snapshots already exist. If no snapshots exist for the employee (current month, not yet closed), the OvertimeAccount is NOT updated after leave state transitions.

Three transitions in `leave.ts` are missing `updateOvertimeAccount` calls:

#### 1. PENDING → APPROVED (`PATCH /requests/:id/review`, line ~638–734)
- File: `apps/api/src/routes/leave.ts`, around line 727–733
- Currently: calls `recalculateSnapshots(app, existing.employeeId, existing.startDate)` — updates snapshots if they exist
- Missing: no `updateOvertimeAccount(app, existing.employeeId)` call for the open (not-yet-closed) period
- Impact: approving leave reduces expected hours for open period, but `balanceHours` is not updated

#### 2. CANCELLATION_REQUESTED → CANCELLED (cancellation approved, `PATCH /requests/:id/review`, line ~509–611)
- File: `apps/api/src/routes/leave.ts`, around line 604–611
- Currently: calls `recalculateSnapshots(app, existing.employeeId, existing.startDate)` — updates snapshots if they exist
- Missing: no `updateOvertimeAccount(app, existing.employeeId)` call
- Impact: leave cancellation restores expected hours for open period, but `balanceHours` not updated

#### 3. APPROVED → CANCELLATION_REQUESTED (employee withdraws approved leave, `DELETE /requests/:id`, line ~897–913)
- File: `apps/api/src/routes/leave.ts`, around line 900–913
- Currently: only audits, no snapshot or account update at all
- Missing: no `updateOvertimeAccount(app, existing.employeeId)` call
- Note: this is a transitional status (leave stays legally active), so saldo impact is debatable; however for consistency and to keep the stored value accurate while cancellation is pending, this is a gap

#### 4. PENDING → CANCELLED (direct withdrawal of PENDING request, `DELETE /requests/:id`, line ~917–927)
- Currently: only audits, no saldo update
- This is less critical since PENDING leave has no saldo impact (not yet APPROVED), so no `updateOvertimeAccount` needed here

### Missing callers — imports.ts

`POST /imports/time-entries` (lines 166–245) creates time entries in a per-row loop but **never calls `updateOvertimeAccount`**.

After the loop completes, each affected employee's saldo is stale. The fix requires collecting unique `employeeId`s from successfully imported rows and calling `updateOvertimeAccount` once per employee after the loop.

```
// Pattern needed in imports.ts after the loop:
const affectedEmployeeIds = new Set<string>();
// collect inside loop on ok rows: affectedEmployeeIds.add(employeeId);
// after loop:
for (const empId of affectedEmployeeIds) {
  await updateOvertimeAccount(app, empId).catch((err) =>
    app.log.error({ err, employeeId: empId }, "Failed to update overtime after import"),
  );
}
```

`updateOvertimeAccount` must be imported from `../routes/time-entries` (same pattern as `overtime.ts` line 4).

Note: `POST /imports/employees` creates new employees with `overtimeAccount.create({ balanceHours: 0 })` in the transaction — this is correct and needs no change.

---

## auto-close-month.ts Gap Analysis

**Result: NO GAP. auto-close-month.ts already handles OvertimeAccount correctly.**

Two locations in the plugin upsert `OvertimeAccount.balanceHours`:

1. **Monthly close** (line 285–289): After creating `SaldoSnapshot`, immediately upserts `overtimeAccount` with `balanceHours: carryOver / 60`. This runs inside the same try-block as snapshot creation.

2. **Yearly close** (line 385–389): After creating the yearly `SaldoSnapshot`, upserts `overtimeAccount` with the carry-over-rule-adjusted value.

Both upserts are direct `prisma.overtimeAccount.upsert` calls (not `updateOvertimeAccount`). This is correct: the cron job already has all the calculated values in scope and writes them directly, bypassing the recalculation function. The stored `balanceHours` is set to exactly `carryOver / 60` which becomes the new base for `updateOvertimeAccount`'s snapshot-based calculation.

**Conclusion:** D-05 is satisfied — no change needed in `auto-close-month.ts`.

---

## resolvePresenceState() Function Design

### What data is currently available in dashboard.ts team-week scope

At the point where presence state is computed (lines 186–283), the following data is in scope per day:

- `dayEntries`: `TimeEntry[]` filtered by `employeeId + date` — currently **lacks `isInvalid` field** (not selected at line 132–137)
- `leave`: single `LeaveRequest | undefined` — currently fetches only `status: "APPROVED"` (line 141–148), lacks `status` in the select
- `absence`: single `Absence | undefined`
- `isFuture: boolean`
- `isWorkday: boolean`
- `shift: object | null`

### Proposed function signature

```typescript
// apps/api/src/utils/presence.ts

export type PresenceStatus =
  | "present"
  | "absent"
  | "clocked_in"
  | "missing"
  | "scheduled"
  | "none";

export interface PresenceEntry {
  endTime: Date | null;
  isInvalid: boolean;
}

export interface PresenceLeave {
  status: "APPROVED" | "CANCELLATION_REQUESTED";
  leaveTypeName: string;
}

export interface PresenceAbsence {
  type: string; // AbsenceType enum value
}

export interface PresenceResult {
  status: PresenceStatus;
  reason: string | null;
}

export function resolvePresenceState(params: {
  entries: PresenceEntry[];
  leave: PresenceLeave | null;
  absence: PresenceAbsence | null;
  isWorkday: boolean;
  isFuture: boolean;
  hasShift: boolean;
}): PresenceResult
```

### Logic inside resolvePresenceState()

Priority order (mirrors current inline logic, with the two bug fixes applied):

1. Filter out `isInvalid: true` entries before computing `isPresent` / `isClockedIn` (D-08)
2. `isClockedIn` (valid entry with `endTime === null`) → `{ status: "clocked_in", reason: null }`
3. `isPresent` (valid entry with `endTime !== null`) → `{ status: "present", reason: null }`
4. `leave.status === "CANCELLATION_REQUESTED"` → `{ status: "absent", reason: "Urlaubsstornierung beantragt" }` (D-09)
5. `leave.status === "APPROVED"` → `{ status: "absent", reason: leave.leaveTypeName }`
6. `absence` → `{ status: "absent", reason: <German absence type label> }`
7. `isFuture && (hasShift || isWorkday)` → `{ status: "scheduled", reason: null }`
8. `!isFuture && (hasShift || isWorkday)` → `{ status: "missing", reason: null }`
9. Default → `{ status: "none", reason: null }`

The absence-type-to-German mapping currently inline in dashboard.ts should be extracted into `resolvePresenceState` or a co-located helper constant.

### Edge cases to handle

- Employee has both `CANCELLATION_REQUESTED` leave AND creates a time entry marked `isInvalid: true`: entry is filtered out → leave status drives "absent"
- Employee with `CANCELLATION_REQUESTED` leave clocks in (valid entry created with `isInvalid: false` only after cancellation is approved per CLAUDE.md): only possible if cancellation is not yet processed — but CLAUDE.md says entries during CANCELLATION_REQUESTED are `isInvalid: true`, so this state cannot produce `isClockedIn: true` through this logic
- `leave.status` is neither `"APPROVED"` nor `"CANCELLATION_REQUESTED"`: cannot reach this function since the query filters to only those two statuses

---

## Dashboard.ts Bug Details

### Bug 1: isInvalid entries counted as present (lines 195–203)

**Current query (lines 124–138) — missing `isInvalid`:**
```typescript
select: {
  employeeId: true,
  date: true,
  startTime: true,
  endTime: true,
  breakMinutes: true,
  // isInvalid NOT selected
},
```

**Fix:** Add `isInvalid: true` to the select block.

**Current computation (lines 195–203) — no filtering:**
```typescript
for (const e of dayEntries) {
  if (e.endTime) {
    workedMinutes += ...;
    isPresent = true;
  } else {
    isClockedIn = true;
    isPresent = true;
  }
}
```

**Fix:** Filter `dayEntries` to `e.isInvalid === false` before iterating (or inside the loop with a continue guard).

### Bug 2: CANCELLATION_REQUESTED leave not fetched (lines 141–148)

**Current leave query:**
```typescript
where: {
  employee: { tenantId },
  status: "APPROVED",           // ← misses CANCELLATION_REQUESTED
  startDate: { lte: weekEnd },
  endDate: { gte: weekStart },
},
select: {
  employeeId: true,
  startDate: true,
  endDate: true,
  leaveType: { select: { name: true } },
  // status NOT selected
},
```

**Fix:**
```typescript
where: {
  employee: { tenantId },
  status: { in: ["APPROVED", "CANCELLATION_REQUESTED"] },
  startDate: { lte: weekEnd },
  endDate: { gte: weekStart },
},
select: {
  employeeId: true,
  startDate: true,
  endDate: true,
  status: true,                  // needed by resolvePresenceState
  leaveType: { select: { name: true } },
},
```

### Integration point

After both query fixes, the `dayEntries.filter(...)` and inline status determination block (lines ~241–273) gets replaced with a call to `resolvePresenceState()`. The return value maps directly to the existing `status`/`reason` fields in the response.

---

## Testing Patterns

### Existing test infrastructure

All tests in `apps/api/src/__tests__/` use **integration tests** via the shared `getTestApp()` / `seedTestData()` / `cleanupTestData()` setup (from `setup.ts`). There are currently no pure unit tests that import utility functions directly.

Key patterns observed:
- `describe` + `it` + `beforeAll`/`afterAll` from vitest
- `getTestApp()` returns a singleton `FastifyInstance` with Prisma and all plugins
- Each suite seeds its own tenant with a unique suffix (e.g., `seedTestData(app, "ot")`)
- Assertions use `app.inject()` for HTTP tests, or `app.prisma.*` for direct DB state checks
- Cleanup: `cleanupTestData(app, tenantId)` handles cascaded deletions

### For resolvePresenceState() — pure unit test approach

`resolvePresenceState()` operates on plain data types (no DB, no Fastify) by design (D-07). This enables a new pattern: **pure vitest tests without `getTestApp()`**.

**Proposed file:** `apps/api/src/__tests__/presence.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { resolvePresenceState } from "../utils/presence";

describe("resolvePresenceState", () => {
  it("returns clocked_in for valid open entry", () => { ... });
  it("ignores isInvalid entries — does not set present/clocked_in", () => { ... });
  it("CANCELLATION_REQUESTED leave → absent with correct reason", () => { ... });
  it("APPROVED leave → absent with leave type name", () => { ... });
  it("absence → absent with German label", () => { ... });
  it("future workday with no entries → scheduled", () => { ... });
  it("past workday with no entries → missing", () => { ... });
  it("non-workday, non-future, no entries → none", () => { ... });
  it("valid entry present even when APPROVED leave exists (presence beats leave)", () => { ... });
  it("isInvalid entry + CANCELLATION_REQUESTED leave → absent, not present", () => { ... });
});
```

No `beforeAll`/`afterAll`, no DB setup needed. Pure function, pure inputs, pure assertions.

### For updateOvertimeAccount coverage (SALDO-02)

New integration test can be added to the existing `overtime-calc.test.ts` or a new `leave-saldo.test.ts`. Pattern:

1. Seed employee + schedule via `seedTestData`
2. Create a leave request (PENDING), approve it via `app.inject PATCH /review`
3. Read `app.prisma.overtimeAccount.findUnique({ where: { employeeId } })`
4. Assert `balanceHours` changed (leave approval reduces expected → increases balance)

Note: the existing `overtime-calc.test.ts` test "overtime recalculates on GET" (line 33–75) will need to be updated — it currently asserts that balance changes on GET, which will no longer be true after D-01/D-02. The test must be rewritten to assert that balance changes after a write operation (create entry), NOT after a GET.

---

## Implementation Risks

### Risk 1: recalculateSnapshots + updateOvertimeAccount double-write race

When leave is approved, `recalculateSnapshots` is called first (snapshots path) and then `updateOvertimeAccount` must be called after (open period path). If both are called, they may produce slightly different `balanceHours` values depending on execution order.

**Mitigation:** Call `updateOvertimeAccount` AFTER `recalculateSnapshots`. `updateOvertimeAccount` uses the last snapshot's `carryOver` as its base, so it will incorporate any snapshot updates made by `recalculateSnapshots` when called in the correct order.

**Correct order:**
```typescript
await recalculateSnapshots(app, employeeId, startDate);
await updateOvertimeAccount(app, employeeId);
```

### Risk 2: Existing overtime-calc.test.ts depends on GET triggering recalc

`apps/api/src/__tests__/overtime-calc.test.ts` line 33: test "overtime recalculates on GET" creates an entry directly in the DB (bypassing the API route, so no `updateOvertimeAccount` fires) and then asserts the GET response changes. After D-01 removes the GET-time recalc, this test will fail.

**Required change:** Rewrite the test to create entries via `POST /api/v1/time-entries` (which fires `updateOvertimeAccount`) and assert balance change via GET (which now reads the stored value).

Similarly, line 77 test "overtime saldo includes today only when entries exist" may need the same fix — it also uses `app.prisma.timeEntry.create` directly.

### Risk 3: imports.ts updateOvertimeAccount call on partial batch failures

The import loop continues on per-row errors (pushes to `results` with `status: "error"` and continues). The post-loop `updateOvertimeAccount` calls should only run for employees where at least one entry was successfully imported.

**Mitigation:** Collect `employeeId` into `affectedEmployeeIds` set only inside the `ok` result branch, not on error.

### Risk 4: Leave rejection does NOT need updateOvertimeAccount

When `PENDING → REJECTED` (the non-approval branch at line 638), expected hours are not affected (leave was never active). No `updateOvertimeAccount` call needed. This is intentional — avoid any accidental inclusion.

### Risk 5: TypeScript types for dashboard leave query

After adding `status: true` to the leave select, the `leave` variable type changes from `{ employeeId, startDate, endDate, leaveType: { name } }` to include `status`. The TypeScript compiler will enforce that `resolvePresenceState`'s `PresenceLeave` type matches what's passed. The `status` field type from Prisma will be `LeaveRequestStatus` (enum string). The `PresenceLeave` interface should use string literals `"APPROVED" | "CANCELLATION_REQUESTED"` to avoid importing the Prisma enum into the utility.

---

## Sources

All findings verified via direct file reads of the codebase. No external sources required.

- `apps/api/src/routes/overtime.ts` — GET handler (lines 29–76) [VERIFIED]
- `apps/api/src/routes/time-entries.ts` — `updateOvertimeAccount` definition (lines 1223–1360), call sites (lines 409, 636, 883, 1045, 1152, 1204) [VERIFIED]
- `apps/api/src/routes/leave.ts` — review handler (lines 480–818), delete handler (lines 878–929), all `updateOvertimeAccount` grep results: none found [VERIFIED]
- `apps/api/src/routes/imports.ts` — time-entry import loop (lines 166–245): no `updateOvertimeAccount` [VERIFIED]
- `apps/api/src/plugins/auto-close-month.ts` — monthly close (lines 258–289), yearly close (lines 318–413): both upsert OvertimeAccount directly [VERIFIED]
- `apps/api/src/utils/recalculate-snapshots.ts` — upserts OvertimeAccount at line 166–170, but only when snapshots exist [VERIFIED]
- `apps/api/src/routes/dashboard.ts` — team-week handler (lines 104–295): leave query (lines 141–154), time entry select (lines 131–138), inline status logic (lines 241–272) [VERIFIED]
- `apps/api/src/__tests__/overtime-calc.test.ts` — integration test using GET to observe recalc (lines 33–75, 77–135): will need updating [VERIFIED]
- `apps/api/vitest.config.ts` — `fileParallelism: false`, `testTimeout: 30000`, `include: ["**/*.test.ts"]` [VERIFIED]
