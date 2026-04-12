# Phase 5: Saldo Performance & Presence Resolver - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only phase. Remove the eager saldo recalculation from GET /overtime/:employeeId (SALDO-01), close the missing write-caller gaps so the stored balance stays authoritative (SALDO-02), and extract a tested `resolvePresenceState()` utility that correctly handles CANCELLATION_REQUESTED leave + isInvalid entries (RPT-04). No new UI, no new API routes, no schema changes.

</domain>

<decisions>
## Implementation Decisions

### SALDO-01: GET endpoint recalculation removal
- **D-01:** Remove the eager `updateOvertimeAccount()` call from the GET /overtime/:employeeId handler. The handler reads and returns the stored `balanceHours` directly — O(1), no recalculation.
- **D-02:** No staleness fallback. If a write path is ever missed, it fails tests, not silently in production. Pure stored read.

### SALDO-02: Write-caller coverage
- **D-03:** `updateOvertimeAccount` must be called on all leave status transitions that affect expected hours: leave APPROVED, leave CANCELLED (after cancellation approval), leave rejection (back to non-approved state). Add the missing calls to `leave.ts`.
- **D-04:** Bulk imports (`imports.ts`) must also call `updateOvertimeAccount` per affected employee after inserting time entries.
- **D-05:** The `auto-close-month.ts` plugin (cron) creates SaldoSnapshots — verify it also calls `updateOvertimeAccount` after snapshot creation so the stored balance reflects the snapshot carryOver as the new base.

### RPT-04: resolvePresenceState() utility
- **D-06:** Extract presence state logic into a new file `apps/api/src/utils/presence.ts` (not module scope in dashboard.ts — needs to be importable by tests).
- **D-07:** The function signature operates on plain data (not Prisma client), taking entries, leave requests, absences, and the day string as parameters — fully unit-testable without DB.
- **D-08:** Presence detection filters out `isInvalid: true` entries — invalid entries do NOT count as "present" or "clocked_in".
- **D-09:** When leave status is `CANCELLATION_REQUESTED`, the employee shows as `status: "absent"` with `reason: "Urlaubsstornierung beantragt"`. Leave remains legally active until cancellation is approved.
- **D-10:** The `dashboard.ts` team-week query must be updated to also fetch `CANCELLATION_REQUESTED` leaves (in addition to `APPROVED`), and pass `isInvalid` field from the time entry query so the utility can filter correctly.

### Claude's Discretion
- Exact function signature and input types for `resolvePresenceState()`
- Test file location and test case structure for the utility
- Whether to add `updatedAt` tracking to OvertimeAccount (not required — SALDO-01 explicitly avoids recalc)
- How to handle the edge case where `auto-close-month.ts` snapshot already covers today

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Overtime / Saldo
- `apps/api/src/routes/overtime.ts` — GET endpoint with current eager recalc (line 31–68); remove the `updateOvertimeAccount()` call here
- `apps/api/src/routes/time-entries.ts` — `updateOvertimeAccount` definition (line 1223); existing write callers (lines 409, 636, 883, 1045, 1152, 1204)
- `apps/api/src/plugins/auto-close-month.ts` — cron-based monthly close; check if it calls updateOvertimeAccount after snapshot creation

### Leave / Cancellation
- `apps/api/src/routes/leave.ts` — all leave status transitions (APPROVED, CANCELLATION_REQUESTED, CANCELLED); missing updateOvertimeAccount callers go here
- `apps/api/src/routes/imports.ts` — bulk import route; missing updateOvertimeAccount caller goes here

### Presence / Dashboard
- `apps/api/src/routes/dashboard.ts` — inline presence state logic (lines 193–272); bugs: isInvalid not filtered (line 195–203), only APPROVED leaves fetched (line 139–148)

### Requirements
- `.planning/REQUIREMENTS.md` — SALDO-01, SALDO-02, RPT-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `updateOvertimeAccount(app, employeeId)` in `time-entries.ts` — existing function, well-tested; just needs to be called from more places
- `app.audit()` plugin — all write operations that call updateOvertimeAccount also emit audit logs; pattern already established

### Established Patterns
- Module-to-utils extraction: Phase 4 extracted helpers to module scope in reports.ts; Phase 5 goes one step further — separate `utils/presence.ts` file for testability (similar to existing `utils/timezone.ts`, `utils/recalculate-snapshots.ts`)
- Leave status transitions follow a state machine: PENDING → APPROVED → CANCELLATION_REQUESTED → CANCELLED (or back to APPROVED on rejection)
- `isInvalid` entries already excluded from saldo calculation in `updateOvertimeAccount` (`isInvalid: false` in the where clause, line ~1311 time-entries.ts)

### Integration Points
- `resolvePresenceState()` replaces the inline status determination block in dashboard.ts `team-week` handler (lines ~245–275)
- The dashboard time entry query needs to add `isInvalid: true` to the select fields
- The dashboard leave query needs to include `CANCELLATION_REQUESTED` in the status filter and return the `status` field alongside existing fields

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references — this phase is backend-only. All decisions derived from requirements and codebase analysis.

</specifics>

<deferred>
## Deferred Ideas

- SALDO-03 (Saldo trend sparklines via SaldoSnapshot) — Phase 7, explicitly out of scope for Phase 5
- Adding `updatedAt` exposure to the overtime GET response for client-side cache-busting — not needed for Phase 5

</deferred>

---

*Phase: 05-saldo-performance-presence-resolver*
*Context gathered: 2026-04-11*
