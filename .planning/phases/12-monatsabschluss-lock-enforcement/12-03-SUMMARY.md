---
phase: 12-monatsabschluss-lock-enforcement
plan: 03
subsystem: testing
tags: [vitest, fastify, lock-enforcement, saldo-snapshot, monatsabschluss, integration-tests]

# Dependency graph
requires:
  - phase: 12-monatsabschluss-lock-enforcement
    plan: 01
    provides: "POST /time-entries lock guard, POST /overtime/unlock-month endpoint, earlyClose response on close-month"
provides:
  - "Integration test suite for lock enforcement behaviors (D-01, D-02, D-03, D-04, D-05, D-12)"
  - "Regression protection for SaldoSnapshot-based 403 guard on POST /time-entries"
  - "Regression protection for unlock-month role check, snapshot deletion, entry unlock, month isolation"
  - "Regression protection for tenant isolation on unlock-month"
  - "D-12 verified: earlyClose absent for expired grace periods"
affects:
  - 12-monatsabschluss-lock-enforcement

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "afterEach snapshot cleanup pattern: delete all snapshots for employee after each test group to prevent state bleed"
    - "Unique-month-per-test pattern: each test uses a distinct calendar month to be fully independent"
    - "fake-UUID tenant isolation: RFC 4122 v4 UUID that doesn't exist in DB tests the same guard path as cross-tenant"

key-files:
  created:
    - apps/api/src/__tests__/lock-enforcement.test.ts
  modified: []

key-decisions:
  - "Fake UUID for basic tenant isolation test must pass Zod UUID validation — '00000000-0000-0000-0000-000000000001' fails strict RFC 4122 (variant bits); use a properly formatted v4 UUID that won't exist in DB"
  - "earlyClose:true cannot be tested deterministically without Date.now() mocking — test documents the false path (expired grace period) and explains why true path requires time injection"
  - "afterEach cleanup for the lock-guard describe block prevents snapshot state from bleeding across tests in that group"

patterns-established:
  - "Lock-enforcement test pattern: create snapshot via Prisma directly, inject API call, verify status code, cleanup in afterAll + afterEach"

requirements-completed: [BUG-02]

# Metrics
duration: 20min
completed: 2026-04-13
---

# Phase 12 Plan 03: Lock Enforcement Integration Tests Summary

**13 Vitest integration tests covering POST /time-entries lock guard (D-04/D-05), unlock-month role check and atomicity (D-01/D-02/D-03), tenant isolation (T-12-05), and close-month earlyClose response (D-12) — all green**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-13T19:00:00Z
- **Completed:** 2026-04-13T19:20:00Z
- **Tasks:** 1 (TDD: RED+GREEN combined — implementation pre-existed from Wave 1)
- **Files modified:** 1 (created)

## Accomplishments

- Created consolidated integration test file `apps/api/src/__tests__/lock-enforcement.test.ts` with 13 test cases spanning 5 describe blocks
- Tests cover all behaviors specified in the plan: time-entry lock guard, unlock-month role enforcement, atomic unlock transaction, cross-month isolation, tenant isolation, and earlyClose response absence
- All 13 tests pass green on first full run (Wave 1 implementation correct)
- Full test suite still passes with same 3 pre-existing failures (clock-in conflict + overtime-calc — confirmed pre-existing per 12-01 SUMMARY)

## Task Commits

1. **Task 1 RED+GREEN: lock-enforcement integration tests** - `84f3282` (test)

## Files Created/Modified

- `apps/api/src/__tests__/lock-enforcement.test.ts` - 13 integration tests for D-01, D-02, D-03, D-04, D-05, D-12, T-12-05; uses `afterEach` snapshot cleanup and unique calendar months per test to prevent state bleed

## Decisions Made

- **Fake UUID must be RFC 4122 v4 compliant:** The initial `00000000-0000-0000-0000-000000000001` UUID failed Zod's strict UUID validation with a 400 response instead of 404. Switched to `f47ac10b-58cc-4372-a567-000000000001` (v4 format, non-existent in DB) to match the documented plan behavior.
- **earlyClose:true not tested deterministically:** The grace period test documents that `earlyClose:true` requires calling `POST /close-month` within the first 14 days of the month following the target month. This cannot be tested without mocking `Date.now()`. The test verifies the `false` path (expired grace period = earlyClose key absent from response) which is always deterministic.
- **afterEach cleanup in lock-guard describe block:** The first describe block uses `afterEach` to delete all snapshots after each test, since each test creates a snapshot for a different month. This prevents snapshot accumulation from causing unique constraint violations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed fake UUID failing Zod UUID validation**
- **Found during:** Task 1 (GREEN phase — test returning 400 instead of 404)
- **Issue:** The plan suggested `00000000-0000-0000-0000-000000000001` as the fake employee ID. This UUID has all-zero variant bits, which fails Zod's strict RFC 4122 UUID validation. The endpoint's Zod schema returned 400 (validation error) rather than proceeding to the employee lookup.
- **Fix:** Replaced with `f47ac10b-58cc-4372-a567-000000000001`, a properly formatted v4 UUID that will never exist in the test DB. This passes Zod validation and proceeds to the DB lookup, returning 404.
- **Files modified:** `apps/api/src/__tests__/lock-enforcement.test.ts`
- **Verification:** Test now returns 404 with `{ error: "Mitarbeiter nicht gefunden" }`
- **Committed in:** `84f3282` (same test commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for the tenant isolation test to reach the intended code path. No scope change. Implementation unchanged.

## Issues Encountered

- Worktree `node_modules` was missing — ran `pnpm install` and `pnpm --filter @clokr/db exec prisma generate` before tests could run. This is a normal worktree setup step, not a test issue.
- Worktree `.env.test` missing — copied from main repo `apps/api/.env.test`.

## User Setup Required

None - no external service configuration required.

## Threat Surface Scan

No new threat surface introduced — this plan only creates test files. No network endpoints, auth paths, or schema changes.

## Known Stubs

None - all test assertions are concrete. No placeholder tests or skipped assertions that affect coverage of the plan's goals.

## Next Phase Readiness

- Lock enforcement behaviors are now covered by automated regression tests
- Running `pnpm --filter @clokr/api test --run lock-enforcement` provides instant feedback on any future changes to `time-entries.ts` or `overtime.ts` that would break lock enforcement
- Phase 12 is feature-complete: API lock guard (12-01), UI indicators (12-02), regression tests (12-03)

## Self-Check

- [x] `apps/api/src/__tests__/lock-enforcement.test.ts` exists (578 lines)
- [x] Test count: `grep -c "it(" lock-enforcement.test.ts` = 13 (>= 8 required)
- [x] All 13 tests pass: `pnpm --filter @clokr/api test --run lock-enforcement` → 13 passed
- [x] No regressions: full suite = 387 passed, 3 pre-existing failures (unchanged)
- [x] Commit `84f3282` exists

## Self-Check: PASSED

---
*Phase: 12-monatsabschluss-lock-enforcement*
*Completed: 2026-04-13*
