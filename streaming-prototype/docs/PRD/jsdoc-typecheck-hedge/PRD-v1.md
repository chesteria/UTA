# PRD: JSDoc Type Check + JSON Schema Validation Hedge

**Feature slug:** `jsdoc-typecheck-hedge`
**Type:** Foundation / tooling
**Parent phase:** Foundation (cross-cutting)
**Estimated build time:** 3–5 sessions
**Created:** 2026-04-13
**Status:** Draft — ready to build

---

## Problem

The codebase has accreted ~14K LOC of vanilla JS with no compile-time type checking and no runtime validation against the JSON data shapes in `/data/`. Three concrete pain points:

1. **Claude Code re-infers types every session.** Each new session has to re-discover what shape a `Show` or a `Rail` has by reading call sites. Type context evaporates at the session boundary.
2. **JSON shape drift isn't caught until runtime** on the specific screen that renders the affected field. A field added to `show-003.json` but not `show-004.json` only surfaces when you navigate to the PDP for show-003.
3. **Manual coordination between the 20 show JSONs is fragile.** Nothing enforces that they share the same shape.

---

## Goal

Catch type errors at development time and JSON shape drift at load time, **without touching runtime behavior or rewriting any module**. The existing vanilla JS + IIFE architecture stays exactly as-is. This is a layered hedge, not a rewrite.

What "done" looks like:

- `npm run typecheck` runs against all `js/` files and reports JSDoc-enforced type errors.
- Every JSON file under `data/` is validated by a zod schema at `DataStore.init()` time. Validation failures log loud, clear errors and fall back to empty data for that key instead of crashing.
- CI blocks merges that fail typecheck.
- Claude Code sees typed shapes immediately on opening any file, without having to read its way across the codebase.

---

## Specification

### 1. Enable TypeScript's check-JS mode

Create `tsconfig.json` at the repo root:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ES2020",
    "moduleResolution": "node",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": false,
    "noImplicitAny": false,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["streaming-prototype/js/**/*.js", "streaming-prototype/js/types/**/*.js"],
  "exclude": ["node_modules", "streaming-prototype/js/firebase-config.js"]
}
```

Strict mode is deliberately off. Retrofitting strict TS onto 14K LOC of legacy JS is hours of busywork for no gain. We're after the 80% win, not the 100%.

### 2. Add `// @ts-check` file-by-file

Add the `// @ts-check` directive to every `.js` file under `streaming-prototype/js/`. Files that surface too many errors to fix in the current session get `// @ts-nocheck` with a `TODO(typecheck)` comment instead — we grandfather existing issues rather than blocking on them.

Priority order for enabling:
1. `js/data-store.js`, `js/focus-engine.js`, `js/app.js`, `js/utils/*.js` (core)
2. `js/analytics.js`, `js/debug-panel.js`
3. `js/screens/lander.js`, `js/screens/series-pdp.js`, `js/screens/player.js`
4. `js/screens/epg/**/*.js`
5. `js/feedback.js`, `js/welcome-screen.js`, `js/reporting.js`

### 3. Add JSDoc typedefs for the major shapes

Create `streaming-prototype/js/types/` with one file per typedef cluster:

- `types/catalog.js` — `Show`, `Channel`, `City`, `Collection`, `Catalog`, `Genre`
- `types/series.js` — `SeriesData`, `Season`, `Episode`, `Extra`
- `types/lander-config.js` — `LanderConfig`, `Rail` (as a union of rail-type objects)
- `types/device-profile.js` — `DeviceProfile`, `DeviceId`
- `types/analytics.js` — `AnalyticsEvent` (derived from `docs/ANALYTICS_REGISTRY.md`)
- `types/debug-config.js` — `DebugConfig`
- `types/version.js` — `VersionInfo`
- `types/epg.js` — EPG data shapes

Example of the format:

```javascript
// types/catalog.js
/**
 * @typedef {'TV-Series' | 'Movie' | 'Special'} ShowType
 * @typedef {'TV-G' | 'TV-PG' | 'TV-14' | 'TV-MA'} ContentRating
 *
 * @typedef {Object} Show
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} heroImage
 * @property {string} posterImage
 * @property {string} landscapeImage
 * @property {ContentRating} rating
 * @property {string} year
 * @property {string[]} genres
 * @property {number} seasons
 * @property {ShowType} type
 * @property {string[]} badges
 * @property {string} duration
 * @property {boolean} featured
 * @property {string} director
 * @property {string[]} cast
 */

// etc.
```

Only type **public interfaces** — the shapes that cross module boundaries. Internal helpers stay untyped; `noImplicitAny: false` lets them slide.

### 4. Install zod and write schemas

```bash
npm install zod
```

Create `streaming-prototype/js/schemas/` with one schema per typedef cluster. Schemas use `.passthrough()` by default so extra/unknown fields don't break validation — we're catching shape drift, not enforcing strict matching.

```javascript
// schemas/catalog.js
import { z } from 'zod';

export const ShowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  heroImage: z.string(),
  posterImage: z.string(),
  landscapeImage: z.string(),
  rating: z.enum(['TV-G', 'TV-PG', 'TV-14', 'TV-MA']),
  year: z.string(),
  genres: z.array(z.string()),
  seasons: z.number(),
  type: z.enum(['TV-Series', 'Movie', 'Special']),
  badges: z.array(z.string()),
  duration: z.string(),
  featured: z.boolean(),
  director: z.string(),
  cast: z.array(z.string()),
}).passthrough();

export const CatalogSchema = z.object({
  shows: z.array(ShowSchema),
  channels: z.array(ChannelSchema),
  cities: z.array(CitySchema),
  collections: z.array(CollectionSchema),
  genres: z.array(z.string()),
  featured: z.array(z.string()),
}).passthrough();
```

### 5. Wire validation into DataStore

In `js/data-store.js`, modify `init()` so every loaded JSON is validated:

```javascript
import { CatalogSchema } from './schemas/catalog.js';
import { LanderConfigSchema } from './schemas/lander-config.js';
// ...

async function init() {
  const rawCatalog = await loadJSON('data/catalog.json');
  const result = CatalogSchema.safeParse(rawCatalog);
  if (!result.success) {
    console.error('[DataStore] catalog.json failed schema validation:', result.error.format());
    catalog = { shows: [], channels: [], cities: [], collections: [], genres: [], featured: [] };
  } else {
    catalog = result.data;
  }
  // Same pattern for lander-config, version, geo-state, and the 20 series files.
}
```

Validation failures log loudly but don't crash — a malformed `show-007.json` shouldn't take down the entire lander. Each failure is surfaced clearly in the console so it can be fixed.

### 6. Add npm script and CI gate

`package.json`:

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "jest --forceExit"
}
```

`.github/workflows/typecheck.yml` (new workflow):

```yaml
name: Typecheck
on:
  pull_request:
    branches: [main]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run typecheck
```

PRs that fail `npm run typecheck` cannot merge. Grandfathered `@ts-nocheck` files pass because they're opted out; only new errors block.

### 7. Document the conventions

Create `docs/JSDOC_GUIDE.md` — one page with:
- How to add `@typedef` blocks
- How to reference types across files (`/** @type {import('./types/catalog.js').Show} */`)
- How to opt a file out with `@ts-nocheck`
- How zod schemas map to typedefs

---

## Session Budget

| Session | Work |
|---|---|
| 1 | `tsconfig.json`, enable `@ts-check` on the 5 core files (data-store, focus-engine, scale, keycodes, app), fix surfaced errors |
| 2 | `@ts-check` on all screens (lander, pdp, player, EPG sub-files), grandfather any painful files |
| 3 | Create `types/` directory, add JSDoc `@typedef` blocks for all major shapes |
| 4 | Install zod, write schemas, wire into `DataStore.init()`, test with intentionally-broken JSON fixtures (see Testing note below) |
| 5 | CI workflow, `docs/JSDOC_GUIDE.md`, polish, final typecheck pass |

5 sessions is the target; 3 is the floor if everything lands clean. Treat anything beyond 5 as a signal that something is wrong and stop to reassess.

---

## Testing Scope

This PRD deliberately keeps testing minimal. The hedge **is** the test layer — `// @ts-check` validates the source via the TypeScript compiler, and zod schemas validate the JSON data at load time. Writing additional unit tests for either layer would mostly be testing the test framework itself.

**What we ARE testing (Session 4):**

For each zod schema, create one intentionally-broken JSON fixture and one assertion that the schema rejects it. This is the only thing standing between "we wrote schemas" and "the schemas actually catch what they claim to catch." A schema that's accidentally too permissive (`.passthrough()` covering the wrong field, a `z.any()` slipping in) will silently accept broken JSON — and you won't know unless you've explicitly proven it rejects bad data.

The pattern:

```
streaming-prototype/tests/fixtures/broken/
├── catalog-missing-shows.json        # catalog with no `shows` key
├── show-wrong-rating.json            # rating: "TV-X" (not in enum)
├── lander-config-unknown-rail.json   # rail with type: "fake-rail"
├── version-missing-build.json        # version.json without buildNumber
└── series-missing-episodes.json      # season with no episodes array
```

And one test file (`tests/unit/schemas-reject-bad-data.test.js`) under the existing Jest setup, with one `safeParse` assertion per fixture:

```javascript
const brokenCatalog = require('../fixtures/broken/catalog-missing-shows.json');
const { CatalogSchema } = require('../../streaming-prototype/js/schemas/catalog.js');

test('CatalogSchema rejects catalog missing shows array', () => {
  const result = CatalogSchema.safeParse(brokenCatalog);
  expect(result.success).toBe(false);
});
```

Five fixtures, five assertions, roughly ten minutes of work inside Session 4. This is the entire testing scope of the hedge.

**What we are explicitly NOT testing:**

- ❌ That `// @ts-check` works. The TypeScript compiler is already tested by Microsoft. If `npm run typecheck` exits 0, that's the test.
- ❌ The typedefs themselves. Typedefs are declarations; they don't execute.
- ❌ That valid JSON validates successfully. The fact that `DataStore.init()` doesn't crash on real data on first load *is* the test, and CI catches regressions there.
- ❌ Integration tests for `DataStore` post-validation. Existing behavior is unchanged; the existing analytics test suite still covers what it covered before.
- ❌ Vitest, `@testing-library/dom`, or any new test infrastructure. The hedge uses the existing Jest setup. New test infrastructure decisions belong in Phase 3, not here — making them twice (once for the hedge, again for Phase 3) is wasted work.
- ❌ A separate "test plan" document. The five fixtures and the one test file *are* the plan.

---

## What to Skip

- **Do NOT convert `.js` → `.ts`.** That's the migration we explicitly chose not to do.
- **Do NOT enable strict mode.** Retrofitting is hours of busywork.
- **Do NOT refactor IIFE patterns.** Leave global singletons alone.
- **Do NOT change the module loading system.** Script tags stay.
- **Do NOT try to type every internal helper.** Public interfaces only.
- **Do NOT validate at every access point.** Validate once at load; trust the typed shape thereafter.

---

## Analytics Events

N/A. This is a tooling change with no user-visible surface.

---

## Risks

1. **`@ts-check` surfaces existing latent bugs.** *Mitigation:* file-by-file adoption with `@ts-nocheck` as the escape hatch. Grandfathered files get `TODO(typecheck)` comments and can be fixed opportunistically.
2. **JSDoc is verbose.** *Mitigation:* only type public interfaces. Most files will have zero new JSDoc — they'll just pick up types from `import`ed modules.
3. **zod bundle weight.** zod is ~50KB minified. This runs in the browser at `DataStore.init()` time. For a TV prototype that's acceptable, but worth noting. If it ever matters, swap to a hand-rolled validator — the schemas are the contract, the library is swappable.
4. **CI gate blocks work if misconfigured.** *Mitigation:* validate the workflow on a throwaway PR before enforcing on main.

---

## Relationship to the Broader Stack Question

This PRD captures most of the type-safety win from a full Vite+TS migration at roughly 1/10th the cost and zero risk to the shipping codebase. It is designed to be valuable **on its own**, independent of any future toolchain decision.

If a greenfield Phase 3 in Vite+TS+Tailwind proceeds (see `docs/PRD/phase3-experience-completion/`), the JSDoc typedefs and zod schemas written here port directly to TypeScript types — zod schemas *are* TS types once you call `z.infer<typeof Schema>`. Nothing done here is thrown away by a later migration, if one ever happens.

---

## File Location

```
docs/PRD/jsdoc-typecheck-hedge/
├── PRD-v1.md    ← this file
└── progress.md  ← running log (TBD once started)
```
