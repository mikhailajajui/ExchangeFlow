#!/usr/bin/env bash
# Assemble the GitHub Pages site into _site/: landing page, prototype build, PRD page. Run from the repo root.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/_site"
rm -rf "$out" && mkdir -p "$out/prototype" "$out/prd"
(cd "$root/exchangeflow/apps/teller-lite" && pnpm build:prototype)
cp -R "$root/exchangeflow/apps/teller-lite/dist-prototype/." "$out/prototype/"
cp "$root/site/index.html" "$root/site/site.css" "$out/"
cp "$root/site/prd.html" "$out/prd/index.html"
cp "$root/docs/branch-desk-prd.md" "$out/prd/branch-desk-prd.md"
touch "$out/.nojekyll"
echo "site assembled in $out"
