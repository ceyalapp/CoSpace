# CollabBuy

Community group-buy app for residential decisions (solar, EV, interiors, etc.).
Responsive web client backed by an Express REST API — one codebase serves both
mobile and desktop layouts.

Implementation derived from the Claude Design handoff bundle (`CollabBuy.html`
prototype). The visual language — sage + sun + cream, Bricolage Grotesque +
Plus Jakarta Sans — is preserved.

## Run

```
npm install
npm start
```

Then open <http://localhost:3000>. The same URL adapts:
- < 960 px viewport → mobile shell with bottom tab bar
- ≥ 960 px viewport → desktop shell with sidebar nav

State persists to `data/state.json` (auto-seeded from `data/seed.json` on first
run). `POST /api/admin/reset` re-seeds.

## REST API

All endpoints return JSON. Mutations are debounced-flushed to disk.

| Method | Path                              | Notes                              |
|--------|-----------------------------------|------------------------------------|
| GET    | `/api/health`                     | liveness                           |
| GET    | `/api/me`                         | current user + active requirements + shortlist + budget |
| GET    | `/api/me/checklist`               | personal install checklist         |
| POST   | `/api/me/checklist`               | `{ text }` — add item              |
| PATCH  | `/api/me/checklist/:id`           | `{ done?, text? }`                 |
| DELETE | `/api/me/checklist/:id`           |                                    |
| GET    | `/api/requirements`               | all categories with stats          |
| GET    | `/api/requirements/:id`           | category + workspace (plans, threads, polls, group buy, resources) + vendors |
| GET    | `/api/vendors`                    | `?cat=&q=` filters                 |
| GET    | `/api/vendors/:id`                | detail with reviews + community jobs |
| POST   | `/api/vendors/:id/reviews`        | `{ rating: 1-5, text }`            |
| GET    | `/api/plans`                      | `?cat=` filter                     |
| GET    | `/api/threads/:id`                | thread with author                 |
| POST   | `/api/threads/:id/like`           | increments like count              |
| POST   | `/api/polls/:id/vote`             | `{ optionIndex }`                  |
| POST   | `/api/group-buys/:reqId/join`     | increments joined (capped at target) |
| GET    | `/api/search?q=`                  | requirements, vendors, plans, threads |
| POST   | `/api/admin/reset`                | reset state.json from seed.json    |

## Layout

```
server.js                Express REST API + static host
data/
  seed.json              read-only seed data
  state.json             runtime mutations (gitignored)
public/
  index.html             SPA shell, loads React + Babel from CDN
  styles.css             design tokens + responsive layout
  app.jsx                all screens (Babel transpiles in-browser)
```

## Notes on the implementation

- Single React tree handles both layouts; viewport breakpoint at 960 px.
- Mobile uses a fixed bottom tab bar; desktop uses a sticky sidebar.
- API mutations are optimistic in the UI with rollback on failure (checklist toggles, poll votes, group-buy join).
- The design used a per-file `<script type="text/babel">` setup for prototyping;
  for production we'd pre-compile JSX (Vite/esbuild) — left as in-browser Babel
  here to match the design's tech and keep the bundle dependency-light.
