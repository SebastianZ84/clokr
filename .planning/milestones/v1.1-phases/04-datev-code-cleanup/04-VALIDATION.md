---
phase: 4
slug: datev-code-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @clokr/api test --run` |
| **Full suite command** | `pnpm --filter @clokr/api test --run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @clokr/api test --run`
- **After every plan wave:** Run `pnpm --filter @clokr/api test --run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | DATEV-04 | — | N/A | static | `pnpm --filter @clokr/api exec tsc --noEmit` | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | DATEV-01 | — | N/A | integration | `pnpm --filter @clokr/api test --run reports` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | DATEV-02 | — | N/A | integration | `pnpm --filter @clokr/api test --run reports` | ❌ W0 | ⬜ pending |
| 4-01-04 | 01 | 1 | DATEV-03 | — | Access control already on route | integration | `pnpm --filter @clokr/api test --run reports` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/routes/__tests__/reports.test.ts` — stubs for DATEV-01, DATEV-02, DATEV-03

*(DATEV-04 is verified by TypeScript compilation — no new test file needed.)*

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CP1252 encoding visible in hex editor | DATEV-02 | Binary encoding cannot be fully asserted in unit tests | Open exported `.txt` in hex editor; verify 0xE4 for `ä`, 0xFC for `ü`, 0xF6 for `ö` |
| LODAS import accepted by DATEV software | DATEV-01 | No DATEV test environment available | Import `.txt` file into DATEV LODAS; verify no import errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
