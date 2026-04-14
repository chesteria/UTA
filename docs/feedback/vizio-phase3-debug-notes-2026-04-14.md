# VIZIO Phase 3 Debug Notes

Date: 2026-04-14
Target: `streaming-prototype-v2/` preview on VIZIO developer-mode app container
Branch: `feature/phase3-pilot`

## Goal

Get the Phase 3 location pilot to boot and accept remote input on the VIZIO device runtime.

## What We Tried

### 1. Initial Pages preview setup

What changed:
- Added a dedicated v2 Pages workflow
- Switched the v2 app to a `/UTA/v2/` build base
- Registered the workflow on `main` so GitHub would recognize it

What worked:
- The Pages preview eventually deployed correctly
- `https://chesteria.github.io/UTA/v2/` became the correct preview URL

What failed:
- Before the base-path fix and Actions-based deploy, `/v2/` and `/UTA/v2/` were inconsistent and produced 404 confusion

### 2. Boot diagnostics

What changed:
- Added a static HTML boot panel
- Added `boot.js` as an external classic script
- Added module boot/fatal error reporting

What worked:
- The preview no longer failed as an unexplained black screen on every attempt
- We proved the page can boot on the VIZIO runtime

What failed:
- Inline and module-only diagnostics were not enough by themselves
- Some runtime errors still came from the platform environment rather than the app

### 3. Startup/performance trimming

What changed:
- Removed bundled Roboto loads
- Reduced simulated location delay from `2000ms` to `300ms`
- Removed extra animation-heavy classes from the main flow

What worked:
- CSS size dropped materially
- Font payload was removed from the preview build
- Startup got lighter

What failed:
- Performance improvements did not solve remote-input behavior

### 4. Focus visibility simplification

What changed:
- Replaced Tailwind ring/shadow/scale focus styling with blunt TV-safe focus visuals

What worked:
- Simplified the rendering path

What failed:
- Visibility alone was not the core issue
- Remote behavior still felt unreliable on device

### 5. VIZIO key mapping pass

What changed:
- Confirmed from the VIZIO keycode mapping doc that the important remote keys are standard:
  - left `37`
  - up `38`
  - right `39`
  - down `40`
  - select/enter `13`
  - backspace `8`
  - exit `27`
- Expanded the v2 key mapping to include doc-confirmed variants such as `Exit`

What worked:
- We confirmed the device is not using some exotic directional keycodes

What failed:
- Key mapping was not the main blocker

### 6. On-screen key logging

What changed:
- Added a bottom overlay to show key info
- Added capture-phase listeners
- Added keyCode/which fallback handling

What worked:
- The console showed the VIZIO app container is delivering standard keycodes:
  - right `39`
  - left `37`
  - down `40`
  - up `38`
  - back `8`
  - select `13`

What failed:
- On-device overlay feedback was not trustworthy enough by itself
- Behavior still felt delayed or dropped

### 7. Forced repaint on focus changes

What changed:
- Applied focus visuals directly in JS on focus/blur
- Forced repaint on each focus transition

What worked:
- Eliminated the earlier “one event behind” feel

What failed:
- Remote interaction still feels unreliable and often needs multiple presses

## Current Best Understanding

The VIZIO runtime is delivering normal remote keycodes, and the preview app is booting. The remaining issue does not look like a simple mapping error anymore.

The likely causes now are:
- dropped or throttled directional key events in the device app container
- inconsistent repeat behavior
- focus transitions happening, but not always in response to each individual keydown
- event timing differences between `keydown` and what the TV runtime considers actionable input

## What Has Worked

- GitHub Pages preview deployment for `/UTA/v2/`
- Booting the v2 app on VIZIO
- Console visibility into raw keycodes
- Removal of the “one event behind” repaint issue

## What Has Not Worked Yet

- Reliable one-press-per-move D-pad navigation on the VIZIO runtime
- Trustworthy on-device diagnostics from the minimal bottom overlay alone

## Best Next Step

Use the new rolling on-screen diagnostics panel to capture a short sequence such as:
- press `Right` once
- press `Right` three times
- press `Left` once
- press `OK`
- press `Back`

Then compare:
- raw key events
- mapped actions
- active focus zone / focused id transitions

If the panel shows every key but focus only moves intermittently, the next likely fix is a VIZIO-specific input path using `keyup` for directional movement instead of `keydown`.
