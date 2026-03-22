#!/usr/bin/env bash
set -euo pipefail

# Validate operational scripts/workflows structure locally.

if ! command -v bash >/dev/null 2>&1; then
  echo "ERROR: bash is required"
  exit 1
fi

echo "[ops-sanity] bash syntax checks"
while IFS= read -r f; do
  bash -n "$f"
  echo "OK: $f"
done < <(find scripts -maxdepth 1 -type f -name '*.sh' | sort)

if [[ -d .github/workflows ]]; then
  if command -v ruby >/dev/null 2>&1; then
    echo "[ops-sanity] workflow yaml parse"
    while IFS= read -r wf; do
      ruby -e 'require "yaml"; YAML.load_file(ARGV[0])' "$wf"
      echo "OK: $wf"
    done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)
  else
    echo "WARN: ruby not found; skip workflow yaml parse"
  fi
fi

for f in scripts/security-audit-summary.mjs scripts/security-audit-regression.mjs; do
  if [[ -f "$f" ]]; then
    node --check "$f"
    echo "OK: $f"
  fi
done

echo "[ops-sanity] done"
