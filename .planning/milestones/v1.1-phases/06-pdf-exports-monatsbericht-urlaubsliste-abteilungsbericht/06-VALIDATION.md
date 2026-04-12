---
phase: 6
slug: pdf-exports-monatsbericht-urlaubsliste-abteilungsbericht
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @clokr/api test -- --reporter=verbose apps/api/src/routes/__tests__/reports.test.ts` |
| **Full suite command** | `pnpm --filter @clokr/api test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (reports.test.ts)
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | PDF-04 | — | N/A | unit | `pnpm --filter @clokr/api test -- reports.test.ts` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | PDF-01 | T-06-01 | Tenant isolation — only own tenant employees in PDF | integration | `pnpm --filter @clokr/api test -- reports.test.ts` | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | PDF-02 | T-06-01 | Tenant isolation on leave list | integration | `pnpm --filter @clokr/api test -- reports.test.ts` | ✅ | ⬜ pending |
| 06-01-04 | 01 | 1 | PDF-03 | — | Role filter returns only matching employees | integration | `pnpm --filter @clokr/api test -- reports.test.ts` | ✅ | ⬜ pending |
| 06-01-05 | 01 | 1 | PDF-05 | — | Content-Type: application/pdf, streaming response | integration | `pnpm --filter @clokr/api test -- reports.test.ts` | ✅ | ⬜ pending |
| 06-02-01 | 02 | 2 | PDF-01 | — | Company PDF download button visible and functional | manual | Browser test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The `reports.test.ts` file exists and uses `seedTestData` + `getTestApp`. New tests for the new endpoints can be added to the existing file.

*No new test infrastructure needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streamed PDF opens correctly in browser PDF viewer | PDF-05 | Cannot assert PDF content validity in integration test (binary blob) | Download from /reports page, verify PDF opens with correct content |
| Company monthly PDF contains all employees | PDF-01 | Content assertion on PDF binary is impractical | Check downloaded PDF has all employee rows |
| Vacation list PDF shows individual booking periods | PDF-02 | PDF content inspection | Verify start/end dates in downloaded PDF |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
