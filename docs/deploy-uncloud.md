---
name: deploy-uncloud
description: Uncloud self-hosted deployment — docker-compose, SSL, worker service, OrbStack local VM.
---

# uncloud deployment

Deploy Straight Up Tax to a VPS using Uncloud and Docker Compose.

## services

- **api** — standalone api (`dist/api.js` in `mtd-web:latest`, port 8081) — default ship
- **worker** — pg-boss job runner (pre-bundled `dist/worker.js` in the image)
- **web** — One app server (same image) — deferred; `bun tko uncloud deploy-web --production` when needed
- **pgdb** — optional self-hosted Postgres (profile `self-hosted-db`)

Production typically uses an external managed database via `DEPLOY_DB` / `DATABASE_URL`. Local deploy uses the `self-hosted-db` profile and runs Postgres in-cluster.

## zero-downtime api updates

Staging and production share the same compose. The `api` service uses Uncloud **start-first** rolling updates (`deploy.update_config.order: start-first`, `replicas: 1`): the new container must pass `/api/health` before the old one stops. Keep migrations backward-compatible across that cutover.

**Future (option B):** raise `api` to `replicas: 2` for stronger availability during rolls. Needs larger VMs than today’s small staging box (~2 GB / 19 GB) — aim for roughly `e2-standard-2` (8 GB) and ~50 GB disk on **both** staging and production before enabling. See `docs/superpowers/specs/2026-07-30-zero-downtime-api-deploys-design.md`.

## SSH access for a new deployer

Staging and production use the same access model: one OS user per person, each with their own SSH key. Do not share private keys or add a teammate’s pubkey to an existing user’s `authorized_keys` as a shortcut.

The new person generates a key and sends you only the `.pub` file:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/uncloud_deploy -C "theirname-deploy"
```

On each host (staging and production), as a user who already has access, create their account and install the pubkey. Replace `theirname`, the host IP, your SSH login, and the path to the `.pub` file:

```bash
PUB=$(cat /path/to/theirname.pub)

ssh -i ~/.ssh/uncloud_deploy you@HOST_IP bash -s <<EOF
set -euo pipefail
if ! id theirname >/dev/null 2>&1; then
  sudo adduser --disabled-password --gecos "Their Name" theirname
fi
sudo usermod -aG docker,sudo theirname
echo 'theirname ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/theirname >/dev/null
sudo chmod 440 /etc/sudoers.d/theirname
sudo mkdir -p /home/theirname/.ssh
sudo chmod 700 /home/theirname/.ssh
echo '$PUB' | sudo tee /home/theirname/.ssh/authorized_keys >/dev/null
sudo chmod 600 /home/theirname/.ssh/authorized_keys
sudo chown -R theirname:theirname /home/theirname
id theirname
EOF
```

They set `DEPLOY_USER=theirname` and `DEPLOY_SSH_KEY=~/.ssh/uncloud_deploy` in their `.env.staging` / `.env.production`, and confirm:

```bash
ssh -i ~/.ssh/uncloud_deploy theirname@HOST_IP 'whoami && groups && docker ps >/dev/null && echo ok'
```

Also share the uncloud cluster contexts they need (`staging` / production) and the env files from Bitwarden. Revoking access later is deleting their OS user or removing their line from `/home/theirname/.ssh/authorized_keys` on each host.

## production deploy

```bash
bun onboard          # configure DEPLOY_HOST, DEPLOY_DB, etc.
bun tko uncloud deploy-api --production
```

The deploy script builds the image, runs migrations, and deploys api + worker. Web is independent: `bun tko uncloud deploy-web --production` when needed. Both `--production` and `--staging` are required flags (no default target).

## local deploy (orbstack)

Local deploy targets an OrbStack Linux machine (`mtd-deploy`) instead of Multipass. OrbStack provides both the Docker daemon (image build/push on the host) and the deploy target VM under one hypervisor — avoiding the vmnet conflicts Multipass has on recent macOS.

### prerequisites

- [OrbStack](https://orbstack.dev) installed and running (`orb version`)
- [uncloud CLI](https://uncloud.run) (`uc version`)
- Docker context pointing at OrbStack (set automatically when OrbStack starts)

### deploy

```bash
bun tko uncloud deploy-local
```

This builds the web app and a native-arch Docker image (arm64 on Apple Silicon), creates or reuses the `mtd-deploy` OrbStack machine, installs sshd inside it, initialises an isolated uncloud cluster (`mtd-local` context), pushes the image, and deploys pgdb → web → worker.

Access the app at http://localhost:8081 (SSH port-forward from the VM to the web container).

Faster iteration when `dist/` and the image are already built:

```bash
bun tko uncloud deploy-local --skip-build --skip-docker
```

### clean up

```bash
bun tko uncloud clean
```

Deletes the `mtd-deploy` OrbStack machine. Does not remove the `mtd-local` context from `~/.config/uncloud/config.yaml` (safe — production `default` context is untouched).

### local vs production context

`deploy-local` always uses the `mtd-local` uncloud context. Your production cluster stays in `default` (or whatever you configured via `bun onboard`). The scripts never run `uc deploy` against production during local deploy.

Local overrides applied at deploy time:

- `VITE_WEB_HOSTNAME` → `mtd.local.test` (uncloud requires a dotted hostname for x-ports; access is via port-forward, not this hostname)
- `DATABASE_URL` → `postgresql://user:password@pgdb.internal:5432/postgres` (uncloud service DNS; dev `127.0.0.1` is unreachable from containers)

### useful commands

```bash
uc -c mtd-local ls              # list local cluster services
uc -c mtd-local logs web -f     # follow web logs
orb -m mtd-deploy bash          # shell into the vm
orb list                        # orbstack machine status
```

### troubleshooting

**OrbStack not found** — install with `brew install --cask orbstack` and open the app once so the daemon starts.

**Docker build fails (no daemon)** — ensure OrbStack is running. It provides the Docker socket; Docker Desktop is not required for local deploy.

**Worker unhealthy on first deploy** — pgdb must be running before web/worker. The script deploys pgdb first; if a prior deploy was interrupted, redeploy:

```bash
bun tko uncloud deploy-local --skip-build --skip-docker
```

**uncloud init times out on first run** — the daemon's first systemd start can exceed the timeout while creating its corrosion container. The script retries once; a second `deploy-local` run also works.

**Port 8081 already in use** — stop your local dev server (`bun dev`) before deploying, or the SSH port-forward will conflict.

## key env vars

- `DEPLOY_HOST` — server hostname or IP
- `DEPLOY_USER` — your OS username on that host (personal account, not a shared deploy user)
- `DEPLOY_SSH_KEY` — path to your private key (typically `~/.ssh/uncloud_deploy`; `~` is expanded)
- `DEPLOY_DB` / `DATABASE_URL` — PostgreSQL connection string
- `VITE_WEB_HOSTNAME` — public web hostname
- `BETTER_AUTH_URL` / `ONE_SERVER_URL` — public app URL

Run `bun env:update` after changing `src/env.ts`.

## health check

```bash
bun tko uncloud check-deployment
curl -fsS https://api.straightup.tax/api/health
```

Expects `api` and `worker` services healthy.

## vm sizing (production)

The production stack is **api + worker** only (Postgres is external).

| Environment | Suggested size | Notes |
|-------------|----------------|-------|
| OrbStack local (`mtd-deploy`) | default OrbStack sizing | lightweight Ubuntu machine; shares host resources |
| GCP / VPS production | `e2-small` (2 vCPU, 2 GB) or `e2-medium` (2 vCPU, 4 GB) | bump to 4 GB if worker jobs are heavy |

### resize a gce vm (production)

Replace `INSTANCE` and `ZONE` with your values (`gcloud compute instances list`).

```bash
gcloud compute instances stop INSTANCE --zone=ZONE
gcloud compute instances set-machine-type INSTANCE \
  --machine-type=e2-small \
  --zone=ZONE
gcloud compute instances start INSTANCE --zone=ZONE
```

After resizing, redeploy to confirm api + worker are healthy:

```bash
bun tko uncloud check-deployment
```
