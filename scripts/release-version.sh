#!/usr/bin/env bash
#
# Set every workspace package (and the repo root) to a single release version.
#
# Usage:
#   scripts/release-version.sh [version]
#
#   version   Explicit version, e.g. 1.4.0. A leading "v" is stripped, so a
#             GitHub release tag like "v1.4.0" works as-is.
#             When omitted, the current root version's MINOR is bumped:
#             x.y.z -> x.(y+1).0.
#
# Workspace package dependencies use `workspace:^`, so on `pnpm publish` they are
# rewritten to `^<this version>` — keeping the released packages in lockstep.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

current="$(node -p "require('./package.json').version")"

input="${1:-}"
if [ -n "$input" ]; then
  # Strip an optional leading "v" (release tags are often v1.2.3).
  version="${input#v}"
else
  # Default: bump the minor and reset the patch.
  version="$(node -e 'const [maj, min] = process.argv[1].split(".").map(Number); console.log(`${maj}.${min + 1}.0`)' "$current")"
fi

if ! printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)*$'; then
  echo "error: invalid semver version '$version'" >&2
  exit 1
fi

echo "Releasing $current -> $version"

# Root + every workspace package (apps/*, packages/*, docs), matching pnpm-workspace.yaml.
shopt -s nullglob
files=(package.json apps/*/package.json packages/*/package.json docs/package.json)

for file in "${files[@]}"; do
  node -e '
    const fs = require("fs");
    const [file, version] = process.argv.slice(1);
    const text = fs.readFileSync(file, "utf8");
    // Replace only the first (top-level) "version" field; preserve formatting.
    const next = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
    if (next !== text) {
      fs.writeFileSync(file, next);
      console.log("  updated " + file);
    }
  ' "$file" "$version"
done

# Emit the resolved version on the last line for callers to capture.
echo "$version"
