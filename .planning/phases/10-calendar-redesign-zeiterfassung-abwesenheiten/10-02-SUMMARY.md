---
phase: 10-calendar-redesign-zeiterfassung-abwesenheiten
plan: 02
subsystem: ui
tags: [svelte5, css, calendar, leave, abwesenheiten]

# Dependency graph
requires:
  - phase: 10-calendar-redesign-zeiterfassung-abwesenheiten
    provides: "Plan 10-01 shared app.css tokens (cal-other opacity, cal-weekend background)"
provides:
  - "Gap-based leave calendar grid with visual island cells (gap: 3px, border-radius: 6px)"
  - "Continuous spanning bars for multi-day leave with start/middle/end segments"
  - "Inset box-shadow drag-selection ring replacing rectangular outline"
  - "Chip and legend polish (opacity 0.9, border-radius 6px, no border-top separator)"
affects: [10-03, leave-page, calendar-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap-based grid layout for calendar cells — gap replaces shared border lines"
    - "Inset box-shadow for rounded cell focus/selection ring (matches .cal-today pattern)"
    - "Bar variant CSS classes (bar-start/end/middle) for continuous spanning chip visualization"
    - "{@const} inside {#each} for positional chip logic (_isBarStart, _isBarEnd, _showLabel)"

key-files:
  created: []
  modified:
    - apps/web/src/routes/(app)/leave/+page.svelte

key-decisions:
  - "Use gap: 3px on .cal-grid instead of individual cell borders — cleaner, fewer rules"
  - "Replace outline with inset box-shadow on .cal-cell--drag-selected — follows border-radius"
  - "Keep .cal-chip--pending dashed outline (chip-level, intentional design feature D-09)"
  - "Bar start: startDate OR Monday (_dow===1); bar end: endDate OR Sunday (_dow===0) — handles week-row wrapping"
  - "Only first visible segment (_showLabel) shows name text — middle/end are color-only bars"
  - "Keep .cal-chip-type opacity: 0.85 unchanged — different from chip-pending opacity, not in scope"

patterns-established:
  - "Bar segmentation pattern: {#each} with {@const} positional vars + class:bar-start/end/middle"
  - ".cal-chips negative margin: 0 -0.4rem to bleed chips to cell padding edges for full-width bars"

requirements-completed: [UI-11, UI-12]

# Metrics
duration: 2min
completed: 2026-04-13
---

# Phase 10 Plan 02: Abwesenheiten Calendar Redesign Summary

**Gap-based leave calendar with 6px rounded cells, continuous spanning bars for multi-day leave, inset drag ring, and chip/legend polish**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T08:17:47Z
- **Completed:** 2026-04-13T08:19:44Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Replaced border-based calendar grid with gap-based layout (3px gap, 6px border-radius cells) — visual islands instead of shared borders
- Implemented continuous spanning bar visualization for multi-day leave: left-capped / flat / right-capped segments separated by 3px gap, with natural week-row wrapping
- Fixed `.cal-cell--drag-selected` visual bug — `outline` replaced with `inset box-shadow` so ring follows border-radius (matches `.cal-today` pattern in app.css)
- Polished chip and legend: border-radius 6px, pending opacity 0.9, legend border-top removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Gap grid + border-radius (D-01, D-02)** - `d4b1a49` (feat)
2. **Task 2: Chip upgrades + legend cleanup (D-07, D-09, D-10, D-11)** - `5e816d5` (feat)
3. **Task 3: Spanning bars — continuous multi-day leave visualization** - `cee4f41` (feat)

## Files Created/Modified
- `apps/web/src/routes/(app)/leave/+page.svelte` - Gap-based grid, spanning bar classes and CSS, chip/legend polish

## Decisions Made
- Kept `.cal-chip-type` at `opacity: 0.85` — this is the type label dimming (separate from chip-pending), not referenced by any plan task
- Bar end detection uses Sunday (`_dow === 0`) rather than Saturday because JS `getDay()` returns 0 for Sunday; calendar weeks run Mon–Sun

## Deviations from Plan

None - plan executed exactly as written.

Note: Task 1 verification check for "outline-offset removed" flagged a false alarm — the remaining `outline-offset: -2px` is in `.cal-chip--pending` (intentional, kept per Task 2 instructions), not in `.cal-cell--drag-selected`. The drag-selected rule no longer has `outline` or `outline-offset`.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Leave calendar CSS redesign complete — gap grid + spanning bars + rounded cells all in place
- Ready for Plan 10-03 if it builds on this visual foundation
- Visual verification at `/leave` recommended: multi-day leave spanning >1 day will show the connected bar effect; drag selection will show rounded ring

---
*Phase: 10-calendar-redesign-zeiterfassung-abwesenheiten*
*Completed: 2026-04-13*
