# Design system

The target is an editorial, calm, professional operations tool. Hierarchy comes from typography,
spacing and alignment — not from boxes, colour or shadow.

Tokens live in `src/app/globals.css` under Tailwind v4's `@theme`. There is **no
`tailwind.config.ts`**: v4 is configured in CSS.

---

## 1. Forbidden patterns

These are specification Section 93, restated as rules with the reason. If you are about to add one,
the answer is no.

| Never | Why | Instead |
| --- | --- | --- |
| Rounded cards floating on a grey page | The "AI SaaS dashboard" tell. Fragments the page and wastes space | One flat canvas; sections separated by a hairline and whitespace |
| A card around every statistic, form and table | Containment with nothing to contain | `Section` with a heading |
| Colourful status pills | Thirty filled badges in a table is unreadable | 4px dot + label (`StatusDot`) |
| Neon gradients, glowing shadows, glassmorphism | Decoration that carries no information | Nothing. Use spacing |
| Gradient or coloured icon tiles | Turns navigation into a toy | 16px monochrome icon |
| Dashed, dotted or heavy dividers | Visual noise | `border-b border-line-soft`, 1px |
| Giant rounded pill buttons | Overstates ordinary actions | 3px radius, 28–36px tall |
| Excessive rounding (`rounded-xl`+) | Reads as consumer, not operational | 3px, or a full circle for a dot/avatar |
| Full-screen spinners | Blanks a page that was already useful | Localised skeletons |
| Toasts for information the user must keep | Toasts vanish | Persistent in-app notifications (Phase 8) |

`docs/REQUIREMENTS.md` tracks §92–103 as verified against this list.

---

## 2. Canvas

One surface. Sections flow directly on it.

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#FFFFFF` | The page |
| `--color-canvas-subtle` | `#FAFAFA` | Sidebar, hover fills, inline code |

No page-level grey background with floating white cards.

## 3. Typography

System font stack (`--font-sans`). This is a deliberate trade-off: a webfont would add a build-time
network dependency and a flash of unstyled text, for a marginal gain in an internal tool. Swapping
in `next/font` later is a one-line change.

| Role | Class | Token |
| --- | --- | --- |
| Page title | `text-xl font-medium tracking-[-0.01em]` | `--color-ink-strong` (zinc-950) |
| Section label | `.section-title` — 11px, uppercase, `0.08em` tracking | `--color-ink-faint` |
| Body / table cell | 13px | `--color-ink` (zinc-900) |
| Secondary | 13px | `--color-ink-muted` (zinc-500) |
| Hint / meta | 12px | `--color-ink-faint` (zinc-400) |
| Identifiers, keys, URLs | `font-mono text-xs` | — |

Four text steps. If a fifth seems necessary, the layout is the problem.

## 4. Spacing

| Token | Value | Use |
| --- | --- | --- |
| `--spacing-gutter` | `2.5rem` | Page gutter at `lg` and above |
| `--spacing-sidebar` | `15rem` | Sidebar width |

Sections are separated by `mb-10`, header from content by `mb-8`, label from control by `space-y-1.5`.
Generous, but not wasteful — this is a dense operational tool.

## 5. Colour

Zinc for everything structural. Colour appears only where it carries meaning.

| Token | Meaning |
| --- | --- |
| `--color-line` (zinc-200) | Structural hairline: table headers, section rules |
| `--color-line-soft` (zinc-100) | Row separators |
| `--color-status-*` | Status dots only |
| red-600 | Destructive actions and errors, nothing else |
| amber-500/600 | Warnings and configuration notices |

## 6. Status

`<StatusDot tone="progress" label="In Progress" />` → a 4px dot plus text.

| Tone | Colour | Typical use |
| --- | --- | --- |
| `neutral` | zinc-400 | Pending, inactive, unused |
| `active` | blue-600 | Processing, direct allow |
| `progress` | indigo-600 | In progress |
| `review` | amber-600 | Internal review |
| `ready` | teal-600 | Ready for delivery |
| `done` | emerald-600 | Completed, allowed, active |
| `warning` | amber-600 | Due soon, missing configuration |
| `danger` | red-600 | Overdue, cancelled, direct deny |

The label is always present, so the dot is reinforcement rather than the only signal — which is also
what makes this work for colour-blind users and screen readers. The dot itself is `aria-hidden`.

## 7. Tables

`TableWrap` → `Table` → `THead`/`TBody` → `TR`/`TH`/`TD`.

- Borderless. One `border-b border-line` under the header, `border-line-soft` between rows.
- No outer border, no cell grid, no zebra striping.
- First and last cells lose their side padding, so columns align to the page edge.
- `.tabular` (`font-variant-numeric: tabular-nums`) so numbers line up.
- Every table has a `<caption class="sr-only">`.
- `TableWrap` scrolls horizontally on its own, so **the page body never scrolls sideways**.

## 8. Forms

- Inputs: 32px tall, 1px `--color-line`, 3px radius. No card wrapper, no floating label.
- Focus: border darkens to zinc-900. The global `:focus-visible` ring is a 2px zinc-900 outline with
  2px offset — visible, never glowing, and only for keyboard users.
- Errors: 12px red-600 text with `role="alert"`, and `aria-invalid` on the control.
- Use `Field` so label, control, hint and error keep the same rhythm.

## 9. Buttons

| Variant | Use |
| --- | --- |
| `primary` | The single strongest action on a screen (zinc-900 fill) |
| `secondary` | Ordinary actions (hairline border) |
| `ghost` | Tertiary, inside dense rows |
| `danger` / `dangerGhost` | Destructive only |

Sizes `sm`/`md`/`lg` = 28/32/36px. Radius 3px. No shadow, no gradient.

**Never wrap a `<Link>` in a `<Button>`** — that nests an anchor inside a button. Use
`className={buttonVariants({ variant: "secondary" })}` on the `Link`.

## 10. Navigation

Sidebar is structural and quiet: text, spacing, 16px monochrome icons, two levels of nesting.

- Active row: `bg-zinc-200/60` + `font-medium` + `aria-current="page"`. No neon bar, no pill.
- Sections collapse; open state persists in `localStorage` via `usePersistedFlag`.
- The section containing the current page is **always** open — a sidebar that hides where you are is
  disorienting.
- Below `lg` it becomes an overlay drawer with Escape-to-close, not a squeezed column.

Breadcrumbs (`Breadcrumbs`) are 12px and muted, on detail pages only.

## 11. Empty, loading, error

- **Empty** (`EmptyState`): what is missing, and what to do. No illustration.
- **Loading**: localised skeletons. Never a full-screen spinner.
- **Error** (`app/error.tsx`): plain sentence plus the digest, which is a safe correlation id.
  **Never** the stack trace or the raw message — those leak connection strings and table names.

## 12. Feedback

Sonner, bottom-right, restyled to the hairline look. **Transient only** — "Saved", "Role assigned".
Anything the user must be able to return to is a persistent notification (Phase 8).

## 13. Destructive actions

Native `<dialog>` + `showModal()`. The platform provides the modal, focus trap and Escape-to-close,
so no dependency is needed. Copy states the consequence and what is preserved. Confirm button uses
`danger`.

Typed confirmation is reserved for genuinely irreversible actions; deactivation is reversible and
does not need it.

The same `<dialog>` pattern (`src/components/ui/modal.tsx`) is the shared component for every popup
in the app, destructive or not (create/edit dialogs, pickers, ...). Its default className carries
`m-auto` — **required**, not decorative: a browser centers a modal `<dialog>` via `margin: auto` in
its own UA stylesheet, but Tailwind's Preflight resets `margin` to `0` on every element, which
silently pins the dialog to the top-left corner instead. Found and fixed 2026-09-27 (every existing
dialog in the app was affected). Any custom `className` passed to `<Modal>` must keep `m-auto`.

## 14. Responsive

Desktop first, then adapt — never shrink.

| Breakpoint | Behaviour |
| --- | --- |
| `lg` and up | Fixed sidebar, `2.5rem` gutter |
| below `lg` | Sidebar becomes a drawer; a trigger appears top-left; gutter drops to `1.5rem` |
| Tables | Scroll inside `TableWrap` |
| `MetaList` | 4 → 2 → 1 columns |

## 15. Accessibility

Non-negotiable, and cheaper to keep than to retrofit.

- Semantic HTML: real `<nav>`, `<table>`, `<fieldset>`, `<dialog>`, `<button>`.
- One visible focus style everywhere, `:focus-visible` only.
- Every control labelled; icon-only buttons carry `aria-label`; decorative icons are `aria-hidden`.
- `aria-expanded` + `aria-controls` on disclosures; `aria-current="page"` on the active link;
  `aria-pressed` on toggle buttons.
- Escape closes the drawer, the user menu and dialogs.
- Live regions (`aria-live="polite"`) for search status.
- `prefers-reduced-motion` disables transitions globally.
- Colour is never the only signal.

Verified so far by the sidebar component tests. A full audit is Phase 10.
