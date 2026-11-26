#!/usr/bin/env bash
# semantic-release starts at 1.0.0 when there is no version tag. To start at
# 0.1.0, tag the root commit v0.0.0 before the first release. The root
# commit's own changes are then not part of the first release, so the
# repository must start with an empty root commit (`chore: initial commit`).
set -euo pipefail

if [ -n "$(git tag -l 'v*')" ]; then
  exit 0
fi

root="$(git rev-list --max-parents=0 HEAD | tail -n1)"
if [ "$root" = "$(git rev-parse HEAD)" ]; then
  echo "No version tag yet and main has a single commit. The first release" >&2
  echo "needs an empty root commit followed by the real commits, e.g." >&2
  echo "  git commit --allow-empty -m 'chore: initial commit'" >&2
  echo "as the very first commit of the repository." >&2
  exit 1
fi

git tag v0.0.0 "$root"
echo "Tagged root commit $root as v0.0.0"
