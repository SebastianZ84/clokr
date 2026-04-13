---
status: partial
phase: 10-calendar-redesign-zeiterfassung-abwesenheiten
source: [10-VERIFICATION.md]
started: 2026-04-13T08:10:00Z
updated: 2026-04-13T08:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Zeiterfassung — Gap Grid Visual Islands
expected: Cells render as floating surfaces with gaps (3px) between them and rounded corners (6px). No shared border lines between cells.
result: [pending]

### 2. Zeiterfassung — Status Stripe Rendering
expected: Ok cells show green bg + green left stripe; partial show yellow bg + yellow stripe; missing show red bg + red stripe. Today cell brand ring (inset box-shadow) layers correctly on top of status bg.
result: [pending]

### 3. Zeiterfassung — Legend Floating
expected: Legend row below grid has no gray background fill and no border-top separator line. Legend dots match cell status colors and render correctly in dark theme.
result: [pending]

### 4. Abwesenheiten — Spanning Leave Bar
expected: Multi-day leave entry renders as one connected bar across cells: left-capped start, flat middle segments, right-capped end. Only the first visible segment shows the employee name; middle and end segments are color-only blocks.
result: [pending]

### 5. Abwesenheiten — Drag Selection Ring
expected: Drag-selecting multiple cells shows a rounded ring (inset box-shadow) that follows the 6px border-radius. No rectangular outline artifact.
result: [pending]

### 6. Abwesenheiten — Auto Cell Height
expected: Weeks with many leave entries grow taller to fit them. Empty weeks collapse to a small height (day number only). Grid rows self-size.
result: [pending]

### 7. Dark Theme Token Compliance
expected: All calendar colors render correctly in "nacht" theme. No hardcoded hex values leak through — status stripes, legend dots, and ArbZG warning cells all adapt to the dark theme.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
