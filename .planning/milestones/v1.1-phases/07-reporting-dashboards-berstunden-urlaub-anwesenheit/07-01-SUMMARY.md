---
phase: 07
plan: 01
subsystem: api
tags: [reporting, dashboard, attendance, overtime, leave, integration-tests]
dependency_graph:
  requires: []
  provides: [RPT-01, RPT-02, RPT-03, SALDO-03]
  affects: [apps/api/src/routes/dashboard.ts, apps/api/src/routes/reports.ts]
tech_stack:
  added: []
  patterns: [bulk-fetch, in-memory-grouping, presence-resolver-reuse, saldo-snapshot-sparkline]
key_files:
  created: []
  modified:
    - apps/api/src/routes/dashboard.ts
    - apps/api/src/routes/reports.ts
    - apps/api/src/routes/__tests__/reports.test.ts
decisions:
  - "classifyOvertimeBalance inline in dashboard.ts (not imported from overtime.ts) — overtime.ts has no exported threshold constants; comment keeps them in sync"
  - "today-attendance uses 5 bulk queries mirroring team-week pattern — no per-employee DB hits"
  - "pendingDays uses startDate-year-range filter (UTC boundaries) instead of extracting year from DB — avoids DB function, simpler, matches Prisma patterns"
metrics:
  duration_minutes: 7
  tasks_completed: 3
  files_modified: 3
  completed_date: "2026-04-11"
---

# Phase 07 Plan 01: Dashboard & Reports API Endpoints Summary

Three backend endpoints added/extended to supply data contracts for the Phase 7 frontend plans (07-02, 07-03). All endpoints use bulk queries with no N+1 patterns, enforce tenant isolation, require ADMIN/MANAGER role, and follow CLAUDE.md soft-delete and audit-proof rules.

## What Was Built

### GET /api/v1/reports/leave-overview (extended — RPT-02)

Response rows now include `pendingDays: number` — the sum of days from PENDING LeaveRequest rows matching the same employeeId + leaveTypeId + year.

- ONE additional `findMany` (year-scoped, `deletedAt: null`, `employee: { tenantId }`), no loop-internal queries
- In-memory `Map<"empId:leaveTypeId", number>` for O(1) lookup per row
- All 6 test cases pass: zero pending, count correct, different year excluded, non-PENDING statuses excluded, soft-deleted excluded, cross-tenant isolation

### GET /api/v1/dashboard/today-attendance (new — RPT-03)

Returns per-employee presence status for today plus aggregate summary counts.

- 5 bulk queries: employees, timeEntries (today, WORK, deletedAt:null), leaveRequests (APPROVED+CANCELLATION_REQUESTED, covering today, deletedAt:null), absences (covering today, deletedAt:null), workSchedules (validFrom <= today)
- `resolvePresenceState()` from `apps/api/src/utils/presence.ts` reused verbatim — not re-implemented
- Response shape: `{ date, employees[{id, name, employeeNumber, status, reason}], summary{present, absent, clockedIn, missing} }`
- All 9 test cases pass including 403-for-EMPLOYEE, tenant isolation

### GET /api/v1/dashboard/overtime-overview (new — RPT-01 + SALDO-03)

Returns overtime balance + last-6-months SaldoSnapshot sparkline data for every active employee in the tenant.

- Exactly 2 Prisma queries: `overtimeAccount.findMany` (joins employee, tenant-scoped, active) + `saldoSnapshot.findMany` (last 6 months MONTHLY, `employeeId: { in: [...] }`)
- Reads `OvertimeAccount.balanceHours` directly — no recalculation (SALDO-01 invariant preserved)
- `classifyOvertimeBalance`: abs<=20 → NORMAL, abs<=40 → ELEVATED, else → CRITICAL (matches overtime.ts thresholds, comment for sync)
- Empty snapshots returns `[]` (frontend sparkline falls back to "kein Verlauf")
- All 10 test cases pass including threshold checks, 6-month cutoff, empty snapshots, tenant isolation, 403-for-EMPLOYEE

## Test Coverage Added

| Describe block | Cases | File |
|---|---|---|
| leave-overview pendingDays (RPT-02) | 6 | reports.test.ts |
| today-attendance (RPT-03) | 9 | reports.test.ts |
| overtime-overview (RPT-01 + SALDO-03) | 10 | reports.test.ts |

**Total new test cases: 25** — all passing.

## Deviations from Plan

None — plan executed exactly as written.

## CLAUDE.md Compliance Verification

- [x] `deletedAt: null` on TimeEntry, LeaveRequest, Absence findMany calls
- [x] `employee: { tenantId: req.user.tenantId }` tenant isolation on all data queries
- [x] `requireRole("ADMIN", "MANAGER")` on all three new/extended handlers
- [x] No per-employee loops with Prisma calls (all bulk, in-memory grouping only)
- [x] `resolvePresenceState()` reused from presence.ts — not reimplemented
- [x] No mutation of any model, no audit log needed (read-only endpoints)
- [x] `OvertimeAccount.balanceHours` read directly — SALDO-01 invariant: no recalculation

## Confirmed Invariants

- **SALDO-01**: `OvertimeAccount.balanceHours` is the authoritative overtime balance. `/overtime-overview` reads it directly without any time-entry recalculation.
- **Tenant isolation**: All three endpoints proven by cross-tenant test cases (Cases 6, 9, 9 respectively).
- **Role guards**: EMPLOYEE role returns 403 on all new dashboard endpoints.
- **Soft-delete filters**: `deletedAt: null` present on all relevant findMany queries — verified by test fixtures including soft-deleted rows.

## Self-Check: PASSED

Files created/modified:
- FOUND: apps/api/src/routes/dashboard.ts
- FOUND: apps/api/src/routes/reports.ts
- FOUND: apps/api/src/routes/__tests__/reports.test.ts

Commits (all on branch `worktree-agent-a268adf5`):
- df0c2fa test(07-01): add failing test for leave-overview pendingDays
- b64777c feat(07-01): add pendingDays to GET /reports/leave-overview (RPT-02)
- a07a1e8 test(07-01): add failing test for dashboard today-attendance
- 56d8b58 feat(07-01): add GET /dashboard/today-attendance (RPT-03)
- d885943 test(07-01): add failing test for overtime-overview endpoint
- 0b17b58 feat(07-01): add GET /dashboard/overtime-overview (RPT-01 + SALDO-03)
