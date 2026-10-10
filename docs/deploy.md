---
name: deploy
description: Deployment overview — Uncloud, CI, env vars.
---

# deployment

Straight Up Tax deploys via **Uncloud** to a self-hosted VPS. AWS SST config exists as reference but is not actively maintained.

## prerequisites

Before you can deploy staging or production you need:

- The [uncloud CLI](https://uncloud.run) (`uc version`) and the cluster contexts used locally (`staging` for staging, production’s context — often `default`). Ask a teammate to share the uncloud config (Bitwarden / cluster export); SSH alone is not enough for `uc` commands.
- Gitignored env files from Bitwarden: `.env.staging` and/or `.env.production` (see [environment](./environment.md) and [staging](./staging.md)).
- Your own Linux user on each VM you deploy to, with your own SSH key. Do not share private keys or log in as someone else’s account.

### SSH access (per person)

Each deployer has a dedicated OS user on staging and production (same model on both). Generate a key locally — never reuse or copy another person’s private key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/uncloud_deploy -C "yourname-deploy"
chmod 600 ~/.ssh/uncloud_deploy
```

Send only the public key (`~/.ssh/uncloud_deploy.pub`) to someone who already has server access. They create your user on **both** hosts (docker + passwordless sudo for deploy/caddy steps), install the pubkey, and you set in your local env files:

```bash
DEPLOY_USER=yourname          # your OS username on the VM — not a shared account
DEPLOY_SSH_KEY=~/.ssh/uncloud_deploy
```

`~` is expanded by the deploy scripts. Verify before deploying:

```bash
ssh -i ~/.ssh/uncloud_deploy yourname@DEPLOY_HOST 'whoami && groups'
```

You should see your username and membership in `docker` (and `sudo`). Full admin steps for adding a teammate are in [deploy-uncloud](./deploy-uncloud.md#ssh-access-for-a-new-deployer).

## setup

```bash
bun onboard
```

Configures production env in `.env.production` and syncs secrets to GitHub when configured.

## deploy

Production (api + worker):

```bash
bun tko uncloud deploy-api --production
```

Staging (api + worker, for preview builds — see [staging](./staging.md)):

```bash
bun tko uncloud deploy-api --staging
```

Web is deferred and ships independently when needed:

```bash
bun tko uncloud deploy-web --production    # production web only
bun tko uncloud deploy-web --staging       # staging web only
# or via the release CLI:
bun tko release production --web
bun tko release preview --web
```

`ONE_SERVER_URL` / `VITE_WEB_HOSTNAME` are required only for web deploy (set to `app.straightup.tax` when you ship). Api deploy does not need them. Both `--production` and `--staging` are required flags (no default target).

Local (OrbStack VM on macOS — see `deploy-uncloud` skill):

```bash
bun tko uncloud deploy-local
```

App at http://localhost:8081 after deploy. Clean up with `bun tko uncloud clean`.

## cutover

After the first `deploy-api --production`, verify:

```bash
curl -fsS https://api.straightup.tax/api/health
curl -fsS https://api.straightup.tax/api/handshake -H "x-app-version: 0.0.0"
```

If an old `web` service is still running on the prod cluster, remove it once via Uncloud (`uc rm web` or equivalent) so it does not keep serving stale traffic. Do not automate this in the deploy script.

Native production release can proceed with `bun tko release production` once `.env.production` has the api host urls (`API_SERVER_URL` / `VITE_API_HOSTNAME`). Web host vars are not required until `deploy-web` / `release … --web`.

## CI

GitHub Actions runs `bun ops release --dry-run` on pull requests.

## env

Defined in `src/env.ts`. Run `bun env:update` to sync docker-compose and CI markers after changes.

## native apps

Local Fastlane store releases (preview + production). See [native-release](./native-release.md). EAS Build is not used.
