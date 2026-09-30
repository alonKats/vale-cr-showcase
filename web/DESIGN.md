---
name: Transparencia Pura
colors:
  surface: '#f6fafe'
  surface-dim: '#d6dade'
  surface-bright: '#f6fafe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4f8'
  surface-container: '#eaeef2'
  surface-container-high: '#e4e9ed'
  surface-container-highest: '#dfe3e7'
  on-surface: '#171c1f'
  on-surface-variant: '#3f484a'
  inverse-surface: '#2c3134'
  inverse-on-surface: '#edf1f5'
  outline: '#6f797a'
  outline-variant: '#bfc8ca'
  surface-tint: '#216770'
  primary: '#003d44'
  on-primary: '#ffffff'
  primary-container: '#02565f'
  on-primary-container: '#89c9d3'
  inverse-primary: '#90d1db'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#003b57'
  on-tertiary: '#ffffff'
  tertiary-container: '#005378'
  on-tertiary-container: '#75c8ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#acedf8'
  primary-fixed-dim: '#90d1db'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f57'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f6fafe'
  on-background: '#171c1f'
  surface-variant: '#dfe3e7'
  surface-white: '#FFFFFF'
  text-primary: '#0F172A'
  text-secondary: '#475569'
  price-green: '#10B981'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  data-display:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  section-gap: 64px
---

## Brand & Style
The brand personality is professional, objective, and inherently trustworthy. It functions as a sophisticated financial utility for the Costa Rican consumer, transforming complex pricing data into actionable intelligence. The UI avoids gimmicks in favor of high-clarity data visualization and editorial-grade refinement.

This design system adopts a **Corporate / Modern** style with a focus on **Minimalism**. It utilizes a deep teal palette for authority, paired with expansive whitespace to prevent cognitive overload. The interface should feel like a high-end fintech dashboard: clean, precise, and structurally rigorous, ensuring that price metrics and product comparisons are the primary focus.

## Colors
The color strategy is anchored by a deep **Primary Teal** (`#02565F`), which communicates stability and institutional trust. **Secondary Amber** (`#F59E0B`) is reserved exclusively for high-priority alerts and "best deal" indicators, providing a sharp contrast that draws the eye without creating visual noise.

The background uses a soft **Neutral Slate** (`#F1F5F9`) to define card boundaries and section containers, while pure **Surface White** is used for the primary content areas. Text follows a strict hierarchy of deep slates rather than pure black to maintain a modern, sophisticated feel.

## Typography
The typography system uses a dual-font approach to balance approachability with technical precision. **Plus Jakarta Sans** is the primary typeface, chosen for its friendly yet professional geometric forms, making it ideal for headers and general body copy.

**Space Grotesk** is introduced specifically for numeric data, currency displays, and technical labels. Its monospace-inspired proportions ensure that prices and "brecha" percentages are highly legible and align perfectly in comparison tables. Use `headline-lg-mobile` for all top-level titles on screens smaller than 768px.

## Layout & Spacing
The design utilizes a **Fixed Grid** system for desktop, centered within a 1280px container to ensure readability of data tables and product grids. A 12-column layout provides the flexibility needed for diverse content types—from 4-column product grids to 3-column feature breakdowns.

On mobile, the layout shifts to a single-column fluid model with 16px side margins. Spacing follows a strict 8px baseline rhythm. Generous vertical gaps (`section-gap`) are used between different product categories to clearly demarcate the start of new data sets, reducing visual clutter.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and subtle **Ambient Shadows**. Instead of heavy shadows, the system uses "low-altitude" depth markers to maintain a clean aesthetic.

- **Level 0 (Background):** Neutral slate background.
- **Level 1 (Cards):** Pure white surfaces with a 1px border of the same background color or a very soft, diffused shadow (0px 4px 12px rgba(2, 86, 95, 0.05)).
- **Level 2 (Interactive):** Elements like search bars or active dropdowns use a slightly more pronounced shadow to indicate focus.
- **Overlays:** Modals and tooltips utilize a light backdrop blur (8px) and a semi-transparent dark overlay to maintain focus on the task at hand.

## Shapes
The shape language is **Rounded**, reflecting a modern and accessible feel without becoming overly "bubbly." A standard 0.5rem (8px) radius is applied to cards, input fields, and buttons. 

Larger containers like the main search bar or promotional banners may use `rounded-xl` (1.5rem) to create a softer, more inviting entry point. Tags and "badge" indicators for price drops should use a full pill-shape to distinguish them from functional UI components like buttons.

## Components

### Buttons
Primary buttons use the Teal background with White text. Secondary buttons use a Teal outline with no fill. "Best Price" or "Call to Action" buttons can occasionally use the Secondary Amber to drive conversions. All buttons feature a subtle scale-down effect (98%) on click.

### Cards
Product cards are the core of this system. They must have a consistent height, white background, and clear 1px borders. The product image sits at the top, followed by the title in `body-md`, and the price highlighted in `data-display` using the primary Teal.

### Inputs & Search
The main search bar is an oversized component at the top of the viewport. It features a large search icon, `body-lg` text, and a `rounded-xl` shape to signal it as the primary tool for interaction.

### Chips & Badges
"Brecha" (price gap) indicators are styled as high-contrast chips. Use the Primary Teal for standard info and Secondary Amber for significant price differences.

### Tables & Lists
Data-heavy lists should use alternating row highlights (Zebra striping) using the Neutral Slate at 50% opacity to aid horizontal eye tracking across price columns.

---

## Build notes — what shipped, and the six values that had to move

Implemented 2026-08-31 from this guide plus five Figma nodes in
`sZBPkeh3unsaLeSqsCDmzN`: `6:4` home · `17:4` product · `18:4` category ·
`21:326` filter panels · `16:940` the hero photograph.

The tokens live in `app/tokens.css` and are the single source; every CSS Module
consumes only `var(--…)` — no raw hex, no raw `rgba()` — which is what makes
`scripts/contrast.mjs` (wired as `prebuild`) enforceable rather than a habit.

**Six colours in the mockups could not ship as drawn.** Each fails WCAG AA
against the ground it actually sits on. Five are fixed by darkening along the
same hue; the sixth is a token mix-up this guide already solves.

| drawn | measured | shipped as | why |
|---|---|---|---|
| `#6B7C7E` muted text | 4.37 white / **4.04** tint | `--ink-3` `#647375` | the most-used text colour in the design |
| `#FEA619` amber text | **1.87** on hero | `--loud-ink` `#855300` | see below |
| `#10B981` green text | **2.54** white | `--go` `#0B7E58` | `price-green` is a chart/fill colour |
| `#00875A` on `#E3FCEF` | **4.21** | `--go-2` `#008056` | the home card's badge |
| `#718096` panel grey | 4.02 / **3.75** | `--panel-ink-3` `#657286` | the filter panels' muted step |
| `#02565F` on `#FEA619` | **4.27** | `--act-strong` `#003D44` | the CTA label; 16px bold is under the 18.66px large-text threshold |

**The amber was never a design error — it was a token mix-up, and this guide
already fixes it.** The palette above ships two ambers and names them in
Material 3 terms: `secondary: #855300` is amber as **text**;
`secondary-container: #FEA619` is amber as **fill**. The mockups used the fill
colour for text in five places (the hero headline, the product eyebrow, "Limpiar
filtros", the footer headings, the wordmark's `.cr`). Following the guide as
written fixes all five and needs no exception.

So amber is two tokens and they are **not interchangeable**:

- `--loud` `#FEA619` — a FILL. Never text on a light ground. It is the CTA
  background, the nav underline, the swoosh, the max-price bar segment — and it
  *is* legal as text on the dark footer, where it measures 6.36.
- `--loud-ink` `#855300` — amber as text on any light ground. 6.49 on white.

Six pairs are asserted **inverted** in `design/pairs-v8.json` — they must measure
*below* threshold — so each mix-up above fails the build if it ever returns.

**Two gates run as `prebuild`:** `contrast.mjs` (46 pairs) and `tokens.mjs`,
which refuses any `var(--x)` that no longer resolves. The second exists because
the token rewrite silently deleted colours that eleven un-redesigned templates
still read: an unresolvable `var()` is invalid at computed-value time, so the
declaration is dropped and the property inherits — with `tsc`, the build and the
contrast gate all green.

**Three things the mockups draw that are deliberately not built**, because there
is nothing behind them: `Favoritos` and `Ingresar` in the header (no auth, no
favourites store), the heart on the results card, and the footer's three social
icons (no accounts). The slots are laid out, so each is a small change the day
the feature exists.
