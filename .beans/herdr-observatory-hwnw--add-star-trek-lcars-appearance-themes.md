---
# herdr-observatory-hwnw
title: Add Star Trek LCARS appearance themes
status: completed
type: feature
created_at: 2026-10-14T18:16:34Z
updated_at: 2026-10-14T18:16:34Z
---

Opt-in LCARS frame (elbow rail, header bars, capped kanban columns) with eleven palettes from the Federation colour chart: Movie Era, LCARS, TNG, Blue/Grey/Yellow/Red Alert, Star Trek Online, Klingon, Romulan, Gorn.

- [x] lcars-<palette> options in the Appearance selector
- [x] text on every bar picks black or white by WCAG contrast
- [x] local fonts only (CSP font-src 'none'); body text stays regular width
- [x] overview-lcars screenshot + npm run verify

## Summary of Changes

CSS-only themes scoped to :root[data-theme^=lcars]; existing light/dark/system untouched. Screenshot script captures the Movie Era palette.
