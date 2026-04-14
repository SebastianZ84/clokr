---
phase: 15
slug: tenant-holiday-deduction-configuration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-13
audited: 2026-04-14
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @clokr/api test --run minijob` |
| **Full suite command** | `pnpm --filter @clokr/api test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @clokr/api test --run minijob`
- **After every plan wave:** Run `pnpm --filter @clokr/api test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | TENANT-01 | — | N/A | integration | `pnpm --filter @clokr/api test --run minijob` | ✅ | ✅ green |
| 15-01-02 | 01 | 1 | TENANT-01 | T-15-01 | requireRole("ADMIN") gates toggle | integration | `pnpm --filter @clokr/api test --run minijob` | ✅ | ✅ green |
| 15-02-01 | 02 | 2 | TENANT-01 | — | Toggle on → qualifying holidays reduce expected | integration | `pnpm --filter @clokr/api test --run minijob` | ✅ | ✅ green |
| 15-02-02 | 02 | 2 | TENANT-01 | — | Toggle off → no deduction (default behavior preserved) | integration | `pnpm --filter @clokr/api test --run minijob` | ✅ | ✅ green |
| 15-02-03 | 02 | 2 | TENANT-01 | — | Pure tracking (monthlyHours=null) + toggle on → no crash | integration | `pnpm --filter @clokr/api test --run minijob` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — `apps/api/src/routes/__tests__/minijob.test.ts` already exists and covers the MONTHLY_HOURS domain. New test cases extend this file.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin toggle visible in system/+page.svelte under "Arbeitszeit" | TENANT-01 | UI-only | Navigate to Admin → System → confirm toggle renders with correct label |
| Toggle state persists across page reload | TENANT-01 | UI-only | Enable toggle, reload, verify checked state |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-14 — 17/17 tests green

---

## Validation Audit 2026-04-14

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 5 |
| Escalated | 0 |

All 5 tasks covered by `apps/api/src/routes/__tests__/minijob.test.ts` (17 tests total, run: `pnpm --filter @clokr/api test --run minijob`, duration ~2.4s).
