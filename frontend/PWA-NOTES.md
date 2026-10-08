# Study Anchor — PWA + study-app theme

## Colour system

The brand palette is `#ffffff` `#676f9d` `#424769` `#2d3250` `#f9b17a`.

Rather than hand-editing every file, the tokens the app already used were
remapped:

- **`tailwind.config.js`** retints the whole `slate` ramp toward `#2d3250`, so
  existing classes (`bg-slate-900`, `border-slate-200`, `text-slate-500`, …)
  land on the palette with no changes to the pages that use them.
- **`src/index.css`** drives the semantic tokens (`primary`, `danger`,
  `success`, `secondary`) from CSS variables that swap between light and dark.
  This matters: a fixed `#424769` for `text-primary` would be invisible on a
  navy background.

The peach is rationed on purpose. It marks study progress and the main call to
action and nothing else — progress rings and bars, the streak chip, the active
mobile tab, the focus ring. It is deliberately **not** promoted to the primary
colour in dark mode, or it would lose its force.

Useful classes added: `.lv-card`, `.lv-card-interactive`, `.lv-section-title`,
`.lv-meta`, `.lv-skeleton`, `.lv-safe-top`, `.lv-safe-bottom`.

## PWA

Hand-rolled, no new dependencies, so it works with the existing plain Vite
setup.

| File | Role |
| --- | --- |
| `public/manifest.webmanifest` | Name, standalone display, maskable icons, 3 app shortcuts |
| `public/sw.js` | Caching strategies, offline fallback, update handling |
| `public/offline.html` | Branded fallback when nothing is cached |
| `src/pwa/registerSW.js` | Registration; re-broadcasts SW lifecycle as DOM events |
| `src/components/PwaPrompts.jsx` | Install prompt, iOS hint, offline banner, update toast |

Caching strategies in `sw.js`:

- **navigations** — network-first, falling back to the cached shell, then
  `/offline.html`. SPA routing keeps working offline.
- **`/assets/*`** — cache-first (filenames are content-hashed, so this is safe).
- **icons, fonts** — stale-while-revalidate.
- **`GET /api/*`** — network-first with a 60-entry cache, so a student who loses
  signal still sees their last feed. Responses served from cache carry an
  `X-LV-From-Cache: 1` header if you want to surface that in the UI.
- **anything non-GET, plus auth/upload paths** — never cached.

### Testing it

The service worker only registers in a production build, never in `npm run dev`
— a SW caching a dev server makes debugging miserable.

```bash
npm run build && npm run preview
```

Then in DevTools → Application, check Manifest and Service Workers, and tick
"Offline" and reload. Verified working: the app renders fully offline and the
offline banner appears.

### Deployment requirements

1. **HTTPS.** Service workers do not register over plain HTTP (localhost aside).
2. **SPA rewrite.** All routes must serve `index.html`, as they must already for
   React Router.
3. **Do not cache `sw.js`.** Serve it with `Cache-Control: no-cache`, or browsers
   may sit on a stale worker and never pick up a deploy.
4. **Bump `VERSION` in `public/sw.js`** when you change caching behaviour. Old
   caches are cleared on activate.

## Study-progress tracking

`src/hooks/useStudyProgress.js` tracks opened materials and a day streak in
`localStorage`. It is client-side on purpose: it works offline, needs no backend
change, and "which handouts have I opened" is a per-device question. The
dashboard stat tiles and the per-course "% read" bars read from it.

If the API later returns real progress, swap the reads inside that hook — the
components consuming it do not need to change.
