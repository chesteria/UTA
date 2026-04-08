# Bug Hunt — Versioning System
**Date:** 2026-04-08
**Branch:** `versioning-system`
**PRD:** `docs/PRD/foundation-versioning-v1.0.md`
**Scope:** All seven focus areas from the PRD bug hunt prompt

---

## Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 0     | 0     | 0         |
| HIGH     | 0     | 0     | 0         |
| MEDIUM   | 2     | 0     | 2         |
| LOW      | 3     | 0     | 3         |

No CRITICALs or HIGHs. System is functional and correct for all core
requirements. The two MEDIUMs are worth fixing before the next phase.

---

## MEDIUM

---

### M1 — `gitCommit` is always the parent commit's hash, not the current one

**File:** `scripts/bump-build-number.sh` (line 21), `data/version.json`

**What's happening:**
The pre-commit hook runs *before* the new commit is created. At that
point, `git rev-parse --short HEAD` returns the hash of whatever HEAD
was *before* this commit — i.e., the parent. The new commit's hash
isn't generated until after the hook exits.

**Confirmed:** Build 2 (the versioning system commit) has hash `f18c149`.
But `version.json` stores `gitCommit: "653f1da"` — which is its parent
(`pre-versioning-system snapshot`). Anyone trying to look up build 2 in
git history by its stored commit hash will land on the wrong commit.

**Impact:** `gitCommit` in the debug panel, console log, and analytics
events is one commit behind. Reduces the value of this field for
tracing build → commit.

**Proposed fix (option A — move to a post-commit hook):**
Create `.git/hooks/post-commit` that re-reads the just-created commit
hash and patches `version.json` in-place (no staging needed, since the
commit is already done). The post-commit hook can't affect the commit
itself, so the corrected hash would be visible in the *next* commit's
version.json, not the current one. Still one behind, but closer.

**Proposed fix (option B — accept and document):**
Rename `gitCommit` to `gitParentCommit` or add a comment in the README
explaining the off-by-one. Since this is an internal tool and the build
number itself is the precise identifier, the commit hash is supplementary
context. Document the limitation so no one is surprised.

**Recommended:** Option B. The off-by-one is an inherent limitation of
pre-commit hooks — solving it properly requires CI/CD infrastructure.
For an internal prototype, build number is the real identifier. Update
the README to clarify.

---

### M2 — `set-version.sh` doesn't update the `phase` field

**File:** `scripts/set-version.sh`

**What's happening:**
`set-version.sh` only updates `version` and `label`. The `phase` field
(e.g., "Phase 2") is not touched. When Phase 3 ships and you run:

```bash
./scripts/set-version.sh 2.0.0 "Scenario Presets"
```

`version.json` will read `phase: "Phase 2"` with `label: "Scenario
Presets"` — an inconsistent state. The debug panel and analytics events
will report the wrong phase indefinitely until someone manually edits
`version.json`.

**Impact:** `phase` in the debug panel and analytics events drifts
out of sync with the actual version when crossing phase boundaries.

**Proposed fix:**
Add an optional third argument to `set-version.sh`:

```bash
./scripts/set-version.sh 2.0.0 "Scenario Presets" "Phase 3"
```

If the argument is omitted, `phase` stays unchanged (correct for
MINOR/PATCH bumps within the same phase). Only required when crossing
a phase boundary. Update the README to document it.

---

## LOW

---

### L1 — Pre-commit hook doesn't propagate bump script failure

**File:** `.git/hooks/pre-commit`

**What's happening:**
The hook does not use `set -e` and does not check the exit code of
`bash "$SCRIPT"`. If `bump-build-number.sh` fails for any reason
(Node.js not installed, file permission issue, disk full, malformed
`version.json`), the hook exits 0 and git proceeds with the commit —
silently leaving the build number un-incremented.

The commit succeeds, but the build number is wrong. Next commit will
increment from the last *successful* bump, skipping a number — or two
builds end up with the same build number if the failure is consistent.

**Impact:** Low in practice — the script is unlikely to fail in a
normal development environment. But silent failure is the worst kind.

**Proposed fix:**
Add exit code propagation to the hook:

```bash
if [ -f "$SCRIPT" ]; then
  bash "$SCRIPT" || { echo "[pre-commit] Build bump failed — commit aborted"; exit 1; }
fi
```

This makes the failure visible (commit aborts) rather than silent.
Alternatively, replace `exit 1` with a warning-only approach if
blocking commits is too aggressive for the workflow.

---

### L2 — Static meta tag values in `index.html` are immediately stale

**File:** `index.html` (lines 5–6)

**What's happening:**
```html
<meta name="app-version" content="1.5.0" />
<meta name="app-build" content="1" />
```

These values are overwritten by `app.js:_initVersionDisplay()` at
runtime, so they're correct after JS executes. But they were hardcoded
at build 1. Any tool that reads the raw HTML *before* JavaScript runs
(web crawlers, certain monitoring tools, `curl`) will see stale values
for the life of the project.

**Impact:** Minimal — this is an internal prototype, not a public site.
The runtime values are always correct.

**Proposed fix (if it matters):**
`bump-build-number.sh` could patch `index.html` alongside `version.json`
using `sed`. Low priority — the JS runtime update is sufficient for
the actual use cases (DevTools, debug panel, analytics).

---

### L3 — `toLocaleDateString` with time options is implementation-defined

**File:** `js/debug-panel.js` — `_buildBody()` info row for `_builtFormatted`

**What's happening:**
```javascript
new Date(v.buildDate).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit'   // ← time options on a *date* formatter
})
```

`toLocaleDateString` is specified to format the *date* portion only.
Passing `hour` and `minute` options is technically non-standard. V8
(Chrome, FireTV, Vizio) happens to include the time — tested and
confirmed to produce `"Apr 8, 2026, 2:44 PM"`. But older or custom
TV WebView engines (some Tizen builds, some Roku WebKit variants) may
silently strip the time options, producing `"Apr 8, 2026"` with no
time component.

**Impact:** Debug panel "Built" row may show date-only on some TV
platforms. Not a functional issue — the date is still correct.

**Proposed fix:**
Change to `toLocaleString()` which is specified to include time when
time options are provided:

```javascript
new Date(v.buildDate).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit'
})
```

One-line change, zero risk.

---

## Answers to the Seven Focus Areas

| # | Question | Result |
|---|----------|--------|
| 1 | Does version.json read correctly from all reference points? | ✅ Build stamp, debug panel, console log, and meta tags all read correctly. Welcome screen deferred (not built yet). |
| 2 | Does the pre-commit hook actually run on commit? | ✅ Confirmed — fired on the versioning system commit: `Build 1 → 2`. |
| 3 | Does the build number increment correctly? | ✅ Increments by 1 per commit, written back and staged atomically. |
| 4 | Does set-version.sh update the version without breaking anything? | ✅ Updates `version` and `label` only; build number and all other fields preserved. See M2 for the `phase` field gap. |
| 5 | Race conditions if multiple things read version.json during load? | ✅ No race conditions. Single `fetch()` in `DataStore.init()` via `Promise.all()`. All callers read the in-memory cached object. |
| 6 | Does the app work if version.json is missing or malformed? | ✅ `loadJSON('data/version.json').catch(() => null)` handles both cases. `getVersion()` returns `VERSION_FALLBACK`. App boots normally. Build stamp shows `vunknown · Build 0`. |
| 7 | Console errors during version display? | ✅ No errors. All null checks in place for `buildDate`, `#build-stamp`, and meta tag elements. |
