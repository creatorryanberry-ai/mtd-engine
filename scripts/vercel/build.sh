#!/usr/bin/env bash
# vercel build step: see scripts/vercel/build.ts
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
bun scripts/vercel/build.ts
