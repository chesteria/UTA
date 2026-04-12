# PRD-REVIEW.md — EPG (Electronic Program Guide)
**Stage:** 2 — Self-Review  
**Reviewing:** `PRD.md` v1 (post OQ answers)  
**Outcome:** Issues requiring PRD v2 revision before Stage 3

---

## Summary

The PRD is structurally sound and covers all P0 items from the intake. No P0 requirement is absent. The open questions have been answered and their resolutions are consistent with what is written. The issues below fall into four categories: ACs that need sharper testability language, two navigation gaps (overlay internals and re-entry from genre rail), one analytics gap (nav tab focus on EPG screen), and a minor component state gap in the more-info overlay. None are blockers for Stage 3 intent, but all must be resolved in v2 to prevent ambiguity during the build and test phases.

---

## 1. P0 Items — Coverage Check

All 23 P0 bullets from `EPG_INTAKE_V1.md` are reflected in the PRD. Coverage is complete.

| P0 Item | PRD Location | Status |
|---|---|---|
| No Local Now IP | §2 non-goals, EPG-AC-28 | ✓ |
| 24-hour forward guide | §4 time boundary, EPG-AC-30 | ✓ |
| One program per cell, fixed cell size | §9 tile content rules | ✓ |
| Channels grouped by genre | §5 screen spec, EPG-AC-16 | ✓ |
| Multi-genre channels | §4 IA, EPG-AC-16 | ✓ |
| Genre rail anchor reaction on downward focus | §10, EPG-AC-15 | ✓ |
| Genre chip selection scrolls to first channel | §10, EPG-AC-14 | ✓ |
| Genres configurable (name, order) | §12 debug, EPG-AC-31/32 | ✓ |
| No now-line, no past programs | §2 hard stops, EPG-AC-29 | ✓ |
| Left from currently-playing → logo cell; OK → more-info | §7, EPG-AC-05/23 | ✓ |
| Each row scrolls independently | §6 channel row, EPG-AC-19 | ✓ |
| Multi-genre stacked instances independent | §4 row instance state, EPG-AC-20 | ✓ |
| Row animates to now on blur | §6 channel row, EPG-AC-21 | ✓ |
| Cheeky/humorous hand-authored metadata | §11 mock data plan | ✓ |
| 30+ rows, 8+ genres | §11, EPG-AC-17/18 | ✓ |
| Navigate to Live from For You | §7 screen entry, EPG-AC-10 | ✓ |
| Navigate from Live to For You | §7 screen exit, EPG-AC-11 | ✓ |
| Up from top row → genre rail | §7, EPG-AC-01 | ✓ |
| Up from genre rail → nav (Live pill) | §7, EPG-AC-02 | ✓ |
| Back from grid or rail → top nav | §7, EPG-AC-03/04 | ✓ |
| Genre rail wraps right-to-first | §10, EPG-AC-12 | ✓ |
| Debug panel additions (logical sweep) | §12 | ✓ |

---

## 2. Acceptance Criteria — Testability Issues

### ISSUE-01 — EPG-AC-15: "within 100ms" is not independently verifiable in a manual test pass

**Current text:** "The genre rail anchor highlights the correct chip within 100ms of grid focus entering a new genre group."

**Problem:** 100ms is imperceptible in a manual d-pad test. There is no way for a human tester to observe whether it fires in 99ms vs. 101ms without DevTools instrumentation.

**Required fix for v2:** Restate as two separate testable conditions:
1. The correct chip is highlighted when focus is in a given genre group (correctness — manually verifiable).
2. The highlight does not visibly lag behind navigation (subjective observation standard — acceptable for prototype).

Drop the 100ms timing claim from the AC. The 50ms debounce lives in the implementation spec as a guideline, not a testable threshold.

---

### ISSUE-02 — EPG-AC-39: "without observable frame drops" is subjective

**Current text:** "30 rows × 8 genres render without observable frame drops on the lowest-tier device profile (desktop browser baseline for prototype)."

**Problem:** "Observable" is undefined. This AC will pass or fail inconsistently depending on the tester's machine.

**Required fix for v2:** Restate as: "The EPG screen mounts and the channel grid renders fully within 2 seconds on a desktop browser. No jank or dropped frames visible during initial render or during vertical scrolling through the full grid, assessed via manual observation on a standard development machine."

This is the correct prototype-fidelity standard — the performance baseline is human perception on a dev machine, not a device profile (there is no low-tier device in the build environment).

---

### ISSUE-03 — EPG-AC-21: "~250ms ease-out" uses an approximation symbol in a criterion

**Current text:** "the tile track animates back to the currently-playing tile via a CSS transition (~250ms ease-out)"

**Problem:** The `~` in an AC is a code smell — it signals the tester they don't need to verify the actual value. If the implementation uses 500ms, this AC still passes.

**Required fix for v2:** Remove the timing detail from the AC. The AC should test the *behavior* (animation occurs, reaches destination cleanly). The implementation detail (250ms ease-out) stays in §6 Component Spec only.

**Revised AC:** "When focus leaves a channel row, the tile track animates smoothly back to the currently-playing tile position with no stuck or incomplete state."

---

## 3. Components — Focus State Gaps

### ISSUE-04 — More-info overlay: no spec for UP/DOWN navigation within the panel

**Current state:** §6 More-Info Overlay defines the two variants and states that "Back/Escape closes" and "CTA default focus on open." It does not specify what UP, DOWN, LEFT, or RIGHT do while the overlay is open.

**Problem:** The overlay has at minimum one focusable element (the CTA button). If additional focusable elements exist in future variants (e.g., a secondary action), there is no defined behavior. More immediately: if the user presses UP or DOWN while the overlay is open, what happens? No-op? Scroll the dimmed content behind it? This is undefined.

**Required fix for v2:** Add a "Focus trap" clause to the More-Info Overlay spec: all d-pad directions other than BACK/Escape are no-ops when the overlay is open. The overlay has exactly one focusable element per variant (the CTA). Focus does not move within the overlay on UP/DOWN/LEFT/RIGHT — only Back/Escape dismisses it.

---

### ISSUE-05 — More-info overlay: no spec for what opens focus on — currently says "CTA focus — Default focus on open" but doesn't specify the focus element name

Minor — the overlay has only one CTA per variant, so it's unambiguous. No fix required; note for test plan authoring.

---

## 4. Analytics — Gaps

### ISSUE-06 — Nav tab navigation on the EPG screen is not instrumented

**Current state:** The analytics table in §13 covers screen entry/exit, genre rail, channel grid, more-info, and back-to-nav. It does not cover focus movement within the top nav while on the EPG screen.

**Context:** On the lander, nav tab focus changes are not tracked either — the lander simply doesn't emit a nav-focus event. However, on the EPG screen, the user can navigate in the top nav and select For You → triggers `epg_nav_from_live`. This is covered. But the intermediate focus movement (user lands on nav, presses left/right across tabs before selecting) is not tracked.

**Assessment:** This is a minor gap. The existing pattern across all screens is to track navigation (screen transitions), not intermediate nav tab focus changes. **No new event is required** — the existing pattern is intentional and consistent.

**Resolution:** No change needed. Flag for test plan: do not write a test asserting a nav-tab-focus event because none is specified.

---

### ISSUE-07 — `epg_nav_to_live` fires location is ambiguous

**Current text:** "`epg_nav_to_live` | For You → Live transition | (no additional fields)"

**Problem:** This event name implies it is an EPG event, but it fires *before* the EPG screen is mounted — it fires when the user selects "Live" from the For You lander's nav. It would be fired from `lander.js` (or the extracted nav utility), not from `epg-screen.js`. The event namespace `epg_` implies it lives in EPG module code.

**Required fix for v2:** Clarify that `epg_nav_to_live` is fired in the lander's nav select handler (or the shared nav utility) at the moment the "Live" tab is selected. `epg_screen_entered` then fires when the EPG module's `init()` runs. Both are needed; the firing location of `epg_nav_to_live` must be explicit.

---

## 5. Navigation Transitions — Gaps

### ISSUE-08 — Re-entry into grid from genre rail: "last-focused row" is underspecified

**Current text (§7):** "Genre Rail → DOWN → Channel Grid (first row, currently-playing tile) — Or last-focused row if returning."

**Problem:** "Last-focused row" is ambiguous:
- Does it restore the row *index* only (landing on the currently-playing tile of that row)?
- Or does it restore the row index *and* tile index (landing on the tile the user was on before going up)?

The return-to-now animation means the row's tile track has already animated back to `translateX(0)` when the user left the row upward. So restoring the tile index would put the user on the currently-playing tile regardless.

**Assessment:** The return-to-now animation resolves this — by the time the user navigates back down into the grid, the row has already reset. The correct behavior is: re-entry lands on the currently-playing tile of the last-focused row (row index restored, tile index always 0 after reset).

**Required fix for v2:** Remove the ambiguity from §7. State explicitly: "Re-entry from genre rail lands on the currently-playing tile (index 0) of the last-focused row. Row index is remembered; tile index is always 0 (row has already returned to now)."

---

### ISSUE-09 — Non-implemented nav tabs on EPG screen: behavior not specified

**Current state:** §7 specifies For You ↔ Live transitions but does not address what happens when the user focuses and selects Search, Movies, Shows, Settings, or the Location pill from the EPG screen's top nav.

**Context:** On the lander, `buildNavZone().select()` shows a `showToast()` for unimplemented tabs. Since the EPG will reuse or share the nav zone logic, this behavior will carry over. But it's not stated.

**Required fix for v2:** Add a note to §7 that all nav tabs other than For You and Live are static on the EPG screen — selecting them shows a toast (consistent with lander behavior) and does not navigate away. No new analytics event is fired for these taps.

---

## 6. Conflicts Between Sections

### No conflicts found.

The OQ answers are consistent with §7 and §10 as written:
- OQ-01 answer (row stays scrubbed on overlay close) is consistent with §6 channel row definition and EPG-AC-21 (which fires on row *blur*, not overlay open/close).
- OQ-02 answer (grid scroll only on explicit chip selection) is consistent with §10 "Genre Selection (Manual)" — the anchor reaction section does not mention grid scrolling.
- OQ-03/04 answers are implementation notes that don't affect PRD content.

---

## 7. Required v2 Changes — Summary

| Issue | Section to update | Change type |
|---|---|---|
| ISSUE-01 | §14 EPG-AC-15 | Rewrite AC — remove 100ms timing claim; split into correctness + lag observation |
| ISSUE-02 | §14 EPG-AC-39 | Rewrite AC — replace "observable frame drops" with concrete prototype-standard language |
| ISSUE-03 | §14 EPG-AC-21 | Rewrite AC — remove timing detail; test behavior not implementation |
| ISSUE-04 | §6 More-Info Overlay | Add focus trap clause — all d-pad no-ops except BACK/Escape while overlay is open |
| ISSUE-07 | §13 Analytics table | Clarify firing location of `epg_nav_to_live` — fired from nav module, not EPG screen module |
| ISSUE-08 | §7 Navigation map | Clarify grid re-entry from genre rail — row index restored, tile index always 0 |
| ISSUE-09 | §7 Navigation map | Add note: non-Live/ForYou nav tabs show toast on EPG screen; no navigation |

**No new sections required. No structural changes required. All issues are targeted edits.**

---

*Review version: 1 — Stage 2 output, EPG feature build*
