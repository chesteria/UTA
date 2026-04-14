# PRD: Phase 3 — Experience Completion (Greenfield Toolchain Pilot) v2

**Feature slug:** `phase3-experience-completion`
**Version:** 2.0
**Type:** New feature phase + greenfield toolchain pilot
**Parent phase:** Phase 3 (redefined — supersedes the old Phase 3 PRD)
**Estimated build time for pilot slice:** 12–15 sessions
**Created:** 2026-04-13
**Revised:** 2026-04-13 (post second external review)
**Status:** Draft v2 — ready to build after PRD review

---

## v2 Revision Notes

This PRD was revised after a second external code review (Codex) that focused on implementation-level issues rather than strategy. The v1 strategy is unchanged — the greenfield pilot approach, the location slice, the abandonment criteria, and the decision gate are all retained. v2 sharpens execution in eleven specific places that would have caused session waste if left in.

**Eleven changes in v2:**

1. **`streaming-prototype-v2/` is explicitly self-contained**, not a loose sibling folder. Own `package.json`, own lockfile, own `.nvmrc`, own CI workflow using `working-directory`. Prevents the root's existing Phase 1 tooling (Jest, hedge typecheck, validate-data) from entangling with Vite/Vitest.
2. **Focus engine port gets a thin adapter layer.** Literal port preserves parity; adapter gives screens a stable API that can evolve without touching the port. Enables future vertical zones, nested zones, and disabled items without rewriting the engine.
3. **P0 validation cases revised.** BroadcastChannel dropped (not critical to pilot). Added: font loading behavior on-device, text-input + arrow-key arbitration (the picker has a search field — this is a real risk), and back/escape handling during picker input.
4. **BroadcastChannel removed from pilot entirely.** Not needed for the pilot and adds browser-surface risk. Analytics stub becomes a plain typed logger.
5. **Chunk reordering: LocationService moves earlier.** New order gives screens a clean state contract from day one instead of letting them leak `localStorage` calls that get cleaned up later.
6. **Deploy decision made now, not deferred.** `/v2/` sub-path on the existing GitHub Pages site. Not a second Pages site.
7. **Source maps gated by `VITE_SOURCEMAP` env flag**, not unconditional. Debuggability for preview; tighter control for production.
8. **Pilot locked to Tailwind v3 + vanilla TS baseline.** Tailwind v4 and Lit experiments are explicitly out of P0. They can return as separate validation work if ever needed.
9. **Tiny `LocationFlow` state machine** for the pilot flow (4 states: `detecting`, `confirming`, `picking`, `complete`) instead of ad-hoc screen-to-screen transitions.
10. **DOM data-attribute convention established at the top of the PRD** — `data-focus-id`, `data-focus-zone`, `data-focusable`. Establishes convention before any screen code is written.
11. **Bundle target split** into JS gzipped, CSS gzipped, font payload, and first-render time. Tailwind creep shows up in CSS first, not JS — a single combined target would miss it.

**Plus one small addition:** a `PILOT_ANIMATIONS_ENABLED` config flag from day one, for fast device debugging when animations misbehave on older WebViews.

**Intentionally rejected from the review:** Collapsing Schemas and LocationService into a single foundation chunk. Keeping them separate respects session boundaries and keeps reviewable PRs small.

The v1 file is preserved in this folder as a record. The strategy is unchanged; only the execution plan is sharper.

---

## 1. Context

Phase 3 has been **redefined**. The original Phase 3 (`docs/PRD/phase3-scenarios-and-simulation-v1.0.md`) was internal tooling for testing — scenario presets and device simulation for stakeholder demos. That PRD is superseded by this one.

The new Phase 3 is **user-facing completion**: filling in the missing pieces of the prototype so it feels like a real streaming app during user research sessions. Target features:

- **Location detection & selection** — simulated geo detection, "is this you?" confirmation, manual city picker, change-location flow
- **Search** — simulated results, typeahead, filters (future PRD after pilot)
- **Auth flows** — login, signup, forgot password (future PRD after pilot)
- **Any additional "seam" screens** needed to make the simulated experience feel complete

This phase is **also being used as a greenfield toolchain pilot** for Vite + TypeScript + Tailwind. Rather than migrating the existing ~14K LOC of Phase 1 vanilla JS into the new stack (the approach proposed in `docs/PRD/vite-ts-tailwind-migration/PRD-v1.md`, rejected after adversarial review), Phase 3 is built greenfield in the new stack from day one. Phase 1 stays untouched at v1.7.x.

The logic is: if a real user-facing Phase 3 feature ships successfully on real TV hardware using Vite + TS + Tailwind, the toolchain is validated on evidence, not speculation. A later decision about retroactively migrating Phase 1 can then be made with data instead of faith.

This is **Strategy A** from the adversarial review of the migration PRD: greenfield new work in new stack, old work frozen, explicit decision gate after the pilot.

---

## 2. Goals

- Ship the first Phase 3 feature (**Location Detection & Selection** — see Section 5) as a greenfield Vite + TS + Tailwind deliverable running on target TV hardware.
- Validate the new toolchain on real user-facing work, not a hello-world spike.
- Keep Phase 1 **entirely untouched** — no coupling, no shared runtime state during the pilot.
- Establish a clear **decision gate** after the pilot: continue Phase 3 in new stack? Retroactively migrate Phase 1? Abandon and revert?
- Preserve `FocusEngine` semantics (port literally from Phase 1) while **insulating future screens from its limitations** via a thin adapter layer.

---

## 3. Non-Goals (for pilot)

- **Device support is governed by `docs/SUPPORTED_DEVICES.md`,** not by ad-hoc decisions in this PRD. Summary: Tizen 5.5+ (2020+ Samsung), VIZIO 2019+, AndroidTV/Google TV/Shield (current), FireTV via Capacitor wrapper (Fire OS 6+). Roku and tvOS are explicitly **out of scope** for this codebase — they are tracked as future parallel implementations in separate projects (BrightScript/SceneGraph for Roku, SwiftUI for tvOS), not as additional targets for the same build. Mobile is a deferred future phase.
- No retroactive migration of Phase 1 files.
- No shared runtime state between Phase 1 and the pilot. They run as separate pages/sites.
- No Phase 1 catalog integration. The pilot uses a standalone hardcoded city list.
- No real Firebase Analytics integration in the pilot. Events log to the dev console; Firebase wiring is deferred until the decision gate.
- **No `BroadcastChannel` usage in the pilot.** Analytics is a plain typed logger. Cross-tab/cross-context signaling is not a pilot concern.
- **Pilot is locked to vanilla TS + Tailwind v3.** Lit, Solid, Tailwind v4, and other alternatives are out of pilot scope. They can be evaluated later as separate validation exercises if a specific need emerges — not as in-pilot experiments.
- No framework decision pre-spike beyond the above lock. The P0 spike confirms the v3 + vanilla TS baseline works and stops there.

---

## 4. Strategy & File Layout

The greenfield app lives as a **self-contained sibling project** inside the same repo:

```
repo-root/
├── package.json                 # Root — Phase 1 tooling ONLY (Jest, hedge typecheck, validate-data)
├── tsconfig.json                # Root — Phase 1 only
├── streaming-prototype/         # Phase 1, untouched, vanilla JS
│   └── ... (current app, frozen at v1.7.x for the pilot duration)
└── streaming-prototype-v2/      # Phase 3, greenfield Vite + TS + Tailwind
    ├── package.json             # OWN package.json — no root inheritance
    ├── package-lock.json        # OWN lockfile
    ├── .nvmrc                   # Node 20 LTS (may match root, but separate file)
    ├── tsconfig.json            # OWN tsconfig (strict mode on)
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── vitest.config.ts
    ├── index.html               # Vite entry
    ├── src/
    │   ├── main.ts              # Boot entry
    │   ├── app.ts               # LocationFlow state machine + screen mounting
    │   ├── types/
    │   │   └── location.ts      # Derived from zod schemas via z.infer
    │   ├── schemas/
    │   │   └── location.ts      # Source of truth for City, LocationState shapes
    │   ├── core/
    │   │   ├── focus-engine.ts  # Literal port from Phase 1
    │   │   ├── focus-controller.ts  # Thin adapter — the v2-facing API
    │   │   └── location-service.ts  # Shared module for selected city + subscribers
    │   ├── screens/
    │   │   └── location/
    │   │       ├── detection.ts
    │   │       ├── confirmation.ts
    │   │       └── picker.ts
    │   ├── data/
    │   │   └── cities.json
    │   ├── config/
    │   │   └── pilot-flags.ts   # PILOT_ANIMATIONS_ENABLED, etc.
    │   └── styles/
    │       └── global.css
    └── tests/
        ├── unit/
        └── fixtures/broken/
```

**Self-contained means:** the root `package.json` has zero knowledge of `streaming-prototype-v2/`. Running `npm ci` at the root does not install Vite. Running `cd streaming-prototype-v2 && npm ci` does. This is a hard boundary, not a convention.

**Why self-contained over workspaces:** the root already has Phase 1's test/typecheck/data-validation tooling in its `package.json`. Introducing npm workspaces at this point would be a retrofit on the hedge's work and could destabilize it. A fully independent subfolder is the lower-risk path for the pilot. If Phase 3 survives the decision gate and proliferates, workspace conversion can happen as a dedicated cleanup chunk later.

**Deployment:** `/v2/` sub-path on the existing GitHub Pages site (decided in v2, not deferred). Separate workflow file (`.github/workflows/deploy-v2.yml`) builds `streaming-prototype-v2/` and deploys `dist/` to the `/v2/` sub-path. Phase 1's existing deploy workflow is unchanged. The two workflows do not interact.

---

## 5. The Pilot Slice: Location Detection & Selection

### Why this feature first

- **Self-contained.** One detection screen, one confirmation overlay, one picker screen. No cross-feature dependencies.
- **Clear user story.** First launch → simulated detection → confirm or pick another → selection persists.
- **No Phase 1 catalog dependency.** Uses a standalone city list file.
- **Real complexity where it matters.** Grid of city cards with d-pad navigation, search-as-you-type filter, focus state handling, **text input + arrow key arbitration** — all the things that would need to work in any future Phase 3 screen. The search field in the picker is *deliberately* in scope because it exercises an interaction pattern (text input competing with d-pad navigation) that must work on TV devices before we can build Search or Auth later.
- **Useful on its own.** Even if we decide not to continue Phase 3 in the new stack, a working location-picker is a legitimate deliverable.

### LocationFlow state machine

The pilot's screen orchestration runs through a tiny state machine with exactly four states:

```typescript
// src/app.ts
type LocationFlowState =
  | { kind: 'detecting' }
  | { kind: 'confirming'; detectedCity: City }
  | { kind: 'picking'; query: string; selectedIndex: number }
  | { kind: 'complete'; selectedCity: City };

type LocationFlowEvent =
  | { type: 'detection_complete'; city: City }
  | { type: 'confirm_detected' }
  | { type: 'reject_detected' }
  | { type: 'query_changed'; query: string }
  | { type: 'picker_selection_changed'; index: number }
  | { type: 'city_selected'; city: City }
  | { type: 'change_location_requested' };
```

Transitions are pure functions: `(state, event) => nextState`. Screens render based on the current state and emit events. This gives the pilot:

- Deterministic state transitions (no "how did we get here?" debugging)
- Trivially unit-testable flow logic (feed events into the reducer, assert on state)
- A clear place to add new states as the pilot evolves
- Reduced coupling between screens (they don't know about each other; they know about state)

**Why not just the App router from Phase 1?** The App router is fine for screen mounting (v2 still needs that) but doesn't model flow state — it models a navigation stack. A state machine is a better fit for a multi-screen workflow that has branching logic (detected city accepted vs rejected) and persistent derived state (picker query, selection index).

### Focus DOM convention

Establishing this convention *now*, before any screen code is written, prevents every future screen from inventing its own pattern:

- **`data-focus-zone="<name>"`** — declares a focusable zone container. Example: `<div data-focus-zone="picker-grid">`.
- **`data-focusable="true"`** — marks an individual focusable element inside a zone. Example: `<button data-focusable="true" data-focus-id="city-austin-tx">`.
- **`data-focus-id="<stable-id>"`** — stable identifier for a focusable element, used for focus restoration and testing. Must be unique within a zone.

The adapter API (`focus-controller.ts`) reads these attributes to discover zones and focusable elements, rather than requiring every screen to construct zone objects manually. This makes screen code cleaner and tests easier: `getByDataFocusId('city-austin-tx')` in a test just works.

### Pilot flags

```typescript
// src/config/pilot-flags.ts
export const PILOT_ANIMATIONS_ENABLED = true;
export const PILOT_SIMULATED_DETECTION_DELAY_MS = 2000;
// ... etc
```

`PILOT_ANIMATIONS_ENABLED` exists from day one so that when an animation misbehaves on a Tizen 5.5 device, the debug loop is one boolean flip, not an hour of code spelunking. Costs nothing to add; pays back the first time you need it.

### User flow

1. **First launch** — `LocationFlow` starts in `detecting` state. Shows "Detecting your location..." with a 2-second loading animation, then picks a random city from the list (simulated detection). Transitions to `confirming`.
2. **"Is this you?" overlay (`confirming` state)** — shows the detected city with two buttons: "Yes, that's right" and "Pick a different location". Two-button focus zone via `focus-controller`.
3. **Manual picker (`picking` state)** — grid of city cards, search-as-you-type filter field at the top, d-pad navigation between field and grid. This is where the text-input + arrow-key arbitration happens.
4. **Persistence** — on selection (`complete` state), the chosen city is persisted via `LocationService` which writes to `localStorage`. On subsequent launches, `LocationService.getSelectedLocation()` returns the stored value and the flow short-circuits to `complete` without re-running detection.
5. **Change location** — a stub button somewhere (exact placement TBD in P7) re-opens the flow in `picking` state.

### Out of scope for the pilot

- Real geo IP detection or browser geolocation API.
- Integration with the Phase 1 lander's city-based rails (pilot is a standalone page).
- Multi-language support.
- Location permissions dialogs (we're simulating, not requesting).
- Any of the other Phase 3 features (search, auth) — those are separate PRDs that come after the pilot validates.
- Soft-keyboard integration on TV devices. The search field uses the device's native text input (remote-keyboard or USB keyboard). Soft-keyboard UI is a separate concern.

---

## 6. Chunk Plan for the Pilot

Each chunk is a single squash-merged PR. Sizing is explicit; the total band (12–15 sessions) is deliberately honest about uncertainty.

**Reordered from v1:** LocationService moves ahead of the screens, so screens have a stable state contract from the moment they're written.

### Chunk P0 — Device Compatibility Spike (Real)

*Not* a hello world. This spike exercises the toolchain features **and interaction patterns** that could realistically break on the target TV WebViews.

**Test devices** (per `docs/SUPPORTED_DEVICES.md`):
- **Tizen 5.5 device** (2020+ Samsung) — the binding constraint, Chromium 69 baseline
- **2019 VIZIO V505-G9** (developer mode) — second-oldest target
- **NVIDIA Shield or Google TV Streamer** — modern-Chromium sanity check

FireTV via Capacitor wrap is **out of P0.** It is a separate workstream and has its own friction (APK build/sideload). FireTV validation is deferred to a later dedicated chunk after the hosted build is stable.

**The spike is a single page that includes:**
- Vite bundled output with `build.target: 'es2017'`
- An `import.meta.env.VITE_*` read
- A dynamic `import()` of a secondary chunk (lazy loading)
- A Tailwind v3-generated class that uses a CSS custom property
- **`@fontsource/roboto` loaded via npm** — verify bundled fonts actually load on device without FOUT, layout shift, or delayed text metrics. **This is a new v2 test case.**
- **A text input field + arrow-key handling** — verify that arrow keys work inside the field (cursor movement) AND can hand off focus to a grid of buttons on `ArrowDown` without fighting over event handling. **This is a new v2 test case.**
- **Back/escape handling while text input is focused** — verify the BACK button (or Escape key) exits the flow cleanly instead of just blurring the input. **This is a new v2 test case.**
- A focusable button that changes styling on focus via the planned `focus-controller` API

**Explicitly NOT tested in P0 (v2 change):**
- `BroadcastChannel` — removed. Not needed for the pilot.
- `hls.js` stub import — removed. No video in the location pilot; HLS validation can happen in a future chunk if a Phase 3 feature actually needs video.
- Tailwind v4 variant — not in P0 scope per Non-Goals.
- Lit variant — not in P0 scope per Non-Goals.

**Deliverable:** `docs/PRD/phase3-experience-completion/device-compat-results.md` with a pass/fail matrix — one row per toolchain feature × device, plus the three new v2 interaction cases.

**Go/no-go decision rule:**
- If **the Tizen 5.5 + vanilla TS + Tailwind v3 baseline** fails any core feature (bundled JS runs, font loads, text input + arrow keys arbitrate correctly, back button exits) → pilot is paused and the failure is investigated.
- If the baseline works → proceed to P1. Document results.

**Estimate:** 1–2 sessions. (v1 had 1; the added interaction validation reasonably adds up to 0.5–1 session of real device testing time.)

---

### Chunk P1 — Self-Contained Scaffold + CI Gate

- `streaming-prototype-v2/` initialized via `npm create vite@latest` inside that directory. **Root `package.json` is not modified.**
- Own `package.json`, own `package-lock.json`, own `.nvmrc` (Node 20 LTS)
- TypeScript strict mode **on**
- Tailwind v3 configured with `tailwind.config.ts` + `postcss.config.js`
- Vitest + `@testing-library/dom` + jsdom — all installed under `streaming-prototype-v2/`, not root
- Prettier
- **Source maps controlled via env:** `vite.config.ts` reads `VITE_SOURCEMAP` env var and enables source maps when true. Default on for dev, on for preview deploys, off for production unless explicitly enabled.
- **`.github/workflows/deploy-v2.yml`** — new workflow using `working-directory: streaming-prototype-v2`. Builds via `npm ci && npm run build`, deploys `dist/` to the `/v2/` sub-path on the existing GitHub Pages site. Does not modify or interact with the existing Phase 1 deploy workflow.
- **`.github/workflows/ci-v2.yml`** — new workflow, also using `working-directory: streaming-prototype-v2`. Runs `npm ci && npm run build && npm test`. Triggered on PRs touching `streaming-prototype-v2/**`. PRs failing cannot merge.

**Acceptance:** empty shell runs locally via `cd streaming-prototype-v2 && npm run dev`; `npm run build` produces `dist/`; smoke test passes under Vitest; CI gate blocks merges on failure; existing Phase 1 deploy is completely unaffected (verified by checking that a PR touching only `streaming-prototype/` does not trigger the v2 workflow, and vice versa); a preview deploy to `/v2/` renders.

**Estimate:** 1–2 sessions.

---

### Chunk P2 — Core Schemas + Inferred Types for Location Data

This chunk follows the schema-source-of-truth pattern established in `docs/PRD/jsdoc-typecheck-hedge/PRD-v2.md`: zod schemas are the source of truth for data shapes, and TypeScript types are derived via `z.infer<typeof Schema>`. No dual maintenance.

- `src/schemas/location.ts` — zod schemas (source of truth)
  - `CitySchema` — id, displayName, region, state, coordinates
  - `CitiesArraySchema` — array of cities, used to validate the cities.json file
  - `LocationStateSchema` — detectedCityId, selectedCityId, lastUpdated (ISO string)
- `src/types/location.ts` — derived types, ~5 lines:
  ```typescript
  import type { z } from 'zod';
  import type { CitySchema, LocationStateSchema } from '../schemas/location';
  export type City = z.infer<typeof CitySchema>;
  export type LocationState = z.infer<typeof LocationStateSchema>;
  ```
- `src/data/cities.json` — standalone city list for the pilot (15–25 cities)

**Tests** — same two-layer pattern as the hedge:

1. **Positive smoke test** (catches misconfigured wiring): real `cities.json` validates against `CitiesArraySchema`.
2. **Negative fixtures** (catches too-permissive schemas):
   - `tests/fixtures/broken/city-missing-id.json`
   - `tests/fixtures/broken/location-state-bad-timestamp.json`

**Acceptance:** schemas compile under strict mode, derived types compile, positive smoke test passes, both negative fixtures correctly rejected, CI gate passes.

**Estimate:** 1 session.

---

### Chunk P3 — LocationService Shared Module *(reordered from P7 in v1)*

**This chunk comes before screens.** Moving it earlier gives screens a clean state contract from day one instead of letting them leak `localStorage` calls that get cleaned up later.

- `src/core/location-service.ts`
- Exports:
  - `getSelectedLocation(): City | null`
  - `setSelectedLocation(city: City): void`
  - `clearSelectedLocation(): void` (for debug / flow restart)
  - `subscribeToLocationChanges(handler: (city: City | null) => void): () => void` — returns an unsubscribe function
- Internal state lives in module scope; `localStorage` is the persistence layer
- On load, reads from `localStorage` and validates via `LocationStateSchema.safeParse()`; if validation fails, logs and treats as no selection
- **Unit tests:**
  - `set` then `get` round-trips
  - `clear` resets state
  - Subscribers fire on `set` and `clear`
  - Unsubscribe actually unsubscribes
  - localStorage with malformed data is handled gracefully (doesn't crash)
  - Subscription is synchronous (fires in order with the set/clear call)

No screens exist yet, so this chunk is pure module work with unit tests. It's a small, well-defined deliverable that unblocks everything after it.

**Acceptance:** module is importable, unit tests pass with 100% coverage on the public API, integration into state machine deferred to P6 when the first screen lands.

**Estimate:** 1 session.

---

### Chunk P4 — Focus Engine Port + Controller Adapter

**The port is literal; the adapter is new.** This is the most important structural change from v1: we preserve parity with Phase 1's focus engine while giving v2 screens a stable API that can evolve without touching the port.

- `src/core/focus-engine.ts` — **literal port** of `streaming-prototype/js/focus-engine.js` to TypeScript.
  - Strong typing for `FocusZone`, `KeyAction`, handler signatures
  - Behavioral parity with Phase 1 verified via shared test fixtures
  - No refactoring, no feature additions, no "cleanup"
- `src/core/focus-controller.ts` — **new adapter layer** that is the v2-facing API.
  - Reads the DOM focus convention (`data-focus-zone`, `data-focusable`, `data-focus-id`) to discover zones and elements automatically
  - Exposes screen-friendly methods: `registerZone(name, options)`, `focusZone(name)`, `focusElementById(id)`, `onAction(handler)`
  - Internally delegates to the literal `focus-engine.ts` port for the actual focus state and key handling
  - Hides the horizontal-list-only assumption and callback-driven shape of the underlying engine
  - Can be extended later (vertical zones, nested zones, disabled items, restoration after rerender) without touching the literal port
- Unit tests covering:
  - Port-level: zero/one/many items, edge navigation, wraparound, out-of-bounds, `setItems` shrink, handler swap
  - Adapter-level: zone discovery from DOM, focus-by-id, action handler dispatch, zone-to-zone transitions
- **Honest note on reverting:** if this chunk is reverted, every downstream chunk that imports from `focus-controller.ts` also reverts. `git revert` is a command, not a dependency solver.

**Why an adapter matters:** the current focus engine is good but minimal. It assumes horizontal zones, has no nested-zone concept, no formal lifecycle for unmount, no disabled-item concept, no screen-stack awareness. The picker grid needs some of that. Search and auth screens will need more. Doing the refactor work inside the port would violate parity; doing it in an adapter keeps both properties: parity with Phase 1 and room for Phase 3 to grow.

**Acceptance:** port passes parity tests against Phase 1; adapter passes DOM-convention tests; screens in later chunks import from the adapter, never directly from the port.

**Estimate:** 1–2 sessions.

---

### Chunk P5 — Design Tokens + Global Styles

- Port the tokens from `streaming-prototype/css/variables.css` into `tailwind.config.ts` (Tailwind v3 theme extension)
- Install Roboto via `@fontsource/roboto`
- `src/styles/global.css` holds `@tailwind` directives, keyframes, and any remaining global styles
- A tokens preview page (dev-only route) showing swatches, type samples, tile sizes
- **Font loading verified on-device** as part of the chunk acceptance (this is the second on-device test, after P0's initial spike)

**Acceptance:** tokens preview matches Phase 1's visual identity; font renders correctly on Tizen 5.5, VIZIO, and Shield/Google TV without FOUT or layout shift; CI gate passes.

**Estimate:** 1 session.

---

### Chunk P6 — Detection + Confirmation Screens *(with LocationFlow state machine)*

- `src/app.ts` — **`LocationFlow` state machine**, reducer, event dispatch
- `src/main.ts` — boot entry that mounts the state machine and subscribes to state changes to render the current screen
- `src/screens/location/detection.ts` — "Detecting your location..." loading state with configurable delay (`PILOT_SIMULATED_DETECTION_DELAY_MS`) + simulated pick from `cities.json`
- `src/screens/location/confirmation.ts` — "Is this you?" overlay with two focusable buttons ("Yes" / "Pick a different location")
- `focus-controller` integration for the two-button zone (via `data-focus-zone="confirmation-buttons"`)
- `PILOT_ANIMATIONS_ENABLED` flag gates the loading animation and transition effects
- `LocationService` integration: on `confirm_detected` event, the state machine calls `setSelectedLocation(detectedCity)` and transitions to `complete`
- First per-screen parity check against a mockup
- **Third on-device render test** — deploy to `/v2/` preview, verify rendering on Tizen 5.5 + Shield + VIZIO

**Unit tests:**
- `LocationFlow` reducer: each event transition from each state, including invalid events (no state change)
- `LocationService` integration: confirming the detected city persists via `LocationService`

**Acceptance:** real device render, simulated detection completes, confirmation overlay appears with correct focus state, "Yes" button commits selection via `LocationService` and transitions to `complete`, "Pick different" button transitions to `picking` (stub picker screen — next chunk).

**Estimate:** 2 sessions.

---

### Chunk P7 — Manual City Picker (with Text Input Arbitration)

- `src/screens/location/picker.ts` — grid of city cards
- Search-as-you-type filter using a vanilla `input` element + simple case-insensitive substring match
- **Text input + arrow key arbitration** — this is the execution of the pattern validated in P0:
  - Arrow keys within the input move the cursor normally (default browser behavior preserved)
  - `ArrowDown` from the input hands focus to the grid (first visible card)
  - `ArrowUp` from the first row of the grid returns focus to the input
  - `Escape` / `Back` button from the input exits the picker (transitions to `confirming` if there's a detected city, otherwise back to `detecting`)
  - `Enter` in the input commits the search; if exactly one result, it's auto-selected
- Grid is a focus zone via `data-focus-zone="picker-grid"`; each card is a focusable with `data-focus-id="city-<id>"`
- Selection commits via `LocationService.setSelectedLocation(city)` and transitions to `complete`
- Per-screen parity check on the fourth on-device test

**Unit tests:**
- Filter produces correct results for sample queries
- Reducer correctly handles `query_changed` and `picker_selection_changed`
- `city_selected` event commits via `LocationService`

**Manual on-device verification:**
- Type in the search field on Tizen 5.5 with a USB keyboard — characters appear
- Arrow keys inside the field move cursor, not grid
- `ArrowDown` from field focuses first grid card
- `ArrowUp` from top row returns to field
- `Escape` exits the picker
- No focus ghosting or stuck states

**Acceptance:** all automated tests pass; all on-device manual checks pass; selection persists across reload.

**Estimate:** 2 sessions. (If the text-input arbitration turns out harder than P0 suggested, this could stretch to 3 — flag if so.)

---

### Chunk P8 — Analytics Stub (Typed Logger, No BroadcastChannel)

- Typed event definitions for pilot events using a discriminated union:
  - `location_detection_started`
  - `location_detection_completed`
  - `location_manually_selected`
  - `location_changed`
- All events namespaced with `v2_` prefix for future clarity even though there's no current Firebase crosstalk concern
- Events log to `console.log` with a consistent `[v2-analytics]` prefix
- **No `BroadcastChannel`.** (v1 had this; removed in v2.)
- Firebase wiring is deferred to the P10 decision gate — if the pilot proceeds, Firebase integration becomes a follow-up PRD

**Acceptance:** navigating through the pilot fires structured events visible in the dev console; events are typed (adding a new event without updating the discriminated union is a compile error).

**Estimate:** 1 session.

---

### Chunk P9 — Production Deploy + On-Device Final Test

- The `/v2/` sub-path deploy workflow from P1 is already live; this chunk is the first *real* production deploy (vs. earlier preview builds)
- **Guided deploy walkthrough** (first real Vite production deploy):
  1. How Vite env vars flow through GitHub Actions into `dist/` via `VITE_*` variables
  2. Inspecting the built `dist/` — hash filenames, sourcemap behavior, CSS/JS/font bundle sizes
  3. How to roll back (revert merge or redeploy previous commit)
  4. How to add new build-time secrets
- **Performance measurements captured:**
  - JS gzipped bundle size
  - CSS gzipped bundle size
  - Font payload (the Roboto woff2 subset)
  - First render time on Tizen 5.5
  - First render time on VIZIO 2019
  - Memory footprint if measurable
- **Soft performance targets** (exceeding any is a flag, not an automatic fail):
  - JS gzipped: ≤ 200 KB
  - CSS gzipped: ≤ 50 KB
  - Font payload: ≤ 50 KB
  - Combined initial payload gzipped: ≤ 300 KB
  - Tizen 5.5 first render: ≤ 1500 ms
- Final on-device test on the full target matrix (Tizen 5.5, VIZIO 2019, Shield/Google TV)

**Acceptance:** `/v2/` loads on all three target devices; all automated tests pass; measurements recorded in `pilot-results.md`; any soft-target misses are documented with a root-cause note (not necessarily fixed).

**Estimate:** 1 session.

---

### Chunk P10 — Decision Gate

Not a code chunk. A **write-up chunk**.

Produce `docs/PRD/phase3-experience-completion/pilot-results.md` containing:

- **Device compatibility matrix** — what worked on what, including the new v2 interaction cases (font, text input, back button)
- **Actual session count vs the 12–15 estimate** — be honest about overruns
- **Development friction notes** — what was faster/slower than Phase 1 vanilla JS
- **Performance observations** — bundle sizes (JS/CSS/font separately), first-render time, memory footprint, any soft-target misses
- **Claude Code assistance quality** — subjective but important: did TS + types actually make Claude Code more helpful, or was it the same?
- **Focus adapter evaluation** — did the adapter pattern pay off? Would you reach for it again, or would you eventually want to refactor the underlying engine?
- **The decision:** one of three outcomes (see Section 7), with written rationale

**Acceptance:** document committed, decision recorded, next steps defined (next PRD drafted if outcome A or B; revert/pause plan defined if outcome C).

**Estimate:** 1 session.

---

### Pilot Total

| Chunk | Name | Sessions |
|---|---|---|
| P0 | Device compat spike (real) | 1–2 |
| P1 | Self-contained scaffold + CI gate | 1–2 |
| P2 | Schemas + inferred types | 1 |
| P3 | LocationService (moved earlier) | 1 |
| P4 | Focus engine port + controller adapter | 1–2 |
| P5 | Tokens + global styles + font verification | 1 |
| P6 | Detection + confirmation (with state machine) | 2 |
| P7 | Picker (with text input arbitration) | 2 |
| P8 | Analytics stub (typed logger) | 1 |
| P9 | Deploy + on-device final test | 1 |
| P10 | Decision gate writeup | 1 |
| **Total** | | **12–15** |

If the total reaches 20, stop and reassess rather than pushing through.

---

## 7. Decision Outcomes After the Pilot

Three legitimate outcomes, unchanged from v1:

**A. Pilot ships successfully, new stack validated.**
→ Continue Phase 3 in the new stack. Draft separate PRDs for Search, Auth, and other Phase 3 features. Phase 1 migration becomes an *optional follow-up*, scheduled only if ROI makes sense after Phase 3 is complete.

**B. Pilot ships with recoverable issues.**
→ Document the issues, fix them, decide case-by-case whether each issue justifies stack changes or workarounds. Proceed with caution. May add a `PRD-v2.1` amendment with lessons learned.

**C. Pilot doesn't work on target hardware or uncovers a dealbreaker.**
→ Abandon the new stack. Either build Phase 3 in vanilla JS alongside Phase 1, or pause Phase 3 and revisit later. Cost: ~12–15 sessions, which is recoverable.

---

## 8. Abandonment Criteria

The pilot is paused or cancelled if any of the following are true:

- P0 fails on the Tizen 5.5 baseline with no clear fix.
- **Font loading fails on-device** and no reasonable workaround (subsetting, different font source, system font fallback) resolves it.
- **Text input + arrow key arbitration proves unsolvable** on Tizen 5.5 — this would make search, auth, and most Phase 3 features impossible regardless of toolchain.
- Cumulative session count passes **20** (the 15-session ceiling + 33% buffer) without reaching P9.
- A feature is discovered in P3–P8 that requires a toolchain feature the target devices don't support, and the workaround invalidates more than one prior chunk.
- Stakeholder pressure for new user-facing features on Phase 1 becomes severe enough that Phase 1 can no longer be frozen.

Abandonment is **not failure** — it's the controlled outcome the strategy was designed to allow.

---

## 9. Risks

1. **P0 doesn't exercise a feature that breaks later.** *Mitigation:* v2 adds three new interaction test cases (font loading, text input arbitration, back button handling) that address the real risk surface. If something breaks *later* that P0 didn't test, we add it to P0's spec before the next migration attempt.
2. **Font loading quirks on-device.** *Mitigation:* explicitly tested in P0 and re-verified in P5. Fallback plan: ship with a system font and treat Roboto as progressive enhancement.
3. **Text input + arrow key arbitration fails on Tizen 5.5.** *Mitigation:* explicitly tested in P0; if it fails, pilot is paused (per abandonment criteria) because this interaction pattern is fundamental to Search and Auth.
4. **Focus adapter abstraction is leaky.** *Mitigation:* adapter is minimal and documented; unit tests cover the contract. If the adapter proves too limiting during P7, extend it (don't refactor the underlying engine).
5. **LocationFlow state machine gets too complex.** *Mitigation:* four states is the ceiling for the pilot. If a new state is needed mid-pilot, that's a signal the pilot scope is growing — flag and reassess.
6. **Self-contained `streaming-prototype-v2/` drifts out of sync with root tooling.** *Mitigation:* this is a feature, not a bug. The two projects have independent lockfiles and CI gates on purpose. Cross-project coordination happens at the PRD level, not the tooling level.
7. **Cumulative sessions exceed 15.** *Mitigation:* 20-session abandonment criterion.
8. **Phase 1 hotfix touches a file that affects pilot-shared behavior.** *Mitigation:* the only shared surface is `focus-engine.ts`, which is a literal port. If a Phase 1 hotfix changes focus engine behavior, it gets ported to the pilot the same day as a new chunk.
9. **Stakeholder pressure breaks the Phase 1 "frozen" assumption.** *Soft mitigation:* the pilot is explicit about being a new feature, so it can itself be pitched as stakeholder-visible progress.
10. **Source maps leaking source tree on public Pages.** *Mitigation:* sourcemaps controlled via `VITE_SOURCEMAP` env flag; default off for production, on for preview deploys.
11. **Bundle size creeps (CSS specifically).** *Mitigation:* P9 measures JS, CSS, and fonts separately. Tailwind creep shows up in CSS first; a combined target would miss it.
12. **Tailwind v3 vs v4 reopened during pilot.** *Mitigation:* explicitly locked in Non-Goals. Attempting to re-litigate during the pilot is a scope violation.

---

## 10. Open Questions

1. ~~**What's the oldest TV device accessible for P0 testing?**~~ **RESOLVED.** See `docs/SUPPORTED_DEVICES.md`.
2. ~~**Preview deploy target?**~~ **RESOLVED in v2.** `/v2/` sub-path on the existing Pages site.
3. ~~**Does `streaming-prototype-v2/` share any Phase 1 assets?**~~ **RESOLVED.** No. Self-contained.
4. ~~**Should this PRD also plan Search and Auth?**~~ **RESOLVED.** No. Separate PRDs post-decision-gate.
5. **What's the exact deploy sub-path — `/v2/`, `/pilot/`, `/phase3/`?** Recommendation: `/v2/` for brevity. Decided in P1 unless there's a reason otherwise.
6. **Should Phase 1 get a link to `/v2/` for facilitator access during user research?** Out of pilot scope; revisit at the decision gate.

---

## 11. Related PRDs

- `docs/PRD/jsdoc-typecheck-hedge/PRD-v2.md` — parallel type-safety hedge for Phase 1. Shipped. The pilot's schema and testing patterns deliberately align with the hedge v2 — see Section 12 for the alignment notes.
- `docs/PRD/phase3-scenarios-and-simulation-v1.0.md` — the **old** Phase 3 PRD (scenario presets + device simulation). Superseded by this document.
- `docs/PRD/vite-ts-tailwind-migration/PRD-v1.md` — the rejected full-migration PRD. Kept as reference.

---

## 12. Cross-PRD Pattern Alignment with the JSDoc Hedge

This pilot and the `jsdoc-typecheck-hedge` PRD share patterns by design but live in different module systems and do not share code. Worth being explicit about this because the divergence is a deliberate architectural choice, not an oversight.

**What's shared (patterns):**

- **Zod is the source of truth for data shapes** in both PRDs. Types are derived via `z.infer<typeof Schema>` rather than dual-maintained alongside JSDoc/TypeScript declarations.
- **Two-layer testing** — positive smoke tests (real data validates against schemas) catch wiring errors, negative fixture tests (intentionally broken JSON) catch schemas that are too permissive.
- **Validation at the loader boundary** — JSON is validated where it's actually fetched, not centralized in a single init function.

**What's NOT shared (code):**

- The hedge's schemas live in `streaming-prototype/js/schemas/` and use **CommonJS** (`module.exports` / `require`). This is a deliberate choice in the hedge's v2 to avoid forcing `"type": "module"` on the existing `package.json` and breaking the existing Jest setup.
- The pilot's schemas live in `streaming-prototype-v2/src/schemas/` and use **ESM TypeScript** (`export const`, `import { ... }`). Vite and Vitest use ESM natively.
- The two codebases are sibling folders in the same repo but are otherwise independent. They do not import from each other. This is reinforced by the self-contained workspace boundary from Section 4.

**Why this is fine for now:**

The pilot's location schemas (`CitySchema`, `LocationStateSchema`) describe *new* data shapes that don't exist in Phase 1. There is nothing to share, so the duplication cost is zero.

**When this could become a real concern:**

If a future Phase 3 feature needs to consume Phase 1's data shapes directly — for example, if **Search** needs to query the Phase 1 `catalog.json` and present `Show` results — then the `Show` schema would exist in two forms, and a coordination problem appears. The right move at that point is **Stance B** from the architectural review:

> Wrap the CommonJS hedge schemas in a thin ESM adapter that re-exports them as named exports. The adapter lives in `streaming-prototype-v2/src/schemas/legacy/` and is the only place where cross-codebase imports happen. The hedge schemas remain the source of truth; the adapter just bridges the module systems.

**Do not pre-build this adapter.** Wait until a Phase 3 feature actually needs it.

---

## 13. File Location

```
docs/PRD/phase3-experience-completion/
├── PRD-v1.md                    ← initial draft (kept as record)
├── PRD-v2.md                    ← this file (post second external review)
├── device-compat-results.md     ← Chunk P0 deliverable (TBD)
├── pilot-results.md             ← Chunk P10 deliverable (TBD)
└── progress.md                  ← running log of chunk completion (TBD)
```
