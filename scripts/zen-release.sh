#!/usr/bin/env bash
# Fork-only: bump, build, sign (AMO unlisted) and install the Firefox build in Zen.
#
# Needs: fnox secrets MOZILLA_ADDON_JWT_ISSUER / MOZILLA_ADDON_JWT_SECRET,
# and a clean `personal` branch. Zen asks once to confirm the install.
set -euo pipefail

cd "$(dirname "$0")/.."
OLD_ADDON_ID='1094918@gmail.com'
ZEN_DIR="$HOME/.config/zen"

[[ "$(git branch --show-current)" == personal ]] || { echo "error: run on the 'personal' branch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "error: working tree is not clean" >&2; exit 1; }

# AMO rejects a version it already signed for this ID: 2.5.0 -> 2.5.0.1 -> 2.5.0.2.
# After a rebase onto a new upstream version (e.g. 2.6.0), this restarts at 2.6.0.1.
version=$(node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const p = pkg.version.split(".").map(Number);
  pkg.version = p.length === 4 ? [...p.slice(0, 3), p[3] + 1].join(".") : [...p, 1].join(".");
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  console.log(pkg.version);
')
echo "version: $version"

pnpm install --frozen-lockfile --silent
pnpm -s build:ff

log=$(mktemp)
trap 'rm -f "$log"' EXIT
# shellcheck disable=SC2016 # the keys expand inside the fnox child, not here
fnox exec -- sh -c 'npx web-ext sign --source-dir dist/firefox --channel unlisted \
  --api-key "$MOZILLA_ADDON_JWT_ISSUER" --api-secret "$MOZILLA_ADDON_JWT_SECRET"' 2>&1 | tee "$log"
xpi=$(sed -n 's/^Signed xpi downloaded: //p' "$log" | tail -1)
[[ -f "$xpi" ]] || { echo "error: signing failed; package.json bump left uncommitted" >&2; exit 1; }

git commit -q -m "chore: fork release $version" package.json
echo "committed: chore: fork release $version"

if grep -qs "\"id\":\"$OLD_ADDON_ID\"" "$ZEN_DIR"/*/extensions.json; then
  echo "warning: the AMO version ($OLD_ADDON_ID) is still installed in Zen; remove it in about:addons"
fi

zen-browser "$xpi" >/dev/null 2>&1 &
echo "opened in Zen: $xpi"
echo "confirm the install prompt in Zen"
