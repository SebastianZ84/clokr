---
phase: 05-saldo-performance-presence-resolver
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - apps/api/src/__tests__/overtime-calc.test.ts
  - apps/api/src/__tests__/presence.test.ts
  - apps/api/src/routes/dashboard.ts
  - apps/api/src/routes/imports.ts
  - apps/api/src/routes/leave.ts
  - apps/api/src/routes/overtime.ts
  - apps/api/src/utils/presence.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

This phase introduces the snapshot-based saldo calculation (Monatsabschluss), the presence-state resolver utility, and a team-week dashboard view. The core logic in `utils/presence.ts` is clean and well-tested. The `overtime.ts` route correctly handles snapshot creation, locking, and year-close. However, several security and correctness issues were found: a missing tenant-isolation check on the overtime-account read endpoint, an unguarded non-null assertion in the `my-week` handler, hardcoded time parsing that silently truncates time zones in the CSV import, and duplicated missing-days logic across two `overtime.ts` handlers that is error-prone. The leave-cancellation path also has a subtle audit-logic bug.

---

## Critical Issues

### CR-01: Missing tenant isolation on `GET /overtime/:employeeId`

**File:** `apps/api/src/routes/overtime.ts:35`

**Issue:** The `GET /:employeeId` handler reads an `OvertimeAccount` directly by `employeeId` without verifying that the requested employee belongs to the authenticated user's tenant. An authenticated employee from tenant A can request the overtime balance of an employee from tenant B by guessing or brute-forcing their UUID.

```typescript
// Current — no tenant check
const account = await app.prisma.overtimeAccount.findUnique({
  where: { employeeId },
  ...
});
```

**Fix:**
```typescript
// Verify employee belongs to requester's tenant first
const employee = await app.prisma.employee.findUnique({
  where: { id: employeeId },
  select: { tenantId: true },
});
if (!employee || employee.tenantId !== req.user.tenantId) {
  return reply.code(404).send({ error: "Konto nicht gefunden" });
}
const account = await app.prisma.overtimeAccount.findUnique({
  where: { employeeId },
  ...
});
```

The same tenant check is also missing on `GET /snapshots/:employeeId` (line 851) — an employee can read another tenant's snapshots.

---

### CR-02: Unguarded non-null assertion `employeeId!` crashes for API-only users in `/my-week`

**File:** `apps/api/src/routes/dashboard.ts:295`

**Issue:** The `my-week` handler uses `req.user.employeeId!` (non-null assertion) without the null guard present in the personal dashboard handler (lines 23-31). An API-key user or an admin without an employee record triggers a Prisma crash at the `findMany` call because `employeeId` is `undefined`.

```typescript
// Line 295 — crashes when employeeId is undefined
const employeeId = req.user.employeeId!;
```

**Fix:**
```typescript
const employeeId = req.user.employeeId;
if (!employeeId) {
  return { weekDays: [], days: [] };
}
```

The same unguarded assertion exists in `open-items` at line 351.

---

## Warnings

### WR-01: CSV time import silently treats times as UTC, breaks for non-UTC tenants

**File:** `apps/api/src/routes/imports.ts:207`

**Issue:** Time entries parsed from CSV have their `startTime`/`endTime` constructed by appending `T{time}:00.000Z` — forcing UTC interpretation regardless of the tenant's configured timezone. A German tenant (Europe/Berlin, UTC+2 in summer) importing `09:00` actually creates an entry at 11:00 local time. There is no audit trail for the offset applied.

```typescript
const startTime = new Date(`${dateStr}T${data.startTime}:00.000Z`);
const endTime   = new Date(`${dateStr}T${data.endTime}:00.000Z`);
```

**Fix:** Look up the tenant timezone and convert using `date-fns-tz` before persisting:
```typescript
import { fromZonedTime } from "date-fns-tz";
const tz = await getTenantTimezone(app.prisma, req.user.tenantId);
const startTime = fromZonedTime(`${dateStr}T${data.startTime}:00`, tz);
const endTime   = fromZonedTime(`${dateStr}T${data.endTime}:00`, tz);
```

---

### WR-02: `close-month` does not guard against negative `workedMinutes` stored in snapshot

**File:** `apps/api/src/routes/overtime.ts:744`

**Issue:** `workedMinutes` is calculated as:
```typescript
const workedMinutes = entries.reduce((sum, e) => {
  return sum + (e.endTime.getTime() - e.startTime.getTime()) / 60000 - Number(e.breakMinutes);
}, 0);
```
If `breakMinutes` is larger than the duration (data-entry error), the value goes negative. `Math.round(workedMinutes)` is then persisted unchanged (line 804). A snapshot with `workedMinutes: -120` is permanently locked and misleads subsequent carry-over calculations. The same issue exists in the dashboard's week calculation.

**Fix:**
```typescript
const workedMinutes = Math.max(0, entries.reduce((sum, e) => {
  if (!e.endTime) return sum;
  return sum + (e.endTime.getTime() - e.startTime.getTime()) / 60000 - Number(e.breakMinutes);
}, 0));
```

---

### WR-03: Massive code duplication of missing-days logic across two route handlers

**File:** `apps/api/src/routes/overtime.ts:246` and `apps/api/src/routes/overtime.ts:498`

**Issue:** The logic that identifies missing workdays (building `coveredDates` from leave/absence/holidays, iterating the month, checking `getDayHoursFromSchedule`) is copy-pasted verbatim across the `GET /close-month/status` handler (lines 246–340) and the `GET /close-month/year-status` handler (lines 498–585). Any bug fix or rule change applied to one copy will be silently missed in the other. A previous review or future bugfix is highly likely to diverge.

**Fix:** Extract a shared helper function:
```typescript
async function getMissingWorkdays(
  app: FastifyInstance,
  emp: { id: string; hireDate: Date; workSchedules: WorkSchedule[] },
  monthStart: Date,
  monthEnd: Date,
  tenantId: string,
  tz: string,
): Promise<string[]>
```

---

### WR-04: `close-year` requires exactly 12 monthly snapshots regardless of hire date

**File:** `apps/api/src/routes/overtime.ts:909`

**Issue:** The year-close validation requires `monthSnapshots.length < 12`, treating an employee hired in, say, September as needing 12 monthly snapshots (January through December). An employee hired mid-year cannot have snapshots for months before their hire date by design, so `close-year` will always reject with an error listing the pre-hire months as missing.

```typescript
if (monthSnapshots.length < 12) {
  // always fails for employees hired mid-year
}
```

**Fix:** Compute the expected number of snapshots from the employee's hire date:
```typescript
const hireYear = employee.hireDate.getFullYear();
const startMonth = hireYear === year ? employee.hireDate.getMonth() + 1 : 1;
const expectedMonths = 12 - startMonth + 1; // months from hire month to December
if (monthSnapshots.length < expectedMonths) { ... }
```

---

### WR-05: Leave cancellation audit action incorrectly maps `APPROVED` cancellation to `"CANCEL"` audit action but approval to `"REJECT"`

**File:** `apps/api/src/routes/leave.ts:596`

**Issue:** When a cancellation request is reviewed, the audit log action is:
```typescript
action: body.status === "APPROVED" ? "CANCEL" : "REJECT",
```
`body.status === "APPROVED"` here means "the cancellation was approved" (i.e., the leave is cancelled). `body.status === "REJECTED"` means "the cancellation was rejected" (i.e., the leave remains active). The `"REJECT"` label therefore goes into the audit log when the leave is *reinstated*, which is semantically confusing and makes the audit trail ambiguous — future auditors reading `"REJECT"` cannot determine whether the leave itself or the cancellation was rejected.

**Fix:** Use more descriptive audit action strings:
```typescript
action: body.status === "APPROVED" ? "CANCEL_APPROVED" : "CANCEL_REJECTED",
```

---

### WR-06: `GET /close-month/status` N+1 queries inside employee loop

**File:** `apps/api/src/routes/overtime.ts:203`

**Issue:** For each unclosed employee, the handler fires at least 4 sequential DB queries (snapshot check, time entries, leave requests, absences + holidays). For a tenant with 50 employees in a past month, this generates ~200+ round trips in a single HTTP request. This is not a performance-only issue — under load it also causes request timeouts that prevent admins from checking month-close status at all, making it a functional correctness issue.

**Fix:** Batch queries outside the loop (all snapshots in one query, all entries in one query keyed by employeeId, etc.) and aggregate in memory.

---

## Info

### IN-01: `pastDate()` uses `toISOString()` which relies on local server timezone

**File:** `apps/api/src/__tests__/overtime-calc.test.ts:12`

**Issue:** `d.toISOString().split("T")[0]` returns the UTC date. If the test server runs in a timezone west of UTC (e.g. UTC-5), and the test is run near midnight, `new Date()` may be "today" locally but `toISOString()` returns "yesterday UTC", producing a date mismatch against the API which uses Europe/Berlin. The test comment on line 12 acknowledges this ("Uses the local date (server TZ)") but the fix is partial.

**Suggestion:** Use `dateStrInTz(new Date(), "Europe/Berlin")` or stub the timezone in tests to make behavior deterministic.

---

### IN-02: `dashboard.ts` `/my-week` re-implements inline presence logic instead of using `resolvePresenceState`

**File:** `apps/api/src/routes/dashboard.ts:326`

**Issue:** The `my-week` handler computes a `status` string with inline logic (clocked_in / complete / partial / missing / scheduled / none) that is semantically equivalent to, but structurally different from, `resolvePresenceState`. The two implementations can diverge. The `team-week` handler already uses `resolvePresenceState` correctly.

**Suggestion:** Refactor `my-week` to use `resolvePresenceState` for consistency, or at minimum add a comment noting the intentional divergence.

---

### IN-03: Commented-out `TODO` — separate test DB for CI

**File:** `apps/api/src/__tests__/overtime-calc.test.ts:line not visible` (referenced in CLAUDE.md as "// TODO: separate test DB for CI")

**Issue:** Tests share a live DB, meaning parallel test runs can corrupt each other's data. This is a known risk documented in CLAUDE.md.

**Suggestion:** Track this as a GitHub issue if not already; the `cleanupTestData` / `seedTestData` pattern is a reasonable short-term workaround.

---

### IN-04: `overtime.ts` `close-month` approval missing request IP/headers in audit call

**File:** `apps/api/src/routes/overtime.ts:832`

**Issue:** The `close-year` audit call (line 971) passes `request: { ip, headers }` but the `close-month` audit call (line 832) does not:
```typescript
await app.audit({
  userId: req.user.sub,
  action: "CREATE",
  entity: "SaldoSnapshot",
  entityId: snapshot.id,
  newValue: snapshot,
  // missing: request: { ip: req.ip, headers: req.headers as Record<string, string> }
});
```

Per CLAUDE.md audit requirements, all mutations must log IP and user agent. The missing IP makes it impossible to trace which client performed the month-close.

**Fix:** Add `request: { ip: req.ip, headers: req.headers as Record<string, string> }` to the `close-month` audit call.

---

_Reviewed: 2026-04-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
