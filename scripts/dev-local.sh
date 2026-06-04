#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

set -a
source "$ROOT_DIR/.env"
set +a

mkdir -p "$ROOT_DIR/data"
cd "$ROOT_DIR/web"
npm run dev
