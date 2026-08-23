---
type: Design
title: Ollert Visual Design
description: Color palette, typography, and layout pattern the FE starts from, extracted from windmill-dashboard-react.
tags: [design, tailwind, tokens]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T19:50:29Z" }
---

# Summary

Starting visual language extracted from [windmill-dashboard-react](https://github.com/estevanmaito/windmill-dashboard-react) (MIT) and its component library [windmill-react-ui](https://github.com/estevanmaito/windmill-react-ui) (MIT). We're taking the **color palette, type choice, and layout pattern** — not the `@windmill/react-ui` component library itself, which is Tailwind v1-era, unmaintained, and a full styled-component kit that would fight [Base UI](https://base-ui.com) (our chosen headless primitives — see [Architecture](architecture.md)). Components get built fresh on Base UI + Tailwind, styled to match these tokens.

# Layout pattern

Classic admin-dashboard shell, which fits Ollert's org → boards → board-detail structure well:

* Fixed left **sidebar** — org switcher at top, nav links below (boards list, members, settings). Themed the same as the rest of the shell (light/dark via the `class` strategy below), not a permanently-dark panel — an earlier draft of this doc called for a fixed dark background, but that reads as a bug (dark-mode toggle visibly doing nothing to the sidebar) rather than an intentional accent, so it was dropped.
* Top **navbar** — search, notifications, user menu.
* Content area: **cards** for summary/stat blocks, **tables** for list views (e.g. org members), and — specific to Ollert, not in the source repo — the kanban board view (lists-of-cards) as the main content area on a board page.
* Dark mode via Tailwind's `class` strategy (`darkMode: 'class'`), toggled by a class on `<html>`, not media-query-only — matches how Ollert's own artifact/dashboard-style views should behave.

# Typography

**Inter**, falling back to Tailwind's default sans-serif stack. Load via `@fontsource/inter` or a self-hosted woff2 (avoid a Google Fonts runtime dependency for the shared-PHP-host deploy).

# Color palette

Extracted verbatim from `windmill-react-ui`'s `config.js` (Tailwind color scale extension, itself the Flowbite default palette). Full 50–900 scales; wire these into `tailwind.config` as custom colors.

```js
const colors = {
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb', 100: '#f4f5f7', 200: '#e5e7eb', 300: '#d5d6d7', 400: '#9e9e9e',
    500: '#707275', 600: '#4c4f52', 700: '#24262d', 800: '#1a1c23', 900: '#121317',
  },
  'cool-gray': {
    50: '#fbfdfe', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cfd8e3', 400: '#97a6ba',
    500: '#64748b', 600: '#475569', 700: '#364152', 800: '#27303f', 900: '#1a202e',
  },
  red: {
    50: '#fdf2f2', 100: '#fde8e8', 200: '#fbd5d5', 300: '#f8b4b4', 400: '#f98080',
    500: '#f05252', 600: '#e02424', 700: '#c81e1e', 800: '#9b1c1c', 900: '#771d1d',
  },
  orange: {
    50: '#fff8f1', 100: '#feecdc', 200: '#fcd9bd', 300: '#fdba8c', 400: '#ff8a4c',
    500: '#ff5a1f', 600: '#d03801', 700: '#b43403', 800: '#8a2c0d', 900: '#771d1d',
  },
  yellow: {
    50: '#fdfdea', 100: '#fdf6b2', 200: '#fce96a', 300: '#faca15', 400: '#e3a008',
    500: '#c27803', 600: '#9f580a', 700: '#8e4b10', 800: '#723b13', 900: '#633112',
  },
  green: {
    50: '#f3faf7', 100: '#def7ec', 200: '#bcf0da', 300: '#84e1bc', 400: '#31c48d',
    500: '#0e9f6e', 600: '#057a55', 700: '#046c4e', 800: '#03543f', 900: '#014737',
  },
  teal: {
    50: '#edfafa', 100: '#d5f5f6', 200: '#afecef', 300: '#7edce2', 400: '#16bdca',
    500: '#0694a2', 600: '#047481', 700: '#036672', 800: '#05505c', 900: '#014451',
  },
  blue: {
    50: '#ebf5ff', 100: '#e1effe', 200: '#c3ddfd', 300: '#a4cafe', 400: '#76a9fa',
    500: '#3f83f8', 600: '#1c64f2', 700: '#1a56db', 800: '#1e429f', 900: '#233876',
  },
  indigo: {
    50: '#f0f5ff', 100: '#e5edff', 200: '#cddbfe', 300: '#b4c6fc', 400: '#8da2fb',
    500: '#6875f5', 600: '#5850ec', 700: '#5145cd', 800: '#42389d', 900: '#362f78',
  },
  purple: {
    50: '#f6f5ff', 100: '#edebfe', 200: '#dcd7fe', 300: '#cabffd', 400: '#ac94fa',
    500: '#9061f9', 600: '#7e3af2', 700: '#6c2bd9', 800: '#5521b5', 900: '#4a1d96',
  },
  pink: {
    50: '#fdf2f8', 100: '#fce8f3', 200: '#fad1e8', 300: '#f8b4d9', 400: '#f17eb8',
    500: '#e74694', 600: '#d61f69', 700: '#bf125d', 800: '#99154b', 900: '#751a3d',
  },
}
```

**Semantic mapping to start from** (adjust once real UI exists):
* `gray`/`cool-gray` — pick one as the neutral scale for text/backgrounds/borders (don't use both).
* `blue` — primary/brand, links, primary buttons.
* `green` — success states.
* `red` — destructive actions, error states.
* `yellow` — warnings.

# Shadow token

One custom shadow beyond Tailwind's defaults, used for elevated cards/dropdowns:

```js
boxShadow: {
  bottom: '0 5px 6px -7px rgba(0, 0, 0, 0.6), 0 2px 4px -5px rgba(0, 0, 0, 0.06)',
}
```

# Not extracted

`@windmill/react-ui` itself (the component library — Base UI + Tailwind replaces it), its Create-React-App build tooling, Chart.js (no charts in Ollert's MVP), React Router (TanStack Start's router replaces it).
