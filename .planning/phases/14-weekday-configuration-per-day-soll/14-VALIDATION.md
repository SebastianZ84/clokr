---
phase: 14
slug: weekday-configuration-per-day-soll
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (API integration tests) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/minijob.test.ts` |
| **Full suite command** | `pnpm --filter @clokr/api test --run` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/minijob.test.ts`
- **After every plan wave:** Run `pnpm --filter @clokr/api test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | SCHED-04 | — | N/A | integration | `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/minijob.test.ts` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | SCHED-04 | — | N/A | integration | `pnpm --filter @clokr/api test --run apps/api/src/routes/__tests__/minijob.test.ts` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 2 | SCHED-05 | — | N/A | manual | browser: calendar day cell shows dailySoll for configured weekdays | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | SCHED-05 | — | N/A | manual | browser: no Soll shown for non-configured weekdays | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers API side: `apps/api/src/routes/__tests__/minijob.test.ts` already exists and tests MONTHLY_HOURS schedule PUT.
- New test stubs for SCHED-04 (PUT stores non-zero day fields for MONTHLY_HOURS) to be added as Wave 0 in Plan 01.

*Frontend calendar changes (SCHED-05) require manual verification — no automated UI test infrastructure in scope.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toggle chips render for MONTHLY_HOURS, hidden for FIXED_WEEKLY | SCHED-04 | Visual rendering in Svelte template | Open admin modal for MONTHLY_HOURS employee, verify Mo/Di/Mi/Do/Fr/Sa/So chips appear |
| Calendar shows dailySoll = monthlyBudget ÷ working days | SCHED-05 | Calendar data flow requires browser rendering | Navigate to time-entries for MONTHLY_HOURS employee with Mon–Fri configured, verify each weekday cell shows dailySoll |
| No Soll shown when all day fields = 0 | SCHED-05 | Conditional rendering | Set all chips to deselected, verify calendar shows no per-day target |
| +/- delta shown in green/red per configured day | SCHED-05 | Color rendering | Log a time entry, verify delta color in calendar cell |
| Mon–Fri pre-selected when switching to MONTHLY_HOURS | SCED-04 | UI state initialization | In admin modal, switch schedule type from FIXED_WEEKLY to MONTHLY_HOURS, verify Mo–Fr chips selected |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
