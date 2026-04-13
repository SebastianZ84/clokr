---
phase: 10-calendar-redesign-zeiterfassung-abwesenheiten
plan: "01"
subsystem: ui
tags: [svelte, calendar, css, dark-theme, tokens]

# Dependency graph
requires: []
provides:
  - Gap-based island calendar grid with border-radius on all cells
  - Colored left-border status stripes on ok/partial/missing cells
  - Cleaned-up legend row (no gray background, no border-top separator)
  - Token-based legend dot colors (no hardcoded hex)
  - Raised out-of-month opacity (0.35 vs 0.30)
affects:
  - 10-02-PLAN.md (Abwesenheiten calendar — shares app.css, same design language)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap-based calendar grid: gap:3px + padding:3px on .cal-grid, border-radius:6px on .cal-cell"
    - "Status stripe via border-left: 3px solid var(--color-*) alongside colored background"
    - "color-mix(in srgb, var(--token) N%, transparent) for tinted borders in dark-theme-safe way"

key-files:
  created: []
  modified:
    - apps/web/src/routes/(app)/time-entries/+page.svelte
    - apps/web/src/app.css

key-decisions:
  - "padding: 3px on .cal-grid prevents corner cells from having their border-radius clipped by .cal-section overflow:hidden"
  - "border-left status stripe coexists with absence background colors — absence cells rarely receive status classes in practice (confirmed in research)"
  - "opacity 0.35 bump applied globally in app.css (not scoped) so both time-entries and leave calendar benefit from one change"

patterns-established:
  - "Calendar island grid: gap + padding on grid container, border-radius on cells — no shared borders"
  - "ArbZG warning: color-mix(in srgb, var(--color-yellow) 8%, transparent) for tinted backgrounds"

requirements-completed:
  - UI-09
  - UI-11

# Metrics
duration: 12min
completed: 2026-04-13
---

# Phase 10 Plan 01: Zeiterfassung Calendar Redesign Summary

**Gap-based island grid with 3px gaps, rounded cells, colored status stripes, and token-only legend colors in the Zeiterfassung calendar**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-13T00:00:00Z
- **Completed:** 2026-04-13
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Replaced border-based grid with gap-based island layout (`gap: 3px`, `padding: 3px`, `border-radius: 6px` on cells)
- Added colored left-border stripe to all five status cell classes (ok, partial, missing, today-ok, today-partial)
- Removed gray background and border-top separator from legend row — legend floats cleanly below grid
- Replaced all hardcoded hex values in status cell and legend dot styles with CSS custom property tokens
- Raised out-of-month cell opacity from 0.30 to 0.35 in `app.css` (shared global rule for both calendar pages)

## Task Commits

Each task was committed atomically:

1. **Task 1: Gap grid + border-radius (D-01, D-02)** - `2df70a5` (feat)
2. **Task 2: Status stripe + legend redesign (D-05, D-10, D-11, D-15)** - `1ee6487` (feat)
3. **Task 3: Out-of-month opacity bump (D-12)** - `8e4a245` (feat)

## Files Created/Modified

- `apps/web/src/routes/(app)/time-entries/+page.svelte` - Updated scoped `<style>` block: gap grid, border-radius, status stripes, legend redesign, token cleanup
- `apps/web/src/app.css` - `.cal-cell.cal-other:not(.cal-selected)` opacity 0.3 → 0.35

## Decisions Made

- `padding: 3px` on `.cal-grid` is necessary because `.cal-section` has `overflow: hidden` — without padding, corner cells have their `border-radius` visually clipped
- ArbZG warning cells now use `color-mix(in srgb, var(--color-yellow) 8%, transparent)` replacing `rgba(245, 158, 11, 0.08)` — same visual result, fully dark-theme-aware
- Legend gap reduced from 1.25rem to 1rem for tighter pill-row feel matching Clockodeo visual language

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The plan's automated verification scripts checked for patterns too broadly (e.g., checking if `border-top` and `gray-50` exist anywhere in the file, rather than specifically in `.cal-legend`). Manual verification confirmed the `.cal-legend` rule was correctly updated. All 20 targeted checks in a more precise verification script passed.

## Known Stubs

None — this plan is CSS-only, no data flow or stub values.

## Threat Flags

None — all changes are scoped CSS only. No new network endpoints, auth paths, or data flows introduced.

## Next Phase Readiness

- Zeiterfassung calendar now matches island grid design language
- Plan 10-02 (Abwesenheiten calendar redesign) can proceed — it shares `app.css` and the same design patterns are established here

---
*Phase: 10-calendar-redesign-zeiterfassung-abwesenheiten*
*Completed: 2026-04-13*
