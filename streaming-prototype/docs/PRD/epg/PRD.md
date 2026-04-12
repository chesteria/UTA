# PRD — EPG (Electronic Program Guide)
**Version:** 1  
**Feature slug:** `epg`  
**Branch:** `epg-initial`  
**Phase:** 3 — Live Experience  
**Status:** Draft — pending Stage 2 review

---

## 1. Summary

The EPG screen is the Live destination of the UTA streaming prototype. It is a vertically stacked grid of channels, grouped by genre, where each channel row contains a horizontally scrollable time grid of program tiles covering the next 24 hours. A persistent genre rail anchored above the channel grid tracks the user's vertical position and allows genre-jump navigation. A more-info overlay surfaces channel and program details on demand. The screen is accessible from the top nav "Live" pill, connects back to the For You lander, and registers as a first-class screen in the App router. All content is hand-authored mock data — no real playback, no authentication, no persistence. The EPG is the primary driver of live-content UX research in this prototype.

---

## 2. Goals & Non-Goals

### Goals

- Deliver a fully navigable channel grid with genre grouping, independent per-row scrolling, and a reacting genre rail anchor.
- Wire For You ↔ Live navigation in the existing top nav.
- Provide debug.html controls for genre naming, genre order, channel-to-genre association, and channel metadata editing.
- Instrument every interactive element with analytics events that include `participant_code` and `session_id`.
- Meet all P0 acceptance criteria defined in § 14.

### Non-Goals (verbatim from intake out-of-scope list)

- Hooking the player up. Selecting a channel does not lead to playback for this release.
- The Picture in Picture player and any depicted focus states with this feature.
- Anything authentication related. Favoriting from the more info panel, etc.
- Configuring anything that would necessitate storage. IE — uploading a new channel icon.
- Any navigation element other than the For You lander is static.

### Additional Hard Stops (from CC-BRIEF)

- No loading skeletons, empty state, or mobile variant.
- No now-line indicator.
- No Local Now branding of any kind.
- No leftward navigation past the currently-playing tile.
- No past programs.

---

## 3. User Stories

> Framed as participant scenarios. All participants use a P-XXXX code assigned at session start.

**P-XXXX browses the live guide:**  
A participant on the For You lander presses right in the top nav to reach "Live" and presses OK. The EPG screen mounts. Focus lands on the currently-playing tile of the first channel in the first genre group. The participant uses the d-pad to explore the grid, scrubbing right to see upcoming programs and pressing down to move between channels.

**P-XXXX discovers a program in a different genre:**  
The participant presses up from the channel grid to reach the genre rail. They scrub right through genre chips and select "Comedy." The grid scrolls to the first Comedy channel. The participant explores that genre's content.

**P-XXXX checks channel info:**  
The participant presses left from the currently-playing tile of a channel to land on the channel logo cell. They press OK. The more-info overlay opens, showing the currently-playing program with a progress bar and remaining duration, and a "Watch Live" CTA. The participant presses Back — the overlay closes and focus returns to the channel logo cell.

**P-XXXX checks a future program:**  
The participant scrubs right several tiles to a future program and presses left to the channel logo. The more-info overlay opens in the future variant, showing a scheduled window ("9:00–9:30p") and a "Watch Channel" CTA instead of a progress bar. Pressing OK on the CTA fires an analytics event only — no playback occurs.

**P-XXXX leaves the EPG:**  
From anywhere in the channel grid or genre rail, the participant presses Back. Focus jumps to the top nav, landing on the "Live" pill. The participant navigates left to "For You" and presses OK. The For You lander loads.

---

## 4. Information Architecture

### Data Model

```
Genre
  id: string                  // e.g. "news"
  label: string               // e.g. "News"
  order: number               // sort order; configurable
  channelIds: string[]        // ordered list of channel IDs in this genre

Channel
  id: string                  // e.g. "ch-001"
  name: string                // display name, e.g. "The Correspondent"
  logoPlaceholder: string     // CSS color or initials string — no real logos
  genreIds: string[]          // all genres this channel belongs to

Program
  id: string
  channelId: string
  title: string
  description: string
  rating: string              // e.g. "PG", "TV-14"
  startTime: number           // Unix ms timestamp
  endTime: number             // Unix ms timestamp
```

### Multi-Genre Channel Rule

A channel record exists **once** in the data. A channel's `genreIds` array lists every genre it belongs to. When the grid renders, each genre group queries `Genre.channelIds` to get its channel list. If a channel appears in two genre arrays, **two separate row instances** are rendered — each with its own independent scroll/focus state, keyed by `${channelId}:${genreId}`.

### Time Boundary Rules

- Programs start from "now" (screen mount time, snapped to the current minute).
- The guide covers `now` through `now + 24 hours`.
- The first tile in every row is the currently-playing program. Its left boundary is always "now," regardless of when that program actually started.
- There is no leftward navigation past the currently-playing tile. Pressing left from the currently-playing tile moves focus to the channel logo cell.
- There is no rightward navigation past the last program in the 24-hour window.

### Row Instance State

Each rendered row carries its own state record:
```
RowState
  channelId: string
  genreId: string
  instanceKey: string       // "${channelId}:${genreId}"
  focusedTileIndex: number  // 0 = currently-playing tile
  scrollOffsetPx: number
```

Row instances are not shared. Two instances of the same channel in different genres maintain completely separate state.

---

## 5. Screen Spec

### Layout (1920×1080, TV viewport)

```
┌─────────────────────────────────────────────────────────────┐
│  TOP NAV (60px)   [Search] [For You] [Live●] [Movies]…      │
├─────────────────────────────────────────────────────────────┤
│  GENRE RAIL (72px)  [News] [Comedy] [Sports] [Drama]…       │
├──────────┬──────────────────────────────────────────────────┤
│ LOGO     │  TILE  │  TILE  │  TILE  │  TILE  │  TILE  │    │
│ CELL     ├──────────────────────────────────────────────────┤
│ (fixed)  │  TILE  │  TILE  │  TILE  │  TILE  │  TILE  │    │
│          ├──────────────────────────────────────────────────┤
│          │  TILE  │  TILE  │  TILE  │  TILE  │  TILE  │    │
│          ├──────────────────────────────────────────────────┤
│  GENRE GROUP HEADER — "Comedy"                              │
│          ├──────────────────────────────────────────────────┤
│          │  TILE  │  TILE  │  TILE  │  TILE  │  TILE  │    │
└──────────┴──────────────────────────────────────────────────┘
```

**Top Nav** — 60px fixed at top. Identical markup to the lander nav (shared `buildNav()` helper). The "Live" pill carries `.active` class when the EPG screen is mounted.

**Genre Rail** — 72px horizontal chip strip pinned below the top nav. Horizontally scrollable. Wraps at both ends. Chips auto-highlight as the user's grid focus enters a new genre group.

**Channel Grid** — fills remaining vertical space. Vertically scrollable via CSS transform (mirrors lander scroll pattern). Contains a vertical stack of genre groups.

**Genre Group** — non-focusable header label + N channel rows. No border or visual separator beyond the label itself.

**Channel Row** — fixed-height (88px). Left column: logo cell (120px fixed, does not scroll). Right column: tile track (horizontally scrollable, overflow hidden).

**More-Info Overlay** — full-screen dimmed overlay (`rgba(0,0,0,0.75)`) with a centered panel. Not a route — renders over the EPG screen without unmounting it.

---

## 6. Component Spec

### Program Tile

**Single component, two render modes.**

| Property | Currently-Playing Mode | Future Mode |
|---|---|---|
| Time string | Remaining time: `"33m left"` or `"1h 12m left"` | Scheduled window: `"9:00–9:30p"` |
| Watching indicator | Slot present (P1 — renders if channel is "currently watched") | Absent |
| Progress bar | None on tile (progress bar lives in more-info overlay only) | None |
| Rating chip | Static PG/TV-14 chip, bottom-right corner | Same |

**States:**
- `default` — base tile, no focus
- `focus` — white border glow (`--focus-box-shadow`), scale(1.03)

**Tile width:** Fixed. Identical regardless of program duration. Value: `240px`. Gap: `8px`.

---

### Channel Logo Cell

Fixed left column. Does not scroll.

**Contents:**
- Channel logo area: placeholder (colored square + initials, no real logos)
- Channel name label below logo area
- Decorative heart icon (static, no interaction, no toggle)

**States:**
- `default` — base cell
- `focus` — white border glow, identical to tile focus treatment

**Interaction:** OK on focused logo cell → opens more-info overlay. No other interaction.

---

### Channel Row

Wraps one logo cell + one horizontally scrollable tile track.

**States:**
- `default` — at rest, currently-playing tile is leftmost visible tile
- `scrubbed` — tile track is translated left; currently-playing tile is off-screen left
- `returning-to-now` — CSS transition (`transform 250ms ease-out`) animating tile track back to `translateX(0)`

**Boundary enforcement:**
- Left boundary: focus cannot move left of tile index 0 (currently-playing). Pressing left from index 0 moves focus to the logo cell.
- Right boundary: focus cannot move right of the last program tile within the 24-hour window.

**Return-to-now trigger:** Fires when the row loses focus (user navigates up or down out of the row). The tile track animates back to `translateX(0)` via CSS transition. Analytics event `epg_row_returned_to_now` fires at the start of the animation.

---

### Genre Group Header

Non-focusable. Visual grouping label only. Renders above the first channel row of each genre group. Text: genre label (e.g., "News"). No click/select behavior.

---

### Channel Grid Container

Vertical stack of genre groups. Scrolls vertically via `transform: translateY()` (mirrors lander pattern). Does not use `overflow: auto` — scroll is managed by JS to keep performance consistent with the existing lander approach.

---

### Genre Chip

**States:**
- `default` — inactive chip
- `focus` — d-pad focus highlight (white border glow)
- `active` — anchor-reacted highlight; chip corresponding to the genre group the grid is currently focused in. Updated automatically, debounced ~50ms.
- `selected` — user pressed OK on this chip (momentary state; resolves to `active`)

Chips are horizontally scrollable within the genre rail. Rail scrolls to keep the focused/active chip visible.

---

### Genre Rail

Horizontal chip strip. Wraps: right from last chip → first chip; left from first chip → last chip.

**Anchor reaction:** When grid focus enters a new genre group, the corresponding chip gains the `active` class. Debounced ~50ms to prevent thrashing during fast vertical scrolling.

**Genre selection:** Pressing OK on a focused chip scrolls the channel grid to the first channel row of that genre (using the same `translateY` approach as the lander's scroll).

---

### More-Info Overlay

Full-screen overlay. Two variants.

**Currently-Playing variant:**
- Channel logo placeholder
- Channel name
- Program title
- Program description
- Rating chip
- Progress bar (visual only — shows approximate elapsed/remaining)
- Remaining time string (`"33m left"`)
- CTA: "Watch Live" (no-op; fires `epg_more_info_cta_activated`)

**Future variant:**
- Channel logo placeholder
- Channel name
- Program title
- Program description
- Rating chip
- Scheduled window string (`"9:00–9:30p"`)
- CTA: "Watch Channel" (no-op; fires `epg_more_info_cta_activated`)

**Which variant opens:** Determined by which tile's row is focused when the logo cell is selected.
- If the channel row's `focusedTileIndex === 0` → currently-playing variant.
- If `focusedTileIndex > 0` → future variant. The overlay displays details for the tile at `focusedTileIndex`.

**Closing:** Back or Escape closes the overlay. Focus returns to the channel logo cell that opened it. Analytics event `epg_more_info_closed` fires.

**Focus trap:** While the overlay is open, all d-pad directions (UP, DOWN, LEFT, RIGHT) are no-ops. The overlay has exactly one focusable element per variant (the CTA button). Only Back/Escape dismisses the overlay. The dimmed grid and genre rail behind the overlay do not receive focus or input.

**Row state on overlay close:** The channel row that triggered the overlay retains its scroll position (scrubbed or at-now). The return-to-now animation does not fire on overlay close — it fires only when the user navigates away from the row entirely.

**Dimming:** The EPG screen behind the overlay receives class `epg-overlay-open`, which applies `opacity: 0.4` to the grid and genre rail (not the top nav).

---

### EPG Screen Container

Root screen element. ID: `epg`. Registered with `App.registerScreen()`.

**States:**
- `default` — grid and rail fully visible
- `overlay-open` — grid and rail dimmed; overlay rendered on top

---

### Top Nav Live Pill

The "Live" tab in `buildNav()` already exists at `data-nav-tab="live"`. On EPG screen mount, this tab receives the `.active` class (and the For You tab loses it). On EPG screen blur/destroy, the active class is managed by the nav logic in the departing screen.

---

## 7. Navigation & Focus Map

### Focus Zones (top to bottom)

```
Zone 0: Top Nav
Zone 1: Genre Rail
Zone 2: Channel Grid (vertical stack of rows)
  Zone 2a: Channel Logo Cell (per row)
  Zone 2b: Tile Track (per row, horizontal)
Zone 3: More-Info Overlay (modal — captures all input when open)
```

### All D-Pad Transitions

| From | Direction | To | Notes |
|---|---|---|---|
| Top Nav | DOWN | Genre Rail (chip 0 or last-focused chip) | Standard entry |
| Top Nav | LEFT/RIGHT | Adjacent nav tab | Existing lander behavior |
| Top Nav | OK on "For You" | For You lander | `App.navigate('lander')` |
| Genre Rail | UP | Top Nav (Live pill focused) | Nav `currentIdx` set to Live tab index |
| Genre Rail | DOWN | Channel Grid (last-focused row, currently-playing tile) | Row index is remembered; tile index is always 0 (row has already returned to now). On first entry, defaults to the first channel row. |
| Genre Rail | LEFT | Previous chip; wraps from first → last | `wrapAround: true` |
| Genre Rail | RIGHT | Next chip; wraps from last → first | `wrapAround: true` |
| Genre Rail | OK | Scroll grid to first channel of selected genre | Chip gains `selected` then `active` class |
| Channel Grid (any tile) | UP from top row | Genre Rail | `up` from the first genre group's first row |
| Channel Grid (any tile) | UP from non-top row | Previous channel row (logo cell or tile track, matching prior column) | Standard vertical movement |
| Channel Grid (any tile) | DOWN | Next channel row | Standard vertical movement |
| Channel Grid (any tile) | DOWN from last row | No-op | Boundary |
| Tile Track | LEFT from tile index 0 | Channel Logo Cell (same row) | Leftmost tile only |
| Tile Track | LEFT from tile index > 0 | Previous tile in same row | Standard |
| Tile Track | RIGHT | Next tile; no-op at 24h boundary | |
| Channel Logo Cell | RIGHT | Currently-playing tile (tile index 0) | |
| Channel Logo Cell | OK | Open More-Info overlay | Variant determined by row's focusedTileIndex |
| More-Info Overlay | BACK / Escape | Close overlay; focus → Channel Logo Cell | `epg_more_info_closed` fires |
| More-Info Overlay | UP / DOWN / LEFT / RIGHT | No-op | Focus trap — overlay has one focusable element |
| More-Info Overlay | OK on CTA | No-op; fire `epg_more_info_cta_activated` | |
| Anywhere in Grid or Rail | BACK | Focus → Top Nav (Live pill) | Does NOT navigate away from EPG screen |
| Top Nav (non-Live/ForYou tab) | OK | Show toast; no navigation | Search, Movies, Shows, Settings, Location are static on EPG — consistent with lander behavior |

### Return-to-Now Behaviour on Row Blur

When focus leaves a channel row (up or down), the tile track for that row:
1. Fires `epg_row_returned_to_now` analytics event (with `final_offset_before_reset`).
2. Applies CSS class `row-returning` which triggers `transform: translateX(0)` transition (`250ms ease-out`).
3. Resets `focusedTileIndex` to `0` after the transition completes.

The row the user is *entering* receives focus immediately — the animation on the departing row runs concurrently and does not block input.

### Screen Entry (For You → Live)

In the lander's `buildNavZone` `select()` function, when the "Live" tab is selected, `App.navigate('epg')` is called instead of showing a toast. The EPG screen's `onFocus()` fires, setting `FocusEngine.setHandler()` to the EPG key handler. Initial focus: first channel row, currently-playing tile (tile index 0).

### Screen Exit (Live → For You)

From the top nav (after BACK from grid/rail or direct nav tab press), selecting "For You" calls `App.navigate('lander')`. The EPG screen's `onBlur()` fires, clearing the focus handler. `epg_screen_exited` fires with `dwell_ms` and `exit_destination: 'lander'`.

---

## 8. More-Info Panel Variants — Field Reference

### Variant A: Currently-Playing

| Field | Source | Notes |
|---|---|---|
| Channel logo | `channel.logoPlaceholder` | Colored square + initials |
| Channel name | `channel.name` | |
| Program title | `program.title` | Currently-playing program |
| Description | `program.description` | Max 2 lines, ellipsis overflow |
| Rating chip | `program.rating` | e.g., "TV-14" |
| Progress bar | Computed from `program.startTime`, `program.endTime`, `Date.now()` | Visual only |
| Remaining time | `endTime - now` formatted | e.g., "33m left", "1h 12m left" |
| CTA label | "Watch Live" | No-op; fires `epg_more_info_cta_activated` |
| CTA focus | Default focus on open | |

### Variant B: Future Program

| Field | Source | Notes |
|---|---|---|
| Channel logo | `channel.logoPlaceholder` | |
| Channel name | `channel.name` | |
| Program title | `program.title` | Program at `focusedTileIndex` |
| Description | `program.description` | |
| Rating chip | `program.rating` | |
| Scheduled window | Formatted `startTime`–`endTime` | e.g., "9:00–9:30p" |
| CTA label | "Watch Channel" | No-op |
| CTA focus | Default focus on open | |

---

## 9. Tile Content Rules

### Currently-Playing Tile

- **Time string format:** remaining time until program ends.
  - `< 1 hour`: `"Xm left"` (e.g., `"33m left"`)
  - `≥ 1 hour`: `"Xh Ym left"` (e.g., `"1h 12m left"`)
- **Watching indicator slot:** Present in DOM. Renders a small colored dot + "Watching" label if the channel is flagged as `currentlyWatching: true` in mock data (P1 feature).
- **Left navigation:** Focus moves to channel logo cell.

### Future Program Tile

- **Time string format:** scheduled window.
  - Same-hour programs: `"9:00–9:30a"` or `"9:00–9:30p"`
  - Cross-hour: `"9:45a–10:15a"` — both times shown with AM/PM suffix
  - Midnight crossing: `"11:30p–12:15a"`
- **No watching indicator.**
- **Left navigation:** Previous tile, or if at index 0 boundary (impossible — index 0 is always the currently-playing tile), channel logo cell.

### Tile Width & Overflow

All tiles are `240px` wide regardless of program duration. Program title text truncates with ellipsis at one line. Description is absent from the tile (lives in the more-info overlay only).

---

## 10. Genre Rail Behavior

### Anchor Reaction (Auto-Highlight)

As the user moves focus vertically through the channel grid:
1. The EPG screen tracks which genre group the currently-focused row belongs to.
2. When the genre group changes (on vertical focus move), a debounced (~50ms) function updates the `active` class on the genre rail chip corresponding to the new genre.
3. The rail scrolls horizontally to ensure the active chip is visible (no transition — instant snap, or a very short `100ms` ease).
4. Analytics event `epg_genre_anchor_updated` fires.

### Genre Selection (Manual)

When the user navigates up to the genre rail and presses OK on a chip:
1. The chip gains `selected` class momentarily, then resolves to `active`.
2. The channel grid translates to bring the first channel row of that genre to the top of the visible grid area.
3. Focus moves down to the first channel row of that genre, landing on the currently-playing tile.
4. Analytics event `epg_genre_selected` fires.

### Wrapping

The genre rail uses `FocusEngine.createZone()` with `wrapAround: true`. Pressing right from the last chip focuses the first chip. Pressing left from the first chip focuses the last chip. The rail scrolls accordingly.

### Configurable Order

Genre order is determined by the `order` field on each genre object in `data/epg-mock.json`. The debug.html EPG section allows reordering. Changes take effect on next EPG screen mount (no live reload within the screen).

---

## 11. Mock Data Plan

**File:** `data/epg-mock.json`

### Shape

```json
{
  "genres": [ Genre, … ],
  "channels": [ Channel, … ],
  "programs": [ Program, … ]
}
```

Programs for each channel are generated at data-load time relative to `Date.now()` using the authored durations. The mock data file stores channels, genres, and program "slots" (title + duration + rating), not absolute timestamps — absolute times are computed at runtime.

### Scale

- **30+ channels**
- **8+ genres**
- At least **4 channels** appear in 2 or more genres (to cover the independent-instance AC)
- Each channel has **20–30 program slots** covering 24 hours

### Genres (8 minimum)

| ID | Label |
|---|---|
| `news` | News |
| `comedy` | Comedy |
| `sports` | Sports |
| `drama` | Drama |
| `reality` | Reality |
| `documentary` | Documentary |
| `kids` | Kids |
| `lifestyle` | Lifestyle |

### Tone

All program titles and descriptions are hand-authored, cheeky, and humorous. No real program names. Examples:

- "Who Left the Milk Out?" — A riveting 11-part investigation into the refrigerator.  
- "Competitive Napping League" — Season 3 premier. Returning champion Doris defends her title.  
- "That's Not How Taxes Work" — Talk show. Tonight: a very confident guest explains capital gains.  
- "The Weather, Probably" — A meteorologist guesses. Surprisingly accurate.

Channel names are invented and IP-free. Logos are placeholder colored squares with channel initials (no image files required).

### Multi-Genre Channel Examples

| Channel | Genres |
|---|---|
| "The Correspondent" | News, Documentary |
| "Laugh Factory 24" | Comedy, Reality |
| "Field & Court" | Sports, Lifestyle |
| "Deep Dive TV" | Documentary, Drama |

---

## 12. debug.html Additions

A new sidebar section "EPG Config" is added to `debug.html`. It follows the existing sidebar nav pattern (`dc-nav-item` + `dc-section`).

### EPG Config Section Controls

**Genre Management**

| Control | Function |
|---|---|
| Genre list with drag-to-reorder | Set `order` value for each genre |
| Inline name edit per genre | Rename any genre label |
| Enable/disable toggle per genre | Remove a genre from the rendered guide |

**Channel-to-Genre Association**

| Control | Function |
|---|---|
| Channel list with multi-select genre checkboxes | Assign/remove a channel from any genre |
| Changes persist to `localStorage` under `debug_epgGenreMap` | |

**Channel Metadata Editor**

| Control | Function |
|---|---|
| Table of all channels (inline-editable cells) | Edit channel name, currently-watching flag |
| Save button | Persists to `localStorage` under `debug_epgChannels` |

**Additional EPG Toggles (logical sweep)**

| Toggle | Default | Effect |
|---|---|---|
| Show genre headers | On | Hides genre group label rows |
| Show rating chips on tiles | On | Removes rating chip from program tiles |
| Return-to-now animation | On | Disables the 250ms ease-out; snaps instantly |
| Genre anchor debounce (ms) | 50 | Adjustable 0–500ms for observation |
| Row height | 88px | Adjustable 60–120px |
| Tile width | 240px | Adjustable 160–360px |

All debug values are read at EPG screen init. Changes take effect on next screen mount (consistent with existing debug pattern).

---

## 13. Analytics Events

All events use `Analytics.track(eventName, payload)`. The analytics module automatically adds `sessionId`, `participantId`, `deviceType`, `screen`, `config`, and `timestamp` to every event. The payload fields below are the **additional** fields specific to each event.

| Event name | Trigger | Payload fields |
|---|---|---|
| `epg_screen_entered` | EPG screen mounts (`init`) | `entry_source` (`'nav'` \| `'back'`) |
| `epg_screen_exited` | EPG screen blurs (`onBlur`) | `dwell_ms`, `exit_destination` |
| `epg_genre_chip_focused` | D-pad focus enters a genre chip | `genre_id`, `genre_index` |
| `epg_genre_selected` | OK pressed on a genre chip | `genre_id` |
| `epg_genre_anchor_updated` | Anchor auto-highlights chip on row-focus genre change | `genre_id`, `triggering_channel_id` |
| `epg_channel_row_focused` | Focus enters a channel row | `channel_id`, `genre_id`, `row_index` |
| `epg_program_tile_focused` | Focus enters a program tile | `channel_id`, `genre_id`, `program_id`, `tile_offset_from_now` |
| `epg_program_tile_scrubbed` | Right-arrow advances focus within a row | `channel_id`, `genre_id`, `new_tile_offset` |
| `epg_row_returned_to_now` | Row blur triggers return animation | `channel_id`, `genre_id`, `final_offset_before_reset` |
| `epg_channel_logo_focused` | Focus enters a channel logo cell | `channel_id`, `genre_id` |
| `epg_more_info_opened` | Channel logo cell selected (OK) | `channel_id`, `variant` (`'currently_playing'` \| `'future'`) |
| `epg_more_info_closed` | Back/Escape on more-info overlay | `channel_id`, `dwell_ms` |
| `epg_more_info_cta_activated` | Watch Live / Watch Channel CTA pressed | `channel_id`, `cta_type` (`'watch_live'` \| `'watch_channel'`) |
| `epg_back_to_nav` | Back pressed from grid or rail | `from_surface` (`'grid'` \| `'rail'`) |
| `epg_nav_to_live` | For You → Live transition fires — fired from the nav module (lander `buildNavZone` or extracted `js/utils/nav.js`) at the moment "Live" is selected, before the EPG screen mounts | _(no additional fields)_ |
| `epg_nav_from_live` | Live → For You transition fires — fired from the EPG screen's nav handler when "For You" is selected | _(no additional fields)_ |

**Implementation rule:** Each event is wired into the component *as it is built*, not in a final analytics pass. The final analytics audit in build step 13 is a verification pass, not the primary wiring.

---

## 14. Acceptance Criteria

Each AC is binary pass/fail. IDs are prefixed `EPG-AC`.

### Navigation & Focus

| ID | Criterion |
|---|---|
| EPG-AC-01 | Up from the top channel row in the grid moves focus to the genre rail |
| EPG-AC-02 | Up from the genre rail moves focus to the top nav; focus lands on the "Live" pill |
| EPG-AC-03 | Back button pressed from anywhere in the channel grid moves focus to the top nav (Live pill); EPG screen remains mounted |
| EPG-AC-04 | Back button pressed from the genre rail moves focus to the top nav (Live pill); EPG screen remains mounted |
| EPG-AC-05 | Left from the currently-playing tile (tile index 0) moves focus to the channel logo cell |
| EPG-AC-06 | Right from the channel logo cell moves focus to the currently-playing tile |
| EPG-AC-07 | Right-arrow at the last tile in the 24-hour window is a no-op (focus does not leave the grid) |
| EPG-AC-08 | There is no tile to the left of the currently-playing tile; left from that tile goes to the logo cell only |
| EPG-AC-09 | Down-arrow from the last channel row in the grid is a no-op |
| EPG-AC-10 | For You → Live navigation works: selecting the Live tab on the For You lander mounts the EPG screen |
| EPG-AC-11 | Live → For You navigation works: selecting the For You tab from the EPG top nav mounts the lander |

### Genre Rail

| ID | Criterion |
|---|---|
| EPG-AC-12 | Genre rail wraps: right-arrow from the last chip focuses the first chip |
| EPG-AC-13 | Genre rail wraps: left-arrow from the first chip focuses the last chip |
| EPG-AC-14 | Selecting a genre chip scrolls the channel grid to the first channel row of that genre |
| EPG-AC-15 | The genre rail anchor highlights the chip that corresponds to the genre group currently in focus — the correct chip is always active when navigating the grid. The highlight does not visibly lag behind d-pad navigation. |

### Channel Grid & Rows

| ID | Criterion |
|---|---|
| EPG-AC-16 | Channels render grouped by genre; a channel configured in 2 genres appears as a row in each genre group |
| EPG-AC-17 | At least 30 channel rows are present across all genre groups |
| EPG-AC-18 | At least 8 genres are present |
| EPG-AC-19 | Each channel row scrolls independently; scrubbing row A does not affect row B |
| EPG-AC-20 | Two instances of the same channel in different genres scroll independently of each other |
| EPG-AC-21 | When focus leaves a channel row, the tile track animates smoothly back to the currently-playing tile position with no stuck, skipped, or incomplete animation state |
| EPG-AC-22 | Initial focus on screen entry is the currently-playing tile of the first channel row |

### More-Info Overlay

| ID | Criterion |
|---|---|
| EPG-AC-23 | Pressing OK on the channel logo cell while the row is at tile index 0 opens the currently-playing overlay variant |
| EPG-AC-24 | Pressing OK on the channel logo cell while the row is at tile index > 0 opens the future overlay variant |
| EPG-AC-25 | The future variant displays the program at the row's current `focusedTileIndex`, not the currently-playing program |
| EPG-AC-26 | Pressing Back or Escape on the more-info overlay closes it and returns focus to the channel logo cell |
| EPG-AC-27 | "Watch Live" and "Watch Channel" CTAs are no-ops (no navigation, no playback) |

### Content & Brand

| ID | Criterion |
|---|---|
| EPG-AC-28 | No Local Now branding appears anywhere in the EPG screen or its assets |
| EPG-AC-29 | The guide shows only current and future programs; no past program tiles are accessible or rendered |
| EPG-AC-30 | The 24-hour forward limit is enforced; no tile exists beyond now + 24h |

### Debug

| ID | Criterion |
|---|---|
| EPG-AC-31 | Genre order is configurable from debug.html; changes are reflected on next EPG screen mount |
| EPG-AC-32 | Genre naming is configurable from debug.html |
| EPG-AC-33 | Channel-to-genre association is editable from debug.html |
| EPG-AC-34 | Channel metadata (name) is editable from debug.html |

### Analytics

| ID | Criterion |
|---|---|
| EPG-AC-35 | Every interactive element fires its analytics event exactly once per trigger (no duplicate events from bubbling) |
| EPG-AC-36 | Every EPG analytics event includes `participant_code` (via `Analytics.getParticipantId()`) and `session_id` (via `Analytics.sessionId`) |
| EPG-AC-37 | `epg_screen_entered` fires on EPG screen mount |
| EPG-AC-38 | `epg_screen_exited` fires on EPG screen blur with correct `dwell_ms` |

### Performance

| ID | Criterion |
|---|---|
| EPG-AC-39 | The EPG screen mounts and the full channel grid renders completely within 2 seconds. No jank or dropped frames are visible during initial render or while navigating vertically through the full grid, assessed via manual observation on a standard development machine. |

---

## 15. Open Questions

| #     | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Impact                                    | Answer                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| OQ-01 | When the more-info overlay closes after the user opened it from a mid-scrubbed row, does focus return to the logo cell with the row still in its scrubbed position, or does the row also reset to "now" on overlay close? The return-to-now animation is defined to fire on *row blur* — the overlay doesn't blur the row. **Recommendation:** Row stays at its scrubbed position when overlay closes; row resets only when the user actually leaves the row. Needs user confirmation. | Affects EPG-AC-21 and test plan edge case | Go with recommendation.                                                                       |
| OQ-02 | What is the vertical scroll behavior when the genre rail anchor auto-highlights a chip mid-scrub — does the grid also scroll, or does only the chip highlight update? **Recommendation:** Chip updates; grid does not scroll automatically during anchor reaction (only on explicit genre chip selection).                                                                                                                                                                             | Affects genre rail anchor implementation  | User must select genre "chip" before the grid reacts. Nothing is on focus, only on select.    |
| OQ-03 | The `buildNav()` function in `lander.js` is currently shared. For EPG, the same nav HTML is needed with "Live" as the active pill. Should EPG import/reuse `buildNav()` as-is (requires the function to be accessible outside lander.js scope), or should EPG define its own `buildNav()` copy? **Recommendation:** Extract `buildNav()` to a shared utility (e.g., `js/utils/nav.js`) so both screens reuse it. Needs user sign-off before touching lander.js.                        | Affects file touch list                   | Extract and use as a shared component. No need to rewrite code that exists and can be shared. |
| OQ-04 | The lander's `buildNavZone().select()` currently shows a toast for all nav tabs. For EPG nav wiring, the Live tab needs to call `App.navigate('epg')`. Is it acceptable to modify `lander.js` `buildNavZone` to add this navigation, or should the nav select handler be abstracted? **Recommendation:** Modify `lander.js` `buildNavZone` select() to handle the Live case. Minimal, targeted change.                                                                                 | Affects lander.js touch                   | Yes, please modify as needed to "complete the experience" within the app as a whole.          |

---

*PRD version: 2 — revised in Stage 3. Changes: focus trap + row-state-on-close added to More-Info Overlay spec; grid re-entry from genre rail clarified; non-implemented nav tab behavior specified; `epg_nav_to_live` firing location clarified; EPG-AC-15, EPG-AC-21, EPG-AC-39 rewritten for testability.*
