# Clokr UI Style Guide

> Reference for building consistent UI across `apps/web`. When in doubt, check `apps/web/src/app.css` as the source of truth.

---

## Themes

Applied via `data-theme` on `<html>`. Three themes, all defined in `app.css` (Phase 8 — 4 old themes removed):

| Theme | Brand color | Use case |
|-------|-------------|----------|
| `lila` | `#80377B` (purple) | Default — AWH Corporate Design |
| `hell` | `#475569` (slate) | Light neutral theme |
| `dunkel` | `#64748B` (slate dark) | Dark theme (`color-scheme: dark`) |

**Rule**: Never hardcode hex values in component styles. Use CSS vars — they resolve correctly for all themes automatically.

**Theme switcher**: In Admin > System-Einstellungen, themes are selected via a 3-dot color picker (`class="theme-picker"`) — not a `<select>` dropdown. The dot-picker uses `role="radiogroup"` + `aria-checked` for accessibility.

**localStorage**: Key is `theme`. Old values (`pflaume`, `nacht`, `wald`, `schiefer`, `pro`) fall back gracefully to `lila`.

---

## Core Color Variables

```css
/* Backgrounds */
--color-bg             /* page background */
--color-bg-subtle      /* zebra rows, weekends, sidebars */
--color-surface        /* card/input backgrounds */
--color-surface-raised /* elevated surfaces */
--color-brand-tint     /* subtle brand highlight */
--color-brand-tint-hover

/* Text */
--color-text           /* body text */
--color-text-muted     /* labels, hints, placeholders */
--color-text-heading   /* headings, bold values */

/* Brand */
--color-brand          /* primary accent */
--color-brand-dark     /* hover state */
--color-brand-light    /* active state */

/* Borders */
--color-border         /* default border */
--color-border-subtle  /* calendar grid lines */

/* Status */
--color-green / --color-green-bg / --color-green-border
--color-yellow / --color-yellow-bg / --color-yellow-border
--color-red / --color-red-bg / --color-red-border
--color-blue / --color-blue-bg / --color-blue-border
--color-orange / --color-orange-bg / --color-orange-border

/* Domain */
--leave-type-vacation, --leave-type-sick, --leave-type-overtime ...
```

---

## Typography

```css
--font-sans  /* "DM Sans", system-ui */
--font-mono  /* ui-monospace, SFMono */
```

| Use | Size | Weight |
|-----|------|--------|
| Page title | `1.375rem` | 700 |
| H2 | `1.25rem` | 600 |
| H3 | `1rem` | 600 |
| Body | `1rem` | 400 |
| Form label | `0.9375rem` | 500 |
| Summary value | `0.9375rem` | 700, `--font-mono`, `--color-text-heading` |
| Summary label | `0.8125rem` | 500, `--color-text-muted` |
| Badge / chip | `0.8125rem` | 500 |

---

## Spacing & Radius

```css
--radius-sm   /* 8px  — inputs, buttons (base), small cards */
--radius-md   /* 14px — secondary cards (not .card which now hardcodes 18px) */
--radius-lg   /* 22px — large modals */
```

**Note:** `.card` hardcodes `border-radius: 18px` (Phase 8 D-14) — `--radius-md` is no longer used for primary cards. `--radius-md` remains for other consumers (e.g., `.dialog-content`).

Common padding patterns:
- Card body: `1.75rem`
- Summary bar: `0.875rem 1.25rem`
- Employee selector: `0.75rem 1rem`
- Table cell: `1rem 1.125rem` (compact: `0.625rem 1rem`)

---

## Glass Effect

All top-level content cards use the glass treatment (Phase 8 — 10 tokens, real blur at 0.76–0.78 alpha):

```css
background: var(--glass-bg);
border: 1px solid var(--glass-border);
box-shadow: var(--glass-shadow), var(--glass-shadow-inset);
backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
-webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
overflow: clip;
border-radius: 18px;
```

Use `.card` global class — it already applies all of the above.

### Glass Tokens (10 total)

| Token | Purpose | Example value (lila) |
|-------|---------|---------------------|
| `--glass-bg` | Card background (semi-transparent) | `rgba(255,255,255,0.76)` |
| `--glass-bg-subtle` | Layered/nested surfaces | `rgba(255,255,255,0.55)` |
| `--glass-bg-overlay` | Modals and overlays | `rgba(250,249,247,0.90)` |
| `--glass-saturate` | backdrop-filter saturate value | `160%` |
| `--glass-highlight` | Top-edge inset highlight color | `rgba(255,255,255,0.60)` |
| `--glass-border` | Card border | `rgba(128,55,123,0.10)` |
| `--glass-border-light` | Inner card separators | `rgba(255,255,255,0.50)` |
| `--glass-shadow` | Drop shadow | `0 8px 32px rgba(...)` |
| `--glass-shadow-inset` | Top-edge highlight (inset) | `inset 0 1px 0 rgba(255,255,255,0.60)` |
| `--glass-blur` | blur() value | `16px` |

**Removed token:** `--glass-bg-strong` — replaced by `--glass-bg-overlay` (semantic naming).

### Fallbacks

```css
/* Non-supporting browsers */
@supports not (backdrop-filter: blur(1px)) {
  .card, .stat-card, .table-wrapper, .dialog-content {
    background: var(--color-surface);
  }
}
/* Accessibility: reduced transparency preference */
@media (prefers-reduced-transparency: reduce) {
  .card, .stat-card, .table-wrapper, .dialog-content {
    backdrop-filter: none;
    background: var(--color-surface);
  }
}
```

### body::before Gradient Backdrop

A pseudo-element on `body` creates the visible backdrop that makes glassmorphism work. The gradient is per-theme via `--body-gradient` CSS variable. Opacity is baked into `rgba()` values (not a separate `opacity` property) to avoid stacking context issues.

---

## Animations

### Entrance animation — `card-animate`

**Every primary content block must have this class.** Applies `card-enter` (fade + translateY + scale) with staggered delays for up to 6 siblings.

```svelte
<div class="month-summary card-animate">...</div>
<div class="cal-section card card-animate">...</div>
<div class="employee-selector card-animate">...</div>
```

Stagger delays: `nth-child(1)=0ms`, `(2)=60ms`, `(3)=120ms` … `(6)=300ms`

### Page enter — `page-enter`

For the outermost page wrapper when navigating between routes.

### Other keyframes (do not duplicate)

| Name | Duration | Use |
|------|----------|-----|
| `card-enter` | 0.4s | Cards, panels, summary bars |
| `page-enter` | 0.3s | Route-level page wrapper |
| `count-up` | 0.5s | Numeric stat values |
| `skeleton-shimmer` | 1.5s ∞ | Loading skeletons |
| `dialog-in` | 0.2s | Modals |
| `backdrop-in` | 0.15s | Modal backdrop |

**Rule**: Never write a custom `@keyframes fade` or `@keyframes slideIn` — use the existing ones.

### Easing functions

```css
--ease-out    /* cubic-bezier(0.16, 1, 0.3, 1)    — default for enters */
--ease-in     /* cubic-bezier(0.55, 0, 1, 0.45)    — exits */
--ease-in-out /* cubic-bezier(0.65, 0, 0.35, 1)    — transforms */
--spring      /* cubic-bezier(0.34, 1.56, 0.64, 1) — bouncy micro-interactions */
```

### Reduced motion

All animations are automatically disabled for users who prefer reduced motion via the global `@media (prefers-reduced-motion: reduce)` rule in `app.css`. No per-component handling needed.

---

## Component Classes (Global)

### Buttons
```svelte
<button class="btn btn-primary">Speichern</button>
<button class="btn btn-secondary">Abbrechen</button>
<button class="btn btn-outline">Export</button>
<button class="btn btn-ghost">Mehr</button>
<button class="btn btn-danger">Löschen</button>
<button class="btn btn-sm btn-outline">Klein</button>
<button class="btn btn-icon" aria-label="Schließen">✕</button>
```
All buttons: `min-height: 44px` (WCAG 2.5.5).

**Phase 8 — Pill shape (D-15):** `.btn-primary` and `.btn-secondary` have `border-radius: 9999px` (pill). All other variants (`.btn-outline`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.btn-icon`) keep `border-radius: var(--radius-sm)` = 8px.

### Cards
```svelte
<div class="card card-body card-animate">...</div>          <!-- glass surface -->
<div class="card card-interactive card-animate">...</div>   <!-- hover lift -->
```

**Phase 8 — Card updates (D-14):**
- `border-radius: 18px` (was `var(--radius-md)` = 14px)
- `overflow: clip` (prevents sticky table header issues vs `overflow: hidden`)
- `backdrop-filter: blur(16px) saturate(var(--glass-saturate))` (saturate added)
- `box-shadow: var(--glass-shadow), var(--glass-shadow-inset)` (top-edge highlight added)

### Badges
```svelte
<span class="badge badge-green">Genehmigt</span>
<span class="badge badge-yellow">Ausstehend</span>
<span class="badge badge-red">Abgelehnt</span>
<span class="badge badge-blue">Info</span>
<span class="badge badge-gray">Inaktiv</span>
<span class="badge badge-orange">Stornierung</span>
```

**Phase 8 — Badge updates (D-17):**
- `padding: 4px 8px` (was `0.3rem 0.75rem` — tighter horizontal)
- `font-weight: 400` (was 500 — matches 2-weight typography contract)
- `letter-spacing: 0.02em` (was 0.01em)

### Forms
```svelte
<div class="form-group">
  <label class="form-label" for="x">Label</label>
  <input id="x" class="form-input" type="text" />
  <p class="form-hint">Hinweistext</p>
  <p class="form-error">Fehlertext</p>
</div>
```

### View Tabs
```svelte
<div class="view-tabs">
  <button class="view-tab" class:view-tab--active={view === "a"} onclick={() => view = "a"}>Tab A</button>
  <button class="view-tab" class:view-tab--active={view === "b"} onclick={() => view = "b"}>Tab B</button>
</div>
```

### Employee Selector (above view-tabs)
```svelte
<div class="employee-selector card-animate">
  <label class="form-label" for="emp-select">Mitarbeiter</label>
  <select id="emp-select" class="form-input" ...>
    <option value="">Alle Mitarbeiter</option>
    <option value="mine">Meine Einträge</option>
    <!-- manager only: individual employees -->
  </select>
</div>
```

### Summary Bar
```svelte
<div class="month-summary card-animate">  <!-- or vac-summary -->
  <div class="msummary-item">
    <span class="msummary-label">Soll</span>
    <span class="msummary-value">40h</span>
  </div>
  <div class="msummary-divider"></div>
  ...
</div>
```
Value: `font-size: 0.9375rem`, `font-weight: 700`, `font-family: var(--font-mono)`, `color: var(--color-text-heading)`
Label: `font-size: 0.8125rem`, `font-weight: 500`, `color: var(--color-text-muted)`

### Alerts
```svelte
<div class="alert alert-info" role="alert"><span>ℹ</span><span>Text</span></div>
<div class="alert alert-warning" role="alert"><span>⚠</span><span>Text</span></div>
<div class="alert alert-error" role="alert"><span>⚠</span><span>Text</span></div>
<div class="alert alert-success" role="alert"><span>✓</span><span>Text</span></div>
```

### Skeletons
```svelte
<div class="skeleton skeleton-heading"></div>
<div class="skeleton skeleton-text"></div>
<div class="skeleton skeleton-stat"></div>
<div class="skeleton skeleton-card"></div>
```

---

## Page Layout Pattern

```svelte
<div class="page-header">
  <h1>Seitentitel</h1>
  <button class="btn btn-primary">Neu</button>
</div>

<!-- optional: employee filter (manager only, above tabs) -->
<div class="employee-selector card-animate">...</div>

<!-- view tabs -->
<div class="view-tabs">...</div>

<!-- summary bar (where applicable) -->
<div class="month-summary card-animate">...</div>

<!-- main content -->
<div class="cal-section card card-animate">...</div>
<!-- or -->
<div class="table-wrapper card-animate">...</div>
```

---

## Calendar Cells

```css
/* Normal weekday */
background: var(--color-surface)

/* Weekend */
background: var(--color-bg-subtle)

/* Holiday */
background: var(--color-brand-tint) !important;
border-left: 3px solid var(--color-brand);

/* Other month */
opacity: 0.3;
background: var(--color-bg-subtle) !important;

/* Today */
box-shadow: inset 0 0 0 2px var(--color-brand);
```

Never use hardcoded hex colors for calendar cell backgrounds.

---

## Pagination

Component: `$components/ui/Pagination.svelte`

### Props Interface

```ts
interface Props {
  total: number;                   // total item count (before paging)
  page?: number;                   // current 1-based page, bindable (default 1)
  pageSize?: number;               // current rows-per-page, bindable (default 10)
  pageSizeOptions?: number[];      // default [10, 25, 50]
  labelSingular?: string;          // default "Eintrag" (German)
  labelPlural?: string;            // default "Einträge" (German)
  showWhenSinglePage?: boolean;    // default false (auto-hide when total <= min(pageSizeOptions))
  onChange?: (p: { page: number; pageSize: number }) => void; // optional callback for server-side
}
```

### Client-Side Usage (most list views)

```svelte
<script lang="ts">
  import Pagination from "$components/ui/Pagination.svelte";

  let page = $state(1);
  let pageSize = $state(10);

  // Must come AFTER the filteredX $derived declaration
  let pagedItems = $derived(filteredItems.slice((page - 1) * pageSize, page * pageSize));

  // Reset to page 1 whenever the filtered set changes (e.g. search/filter change)
  $effect(() => {
    const _len = filteredItems.length; // track
    page = 1;
  });
</script>

<table>
  <tbody>
    {#each pagedItems as item (item.id)}
      <tr>...</tr>
    {/each}
  </tbody>
</table>

<Pagination total={filteredItems.length} bind:page bind:pageSize />
```

### Server-Side Usage (audit log and similar)

```svelte
<Pagination
  total={total}
  bind:page
  bind:pageSize
  onChange={() => loadLogs()}
/>
```

When `pageSize` changes, the component resets `page = 1` internally and then calls `onChange`. The `onChange` callback is responsible for re-fetching data with the new `page` and `pageSize` values.

### Rules

- Every list view with potentially >10 rows MUST use `Pagination`. Default `pageSize` is 10. Page state is component-local `$state` — do NOT persist to localStorage.
- The component auto-hides when `total <= 10` (smallest `pageSizeOptions`). Pass `showWhenSinglePage={true}` only for dashboards where an explicit "no more results" indicator is desired.
- Always reset `page = 1` when filters/search change, using `$effect`.
- Place `<Pagination>` immediately after the closing `</table>` (or equivalent list wrapper), inside the same `.card` / `.table-wrapper` so it visually belongs to the table.
- Import path: `import Pagination from "$components/ui/Pagination.svelte";`

---

## CSS Architecture: Global vs Scoped

### Decision rule

| What | Where | Why |
|------|-------|-----|
| Design tokens (`--color-*`, `--font-*`, etc.) | `app.css` | Single source of truth, resolved at runtime |
| Shared class bases used by **≥ 2 components** (e.g. `.cal-cell`, `.cal-today`) | `app.css` | One place to change, no cascade fights |
| Component-specific layout, spacing, variants | Component `<style>` block | Scoped by Svelte hash, isolated |
| Hover/focus/active states that are purely local | Component `<style>` block | No risk of leaking |
| Library/third-party overrides | Component `<style>` with `.wrapper :global { }` | Minimally invasive |

### Svelte scoping gotchas

Svelte injects a `.svelte-HASH` selector on every scoped rule, giving it **+1 class specificity** over a matching global rule — even when both have `!important`. Component styles always win if specificity is equal.

**Consequence:** if an `app.css` rule and a component `:global()` rule target the same selector, the component rule wins regardless of source order. Fix: move the rule to `app.css` entirely.

**Compound `:global()` selectors are broken.** Svelte cannot correctly hash compound selectors that mix scoped and global parts:

```svelte
/* BAD — Svelte filters this out, rule never applies */
:global(.cal-cell.cal-selected:not(.cal-other)) { ... }

/* GOOD — put it in app.css directly, no wrapper needed */
```

Only use `:global()` in a component when overriding a child component's internals from a parent, and always wrap it tightly:

```svelte
<style>
  .wrapper :global(.third-party-class) { ... }  /* ✓ scoped to .wrapper */
</style>
```

### Naming conventions

| Class type | Convention | Example |
|------------|------------|---------|
| Shared global (multi-component) | `domain-concept` | `.cal-cell`, `.cal-today`, `.month-summary` |
| Component-private | short, descriptive | `.cell`, `.nav`, `.chip` |
| State modifiers | `cal-` prefix for shared states | `.cal-selected`, `.cal-other`, `.cal-weekend` |
| BEM variants | only inside a component | `.card__header`, `.card--highlighted` |

### Avoiding `!important` wars

- **Do not use `!important` in `app.css`** for anything except explicit state overrides (weekend bg, today ring, etc.) — document each one with a comment explaining why.
- Component scoped rules never need `!important` to beat global defaults (they win via specificity).
- If two rules both need `!important`, the one with **higher specificity** wins; same specificity = the one injected later (component > app.css). Resolve by moving the authoritative rule to `app.css` and deleting the duplicate.

---

## Accessibility Checklist

- [ ] All interactive elements: `min-height: 44px` (WCAG 2.5.5)
- [ ] Focus styles: do not remove `:focus-visible` outlines
- [ ] Semantic HTML: `role`, `aria-label` on icon-only buttons
- [ ] `.sr-only` for screen-reader-only text
- [ ] Color is never the ONLY indicator of state — always pair with text/icon
- [ ] Animations: handled automatically via `prefers-reduced-motion` in `app.css`
- [ ] Glass blur: disabled for `prefers-reduced-transparency: reduce` (Phase 8 — fallback to solid surface)
- [ ] Glass blur: `@supports not (backdrop-filter: blur(1px))` fallback to solid `var(--color-surface)`
- [ ] Theme dot-picker: `role="radiogroup"`, `aria-checked` on each button, `aria-label` with German theme name

## Sidebar (Dark)

All 3 themes use a dark sidebar — no glass on the sidebar (Phase 8 D-06). The sidebar is an opaque dark navigation chrome, not a glassmorphism element.

```css
.sidebar {
  background-color: var(--sidebar-bg);   /* dark: #1E1B2E / #1E293B / #0F172A per theme */
  border-right: 1px solid var(--sidebar-border);
  backdrop-filter: none;                 /* explicitly no blur */
}
```

**Dark sidebar tokens** (per-theme):

| Token | lila | hell | dunkel |
|-------|------|------|--------|
| `--sidebar-bg` | `#1E1B2E` | `#1E293B` | `#0F172A` |
| `--sidebar-border` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.05)` |
| `--nav-active-bg` | `rgba(128,55,123,0.18)` | `rgba(71,85,105,0.20)` | `rgba(100,116,139,0.18)` |
| `--nav-active-color` | `#D8B4D8` | `#CBD5E1` | `#CBD5E1` |
| `--nav-active-border` | `#A85CA3` | `#94A3B8` | `#64748B` |

**Text on dark sidebar**: Use `rgba(255,255,255,N)` values (not `var(--color-text-*)`) to ensure readability regardless of light/dark theme:
- Primary text: `rgba(255,255,255,0.90)`
- Body text: `rgba(255,255,255,0.75)`
- Secondary: `rgba(255,255,255,0.60)`
- Muted: `rgba(255,255,255,0.50)`
- Dim: `rgba(255,255,255,0.35)`

**Nav item icon opacity states** (Phase 8 D-07):
- Rest: `opacity: 0.6`
- Active: `opacity: 1.0` (via `.nav-item--active .nav-icon`)
- Hover: `opacity: 0.85`
- Transition: `opacity 150ms ease-out`
