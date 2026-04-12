# Roadmap: Clokr

## Milestones

- ✅ **v1.0 Production Readiness** — Phases 1-3 (shipped 2026-03-31)
- ✅ **v1.1 Reporting & DATEV** — Phases 4-7 (shipped 2026-04-12)
- 🔄 **v1.2 UI/UX Redesign (Glassmorphism)** — Phases 8-11 (in planning)

## Phases

<details>
<summary>✅ v1.0 Production Readiness (Phases 1-3) — SHIPPED 2026-03-31</summary>

See `.planning/milestones/v1.0-ROADMAP.md` for full details.

- [x] Phase 1: Test Infrastructure & Coverage (completed 2026-03-31)
- [x] Phase 2: Security & Compliance Hardening (completed 2026-03-31)
- [x] Phase 3: UI/UX Polish & Mobile (completed 2026-03-31)

</details>

<details>
<summary>✅ v1.1 Reporting & DATEV (Phases 4-7) — SHIPPED 2026-04-12</summary>

See `.planning/milestones/v1.1-ROADMAP.md` for full details.

- [x] Phase 4: DATEV Code Cleanup (4/4 plans) — completed 2026-04-11
- [x] Phase 5: Saldo Performance & Presence Resolver (3/3 plans) — completed 2026-04-11
- [x] Phase 6: PDF Exports — Monatsbericht, Urlaubsliste (2/2 plans) — completed 2026-04-11
- [x] Phase 7: Reporting Dashboards — Überstunden, Urlaub, Anwesenheit (3/3 plans) — completed 2026-04-12

</details>

---

### 🔄 v1.2 UI/UX Redesign (Glassmorphism) — Phases 8-11

#### Phase 8: Design System Foundation
**Goal:** Neues CSS-Token-System, echte Glassmorphism-Werte, 3 Themes, modernisierte Basis-Komponenten und Sidebar.

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06

**Plans:**
- [ ] 08-01: CSS-Token-Overhaul — Glass-Tokens, body::before Backdrop, @supports Fallback, prefers-reduced-transparency (UI-01, UI-05)
- [ ] 08-02: 3 Themes — pflaume überarbeitet, "hell" neu, "dunkel" neu — nacht/wald/schiefer entfernt (UI-02)
- [ ] 08-03: Sidebar Redesign — dunkler Hintergrund, Icon+Label, active state (UI-03)
- [ ] 08-04: Base Components — Cards, Buttons (Pill), Inputs, Badges, Theme-Switcher (UI-04, UI-06)

#### Phase 9: Dashboard & Zeiterfassung Redesign
**Goal:** Die zwei meistgenutzten Seiten im neuen Design — Dashboard-Widgets als echte Glass-Cards, Zeiterfassung-Kalender modernisiert.

**Depends on:** Phase 8

**Requirements:** UI-07, UI-08, UI-09, UI-10

**Plans:**
- [ ] 09-01: Dashboard Redesign — Stats-Cards, Widgets, Charts im neuen Glass-Look (UI-07, UI-08)
- [ ] 09-02: Zeiterfassung Redesign — Kalender + Listen-Ansicht + Formulare (UI-09, UI-10)

#### Phase 10: Leave, Reports & Admin Redesign
**Goal:** Urlaubsverwaltung, Reports und Admin-Bereich erhalten das neue Designsystem.

**Depends on:** Phase 8

**Requirements:** UI-11, UI-12, UI-13, UI-14

**Plans:**
- [ ] 10-01: Urlaubsverwaltung Redesign — Kalender, Antragsübersicht, Status-Badges, Modal (UI-11, UI-12)
- [ ] 10-02: Reports Redesign — Chart-Cards, Tabellen, Export-Buttons (UI-13)
- [ ] 10-03: Admin Redesign — Mitarbeiterverwaltung, Systemeinstellungen, Monatsabschluss (UI-14)

#### Phase 11: Mobile, Polish & Remaining Pages
**Goal:** Mobile-Pass aller Seiten, Animationen, übrige Seiten erhalten Glass-Card-Rahmen.

**Depends on:** Phases 9, 10

**Requirements:** UI-15, UI-16, UI-17

**Plans:**
- [ ] 11-01: Mobile Pass — alle Seiten auf 390px, Touch-Targets 44px, kein Overflow (UI-15)
- [ ] 11-02: Animations & Transitions — Hover, Theme-Switch, Card-Enter (UI-16)
- [ ] 11-03: Remaining Pages — Schichten, Abwesenheiten, NFC-Übersicht im Glass-Card-Rahmen (UI-17)

---

## Progress

| Phase | Milestone | Plans Complete | Status   | Completed  |
|-------|-----------|----------------|----------|------------|
| 1. Test Infrastructure | v1.0 | 3/3 | Complete | 2026-03-31 |
| 2. Security Hardening  | v1.0 | 6/6 | Complete | 2026-03-31 |
| 3. UI/UX Polish        | v1.0 | 6/6 | Complete | 2026-03-31 |
| 4. DATEV Cleanup       | v1.1 | 4/4 | Complete | 2026-04-11 |
| 5. Saldo Performance   | v1.1 | 3/3 | Complete | 2026-04-11 |
| 6. PDF Exports         | v1.1 | 2/2 | Complete | 2026-04-11 |
| 7. Reporting Dashboards| v1.1 | 3/3 | Complete | 2026-04-12 |
| 8. Design System Foundation | v1.2 | 0/4 | Planned | — |
| 9. Dashboard & Zeiterfassung | v1.2 | 0/2 | Planned | — |
| 10. Leave, Reports & Admin | v1.2 | 0/3 | Planned | — |
| 11. Mobile, Polish & Remaining | v1.2 | 0/3 | Planned | — |
