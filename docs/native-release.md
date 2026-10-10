---
name: native-release
description: Local Fastlane store releases — iOS TestFlight, Android Play, APP_VARIANT preview/production. Not EAS.
---

# Native store releases (local Fastlane)

Ship native apps with Fastlane on your machine. Preview and production stay as separate apps via `APP_VARIANT`. GitHub `native-cd` is deferred.

This replaces EAS Build. Push uses native APNs / FCM device tokens, not Expo Push.

## Prerequisites

- Xcode + CocoaPods (iOS)
- JDK + Android SDK (Android)
- Ruby matching `.ruby-version` + Bundler (`bundle install` at repo root) — chruby or rbenv both work; see [getting-started](./getting-started.md)
- App Store Connect apps for preview + production bundle IDs
- Play Console apps for preview + production packages
- Private git repo for fastlane match certificates
- Android upload keystore + Play service account JSON

Bundle IDs (defaults):

- preview: `tax.straightup.preview`
- production: `tax.straightup.app`

Local `bun ios` / `bun android` use the same IDs — set `APP_VARIANT=preview` or `production`. There is no `.dev` identity.

## One-time setup

```bash
bundle config set --local path 'vendor/bundle'   # if needed
bundle install

bun tko release setup
# or separately:
# bun tko ios setup-release
# bun tko android setup-release
```

Secrets land in `.env.ios` and `.env.android` (gitignored). Prefer file paths for keystore and Play JSON when working locally.

Match must use **your** certs repo (`APPLE_CODE_SIGNING_GIT_URL`). There is no shared default.

Lanes live in `src/fastlane/` (symlinked as `./fastlane` for the Fastlane CLI).

App IDs in [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list) must include every capability the app uses. Preview/production need at least:

- **Push Notifications** (Expo push / `aps-environment`)
- **App Groups** (`group.tax.straightup.preview` / `group.tax.straightup.app`)

After changing capabilities, regenerate profiles:

```bash
REGENERATE_PROFILES=1 bundle exec fastlane ios sync_certs
# (MATCH_FORCE=1 also works; it is converted to a boolean before match runs)
```

### Xcode 26 / fmt

RN 0.83 ships fmt 11.0.2, which fails to archive on Xcode 26 (Apple Clang
consteval). `@mtd/cli/withFmtXcode26Fix` forces the `fmt` pod to C++17.
Remove it once RN includes fmt ≥ 12.1.0.

Set `IOS_BUNDLE_ID` (and `IOS_EXTENSION_BUNDLE_ID` if needed) for each app
variant when syncing.
TestFlight upload uses `altool`, which needs the API `.p8` at `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8`. Release lanes install that automatically. For a one-off `pilot` / `altool` upload, copy it there first.

## Release

Dry run (build only — no api deploy, no store upload):

```bash
bun tko release preview --skip-upload --skip-api
bun tko release production --skip-upload --skip-api
```

Upload (api deploys first, then native):

```bash
bun tko release preview          # staging api → TestFlight + Play internal
bun tko release production       # production api → TestFlight + Play production (draft)
bun tko release preview --web    # also Uncloud deploy-web --staging
bun tko release production --web # also Uncloud deploy-web --production
```

Flags: `--ios`, `--android`, `--web`, `--skip-prebuild`, `--skip-upload`, `--skip-api`.

Plain release (no platform flags) enables ios + android. Web is wired into that default but left commented until the web app ships — uncomment `web = true` in `scripts/release/helpers/run-release.ts` to include it.

Preview/production native builds bake urls from `.env.staging` / `.env.production`. API urls are enough for native; `ONE_SERVER_URL` / `VITE_WEB_HOSTNAME` are only required for `--web`.

Flow: `deploy-api` (preview→staging, production→production) → set `APP_VARIANT` → `one prebuild` → pod install (iOS) → Fastlane `ios beta` / `android beta`.  
`deploy-api` skips when the api fingerprint is unchanged; if inputs moved it prompts to bump `API_RELEASE_VERSION` (default patch). Use `--skip-api` to skip the api step entirely.  
Flow (web): after api, `bun tko uncloud deploy-web --staging` (preview) or `--production`.

## What got removed

- `eas.json`, `scripts/eas/`, `bun eas` / `tko eas`

## Later

- GitHub Actions native-cd on hosted macOS/Ubuntu runners
