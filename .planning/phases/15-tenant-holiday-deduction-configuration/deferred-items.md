# Deferred Items — Phase 15

## Pre-existing Test Failures (out-of-scope)

These failures existed before Phase 15 work began (confirmed by stash test). Not caused by 15-02 changes.

| File | Test | Status |
|------|------|--------|
| `__tests__/overtime-calc.test.ts` | `TRACK_ONLY close-month creates snapshot with carryOver=0 and balanceHours=0` | Pre-existing |
| `routes/__tests__/time-entries-validation.test.ts` | `allows POST /clock-in when only open entry is auto-invalidated (isInvalid: true)` | Pre-existing |
| `routes/__tests__/time-entries-validation.test.ts` | `blocks POST /clock-in with 409 when a valid open entry exists (isInvalid: false)` | Pre-existing |

These should be investigated and fixed in a separate task.
