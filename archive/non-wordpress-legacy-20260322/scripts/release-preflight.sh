#!/usr/bin/env bash
set -euo pipefail

echo "[preflight] lint"
npm run lint

echo "[preflight] unit/integration tests"
npm run test

echo "[preflight] production build"
npm run build

echo "[preflight] done"
