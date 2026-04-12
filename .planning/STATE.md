---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: UI/UX Redesign (Glassmorphism)
status: planning
last_updated: "2026-04-12T00:00:00.000Z"
last_activity: 2026-04-12 — v1.2 milestone planning started
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 12
  completed_plans: 0
  percent: 0
---

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-12)

**Core value:** Clokr sieht aus wie ein modernes SaaS-Produkt — Glassmorphism-Design, 3 klare Themes (pflaume/hell/dunkel), durchgängige Designsprache auf allen Seiten.
**Current focus:** Phase 8 — Design System Foundation (run `/gsd-plan-phase 8`)

## Accumulated Context

### Milestones Shipped

| Version | Name | Shipped | Phases | Plans |
|---------|------|---------|--------|-------|
| v1.0 | Production Readiness | 2026-03-31 | 3 | 15 |
| v1.1 | Reporting & DATEV | 2026-04-12 | 4 | 12 |

### v1.2 Design Decisions (locked)

- **Glassmorphism approach:** Subtil — Cards/Widgets haben blur, Tabellen-Zeilen solid. Sticky Table-Headers dürfen Glas sein.
- **body::before Backdrop:** Jedes Theme braucht einen Gradient-Layer damit blur sichtbar wird. Aktuell `rgba(255,255,255,0.97)` → kein sichtbarer Effekt. Fix: alpha auf 0.72-0.80.
- **3 Themes:** pflaume (überarbeitet), hell (neu, blue/slate), dunkel (neu, deep navy) — nacht/wald/schiefer werden entfernt.
- **Sidebar:** Dunkler/brand-farbener Hintergrund, Icon+Label, active state via 3px Left-Border + Tint, Icon-Opacity 0.6→1.0 (kein Farbwechsel). Clockodo-Inspiration.
- **Buttons:** Pill-shaped (border-radius: 9999px) für Primary CTAs.
- **Cards:** border-radius 18px, backdrop-filter blur(16px) saturate(140%), `--glass-highlight` Top-Edge, layered shadow.
- **Fallback:** `@supports not (backdrop-filter)` → `background: var(--color-surface)`. `prefers-reduced-transparency` → blur deaktiviert.
- **CSS pitfall:** `overflow: clip` (nicht `hidden`) auf Cards mit sticky Table-Headers.
- **Scope:** CSS + Markup-Struktur änderbar. Keine Backend-Änderungen, keine neuen Features.
- **Inspiration:** Clockodo (sidebar, calendar cells, status indicators), Dribbble glassmorphism dashboards.

### Research Completed

- `.planning/research/clockodo-ui-patterns.md` — Clockodo UI-Patterns (Sidebar, Calendar, Components)
- `.planning/research/glassmorphism-design-system.md` — CSS-Token-System, Light/Dark-Werte, Accessibility, Real-World-Patterns

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260412-326 | Fix dashboard overtime trend chart to use SaldoSnapshots as data points | 2026-04-12 | 15f0683 | [260412-326](./quick/260412-326-fix-dashboard-overtime-trend-chart-to-us/) |
