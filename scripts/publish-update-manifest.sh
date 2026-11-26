#!/usr/bin/env bash
# Upload the auto-update manifests produced by the build to the rolling
# `release` GitHub release. Installed copies of the plugin poll
# .../releases/download/release/update.json (see addon/manifest.json).
set -euo pipefail

build_dir=".scaffold/build"
tag="release"

for f in update.json update-beta.json; do
  if [ ! -f "$build_dir/$f" ]; then
    echo "missing $build_dir/$f - run the build first" >&2
    exit 1
  fi
done

if ! gh release view "$tag" >/dev/null 2>&1; then
  gh release create "$tag" \
    --title "Auto-update manifest" \
    --notes "Holds update.json for Zotero's plugin auto-update. Not a plugin release; download the .xpi from the versioned releases." \
    --latest=false
fi

gh release upload "$tag" "$build_dir/update.json" "$build_dir/update-beta.json" --clobber
