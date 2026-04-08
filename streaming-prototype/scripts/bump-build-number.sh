#!/usr/bin/env bash
# bump-build-number.sh
# Increments the build number in data/version.json and updates build metadata.
# Run automatically via .git/hooks/pre-commit, or manually before committing.

set -e

# Locate version.json relative to the repo root
REPO_ROOT="$(git rev-parse --show-toplevel)"
VERSION_FILE="$REPO_ROOT/streaming-prototype/data/version.json"

if [ ! -f "$VERSION_FILE" ]; then
  echo "[bump-build] ERROR: version.json not found at $VERSION_FILE"
  exit 1
fi

# Read current values
CURRENT_BUILD=$(node -e "const v=require('$VERSION_FILE'); process.stdout.write(String(v.buildNumber));")
NEW_BUILD=$((CURRENT_BUILD + 1))
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Rewrite version.json in-place (preserves all other fields)
node - <<JS
const fs = require('fs');
const path = '$VERSION_FILE';
const v = JSON.parse(fs.readFileSync(path, 'utf8'));
v.buildNumber = $NEW_BUILD;
v.buildDate   = '$BUILD_DATE';
v.gitCommit   = '$GIT_COMMIT';
v.gitBranch   = '$GIT_BRANCH';
fs.writeFileSync(path, JSON.stringify(v, null, 2) + '\n');
JS

# Stage the updated file so it's included in the current commit
git add "$VERSION_FILE"

echo "[bump-build] Build $CURRENT_BUILD → $NEW_BUILD  ($GIT_BRANCH@$GIT_COMMIT)"
