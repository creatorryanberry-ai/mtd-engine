# Zero-downtime API deploys (start-first)

## Goal

Staging and production use the same Uncloud deploy path so the standalone `api` service stays available during image updates (no connection-failure window). Document a future two-replica option without implementing it yet.

## Decisions

- **Strategy A (now):** one `api` replica with Uncloud `deploy.update_config.order: start-first` and a short `monitor` that honors the existing `/api/health` check. New container starts and becomes healthy before the old one stops.
- **Identical on staging and production:** one `docker-compose.yml`; no env-specific replica counts.
- **Worker unchanged:** still deployed with `recreate: false` so in-flight jobs can drain.
- **`--recreate` on api kept:** ensures `:latest` image is applied; Uncloud still performs start-first replacement for the api service.
- **Ingress:** api continues to publish only via `x-ports` (Caddy), not a host port bind, so start-first remains valid.
- **Migrations:** still run before service roll; deployers must keep migrations backward-compatible across the cutover window.

## Future option B (document only)

Two `api` replicas + `start-first` for stronger availability during rolls (always one healthy instance; peak three briefly).

Requires larger VMs than today’s staging box (~2 GB / 19 GB disk). Rough target when ready: **`e2-standard-2` (8 GB) + ~50 GB disk** per env (~+$47/mo VM in London vs `e2-small`, plus a few dollars disk). Revisit when prod traffic or deploy risk justifies the cost; staging must be resized to match before enabling `replicas: 2`.

## Non-goals

- Resizing VMs or disks in this change
- Implementing `replicas: 2`
- Multi-machine / multi-zone HA
- Changing worker recreate semantics or migration runner

## In-repo work

- `src/uncloud/docker-compose.yml` — `api.deploy.replicas: 1`, `update_config.order: start-first`, `monitor: 30s`
- Docs: `docs/deploy-uncloud.md`, `docs/staging.md` (and matching skills) — zero-downtime expectation + future option B note

## Verification

During a staging `bun tko uncloud deploy-api --staging`, poll `https://staging-api.curatormtd.co.uk/api/health` continuously; expect ongoing 200s through the cutover (occasional slow response OK; no multi-second stretch of connection failures).
