---
phase: 2
slug: compliance-and-api-coverage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @clokr/api test -- --reporter=verbose` |
| **Full suite command** | `pnpm --filter @clokr/api test -- --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @clokr/api test -- --reporter=verbose`
- **After every plan wave:** Run `pnpm --filter @clokr/api test -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SEC-01 | unit | `pnpm --filter @clokr/api test -- arbzg` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 1 | SEC-02 | integration | `pnpm --filter @clokr/api test -- tenant-isolation` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | SEC-03 | integration | `pnpm --filter @clokr/api test -- audit-trail` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | API-01..API-06 | unit | `pnpm --filter @clokr/api test -- soft-delete` | ✅ | ⬜ pending |
| 02-05-01 | 05 | 2 | SEC-04, SEC-05 | integration | `pnpm --filter @clokr/api test -- locked-month` | ✅ | ⬜ pending |
| 02-06-01 | 06 | 3 | AUDIT-02 | manual+unit | `pnpm --filter @clokr/web build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/tenant-isolation.test.ts` — stubs for SEC-02
- [ ] `apps/api/src/__tests__/audit-trail.test.ts` — stubs for SEC-03

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google Fonts eliminated | AUDIT-02 | Visual + CSP check | Build web app, inspect network tab — no requests to fonts.googleapis.com or fonts.gstatic.com |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
