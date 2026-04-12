# Phase 5: Saldo Performance & Presence Resolver - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-11
**Phase:** 05-saldo-performance-presence-resolver
**Mode:** discuss
**Areas discussed:** CANCELLATION_REQUESTED status, Staleness safeguard

## Gray Areas Presented

| Area | Description |
|------|-------------|
| CANCELLATION_REQUESTED status | What the attendance dashboard shows when leave is CANCELLATION_REQUESTED |
| Staleness safeguard | Whether GET /overtime/:employeeId should fall back to recalculation if balance is stale |

## Decisions Made

### CANCELLATION_REQUESTED presence status
- **Options presented:** (a) absent + "Urlaubsstornierung beantragt", (b) absent + original leave type, (c) new API status string
- **User chose:** "absent + 'Urlaubsstornierung beantragt'"
- **Rationale:** Leave is still legally active until cancellation is approved. Consistent with existing status vocabulary, no new API shape needed, transparent for managers.

### Staleness safeguard for GET endpoint
- **Options presented:** (a) Pure stored read — no fallback, (b) Recalculate if balance >24h stale
- **User chose:** "Pure stored read — no fallback"
- **Rationale:** SALDO-01 is explicit about O(1) reads. SALDO-02 closes write paths. Missed write paths should surface in tests, not silently in production.

## Codebase Bugs Identified During Analysis

1. `dashboard.ts` time entry query does not filter `isInvalid: true` — invalid entries incorrectly mark employees as "present"
2. `dashboard.ts` leave query only fetches `status: "APPROVED"` — `CANCELLATION_REQUESTED` leaves are invisible to the attendance dashboard
3. `leave.ts` has no calls to `updateOvertimeAccount` despite leave approvals/cancellations changing expected hours
4. `imports.ts` has no call to `updateOvertimeAccount` after bulk time entry inserts

## No Corrections

All assumptions confirmed — no user corrections needed.
