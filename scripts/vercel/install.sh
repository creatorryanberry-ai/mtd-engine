#!/usr/bin/env bash
# vercel install step: pin bun to the version in package.json, then install
set -euo pipefail
version=$(node -p "require('./package.json').packageManager.split('@')[1]")
if ! "$HOME/.bun/bin/bun" --version 2>/dev/null | grep -qx "$version"; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v$version"
fi
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
