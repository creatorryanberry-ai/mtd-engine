---
name: getting-started
description: First-time setup — Node/Bun/Ruby version managers (n, rbenv, chruby, mise), macOS and WSL, bootstrap, lite backend, troubleshooting.
---

# getting started

Full setup for a fresh checkout. The short version is in the root README; this page covers version managers, macOS vs WSL, and common first-run problems.

## what you need

Pinned versions live in the repo — match these, regardless of which manager you use:

- **Node** — `engines.node` in `package.json` (currently `^24.3.0`)
- **Bun** — `packageManager` in `package.json` (currently `bun@1.3.9`)
- **Ruby** — `.ruby-version` (currently `3.3`) — only needed for native store releases via Fastlane, not for day-to-day `bun dev`

Docker (or the Docker-free lite backend) is required for the local database and object storage.

Any version manager is fine. The sections below cover the ones the team commonly uses.

## Node and Bun

### with `n` (recommended)

[n](https://github.com/tj/n) manages Node; install Bun separately from the official installer.

```bash
# node — npm install -g n, or brew install n
n 24.3.0

# bun — pin to packageManager in package.json
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.9"
# restart the terminal (or source ~/.bashrc / ~/.zshrc), then:
bun --version   # should match package.json
```

To switch Bun later:

```bash
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.9"
```

### with mise (optional)

[mise](https://mise.run) can manage both Node and Bun from one tool. It is optional — not required by this project.

```bash
# macOS: brew install mise
# linux/WSL: curl https://mise.run | sh
mise settings set idiomatic_version_file true
mise settings add idiomatic_version_file_enable_tools bun
mise settings set auto_install true
mise use -g node@24.3.0
# bun installs automatically from package.json when you cd into the repo
```

### other Node managers

nvm, fnm, asdf, and volta all work. Install Node `24.3.0` (or whatever `engines.node` currently pins), then install Bun with the curl installer above. The app only cares that `node` and `bun` on your `PATH` match the pinned versions.

## Ruby (native releases only)

Ruby is only needed when you run Fastlane store releases (`bun tko release …`). Skip this for everyday web/backend development. See [native-release](./native-release.md).

### with chruby + ruby-install

```bash
# macOS example
brew install chruby ruby-install
ruby-install ruby 3.3
# add to ~/.zshrc / ~/.bashrc:
#   source $(brew --prefix)/opt/chruby/share/chruby/chruby.sh
#   source $(brew --prefix)/opt/chruby/share/chruby/auto.sh
chruby 3.3
gem install bundler
bundle install
```

### with rbenv

```bash
# macOS: brew install rbenv ruby-build
# linux/WSL: follow https://github.com/rbenv/rbenv#installation
rbenv install 3.3
rbenv local 3.3   # uses .ruby-version in the repo
gem install bundler
bundle install
```

mise and asdf can also install Ruby from `.ruby-version` if you already use them for Node/Bun.

## macOS

### Docker

Prefer [OrbStack](https://orbstack.dev) over Docker Desktop:

```bash
brew install --cask orbstack
```

Open OrbStack once so the Docker daemon starts.

### native tooling (optional)

- iOS: Xcode 15+ with a simulator installed
- Android: Android Studio and JDK 17+

### setup and run

```bash
./scripts/bootstrap.sh   # checks bun/docker, offers bun install
bun onboard              # interactive wizard — choose "Complete setup"
```

Then in separate terminals:

```bash
bun backend   # docker (postgres + minio) + migrations
bun dev       # http://localhost:8081
APP_VARIANT=preview bun ios   # optional: iOS preview build (same identity as TestFlight)
```

The dev CLI has keyboard shortcuts for opening the iOS simulator, web, and Android — see [dev-cli](./dev-cli.md).

Local Uncloud deploys (full stack rehearsal in an OrbStack VM) are macOS-only; see [deploy-uncloud](./deploy-uncloud.md).

## WSL / Linux

### Docker

Prefer **Docker Engine inside WSL**, not Docker Desktop on Windows — Desktop is usually the resource hog:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker
```

Restart your terminal afterwards — group membership needs a fresh session.

If WSL feels starved, cap its memory from Windows. Create or edit `%UserProfile%\.wslconfig`:

```ini
[wsl2]
memory=4GB
processors=4
```

Then from PowerShell: `wsl --shutdown` and reopen the distro.

### setup and run

```bash
./scripts/bootstrap.sh   # checks bun/docker, offers bun install
bun onboard              # interactive wizard — choose "Complete setup"
```

Default path (Docker):

```bash
bun backend   # docker (postgres + minio) + migrations
bun dev       # http://localhost:8081
```

If Docker is still too heavy, skip it and use the lite backend (orez runs Postgres + S3 in-process — no containers):

```bash
bun lite          # orez backend + migrations + dev server in one go
# or split:
bun lite:backend  # backend only
bun dev           # in another terminal
```

Uncloud / OrbStack local deploy is not the path for everyday WSL development; that stack is for production-like deploys. See [deploy](./deploy.md).

## shared steps

### env files

`.env*` files are gitignored. Completed copies live in the team Bitwarden vault; ask a developer to share the collection if you don't have access.

`.env.development` is auto-generated with working defaults the first time the dev tooling runs, so you can develop without touching Bitwarden. You only need the Bitwarden copy if you want real sandbox credentials (HMRC). See [environment](./environment.md) for the full picture.

Don't use `bun onboard --defaults` on a fresh checkout — it expects `.env.development` to exist, and that file is generated on first run.

### verify

```bash
bun check       # lint, types, deps
bun test:unit   # fast unit tests, no backend needed
```

## troubleshooting

**`bun`/`node` not found after installing** — open a new terminal (an already-open one won't pick up `PATH` changes), or `source ~/.bashrc` / `source ~/.zshrc`.

**`bun onboard --defaults` fails with "Source file .env.development not found"** — that file is auto-generated on first dev run, not present on a fresh checkout. Use the interactive wizard (`bun onboard`) instead.

**Docker daemon not reachable in WSL** — confirm it's running with `systemctl status docker`; start it with `sudo systemctl start docker` (or `sudo service docker start` if systemd isn't enabled for this distro). If you use Docker Desktop on Windows instead, enable WSL integration for this distro under Settings → Resources → WSL Integration.

**WSL / Docker using too much RAM** — prefer Docker Engine inside WSL over Docker Desktop, set a memory cap in `.wslconfig` (see above), or use `bun lite` / `bun lite:backend` so you don't need Docker at all.

**`Incorrect Node.js version. Expected ^24.3.0 but got vX.Y.Z`** — your `node` on `PATH` doesn't match `engines.node` in `package.json`. With `n`, run `n 24.3.0` (or whatever version is currently pinned). With other managers, install/switch to that same version.

**Bun version mismatch** — reinstall the exact version from `packageManager` in `package.json`, e.g. `curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.9"`.

**`TypeError: ... is not a function` / SSR crash from a `node_modules/.vite` path** — stale or mismatched dependency bundle. Stop the dev server, run `rm -rf node_modules/.vite`, then restart `bun dev`. If it persists after a clean re-optimize, check `bun.lock` for a dependency resolved outside the version range one of its consumers declares (e.g. run `bun install` after editing `package.json` if you've changed a pinned version).

**Port 8081/5433/9200 already in use** — another instance (or the local uncloud deploy) is holding a port. `bun onboard` reports conflicts; stop the other process or set `PORT_OFFSET`.

**Backend in a weird state after CI runs** — CI can rotate auth keys/secrets. Reset with `bun backend:clean && bun backend` (or restart `bun lite:backend` if you're on the lite path).
