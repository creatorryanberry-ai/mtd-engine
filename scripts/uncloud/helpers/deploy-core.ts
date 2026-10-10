#!/usr/bin/env bun

import { tmpdir } from 'node:os'

import { cmd } from '@mtd/cli'

import {
  buildOriginCACaddyfile,
  patchRemoteCaddyfile,
  restartCaddy,
  uploadOriginCACerts,
} from './caddy-origin-ca'
import { stripSelfHostedDbFromCompose, usesExternalDatabase } from './external-db-compose'

type DeployableService = 'web' | 'api' | 'worker'

export type DeployTarget = {
  name: 'production' | 'staging'
  // services to deploy, in order. default ship is api+worker; web is optional via deploy-web.
  services: DeployableService[]
}

function printDeploySummary(
  target: DeployTarget,
  deployUser: string,
  deployHost: string,
) {
  const shipsWeb = target.services.includes('web')
  const primaryHost = shipsWeb
    ? process.env.VITE_WEB_HOSTNAME
    : process.env.VITE_API_HOSTNAME

  console.info('\n🎉 deployment ready!')
  console.info('\naccess your deployment:')
  if (primaryHost) {
    console.info(`  ${shipsWeb ? 'web app' : 'api'}:     https://${primaryHost}`)
  }
  console.info('  (see uc ls for *.uncld.dev fallback urls)')
  console.info(`  ssh:         ssh ${deployUser}@${deployHost}`)
  console.info('\nuseful commands:')
  console.info('  uc ls                    # list services')
  console.info(`  uc logs ${target.services[0]}              # view logs`)
  console.info(`  ssh ${deployUser}@${deployHost}  # ssh to server`)
}

export async function runUncloudDeploy(target: DeployTarget) {
  await cmd`Deploy`.run(async ({ run, colors, fs, path }) => {
    const { buildWeb, buildDockerImage } = await import('./build')
    const { processComposeEnv } = await import('./processEnv')
    const { checkSSHKey, testSSHConnection } = await import('./ssh')
    const { checkUncloudCLI, initUncloud, pushImage, deployStack, showStatus } =
      await import('./uncloud')
    const { UNCLOUD_CONTEXT_DEFAULT } = await import('@mtd/scripts/helpers/uncloud')
    const { acquireDeployLock, releaseDeployLock } =
      await import('@mtd/scripts/helpers/deploy-lock')

    // parse args
    const args = process.argv.slice(2)
    const skipBuild = args.includes('--skip-build')
    const skipDocker = args.includes('--skip-docker')
    const skipLock = args.includes('--skip-lock')

    const DEPLOY_HOST = process.env.DEPLOY_HOST
    const DEPLOY_USER = process.env.DEPLOY_USER || 'root'
    // default to uncloud_deploy (set by CI), fall back to id_rsa locally
    const DEPLOY_SSH_KEY =
      process.env.DEPLOY_SSH_KEY || `${process.env.HOME}/.ssh/uncloud_deploy`
    const context = process.env.UNCLOUD_CONTEXT || UNCLOUD_CONTEXT_DEFAULT

    // the deployed commit sha must reach the containers so /api/health can report
    // it. CI and local both run this from the repo checkout, so derive it from git
    // when not already set — it flows into the processed compose env and the
    // migration env file, both of which read process.env.GIT_SHA.
    if (!process.env.GIT_SHA) {
      const { stdout } = await run('git rev-parse HEAD', {
        captureOutput: true,
        silent: true,
      })
      process.env.GIT_SHA = stdout.trim()
    }

    function getSSHCmd(host: string, sshKey: string): string {
      return `ssh -i ${sshKey} -o StrictHostKeyChecking=no ${host}`
    }

    async function tagPreviousImage(host: string, sshKey: string): Promise<void> {
      const ssh = getSSHCmd(host, sshKey)
      try {
        await run(
          `${ssh} "docker tag mtd-web:latest mtd-web:previous 2>/dev/null || true"`,
          { silent: true },
        )
        console.info(colors.gray('  tagged current image as mtd-web:previous'))
      } catch {
        console.info(colors.gray('  no existing image to tag (first deploy?)'))
      }
    }

    // small disks (e.g. 20G staging) fill up with old mtd-web layers across deploys.
    // prune unused images before push so the registry has room; running containers
    // keep their image. best-effort — a full disk can still block prune itself.
    async function pruneUnusedDockerImages(host: string, sshKey: string): Promise<void> {
      const ssh = getSSHCmd(host, sshKey)
      console.info('\n🧹 pruning unused docker images on server...\n')
      try {
        const { stdout } = await run(
          `${ssh} "docker image prune -af 2>/dev/null || sudo docker image prune -af"`,
          { captureOutput: true },
        )
        const summary = stdout.trim().split('\n').filter(Boolean).at(-1)
        console.info(colors.gray(`  ${summary || 'prune complete'}`))
      } catch {
        console.info(
          colors.yellow(
            '  ⚠️  image prune failed (continuing) — if push fails with no space, ssh in and free disk manually',
          ),
        )
      }
    }

    async function gracefulStopWorker(host: string, sshKey: string): Promise<void> {
      const ssh = getSSHCmd(host, sshKey)
      try {
        const { stdout } = await run(`${ssh} "docker ps -qf name=worker"`, {
          captureOutput: true,
          silent: true,
        })
        const containerId = stdout.trim()
        if (!containerId) return

        console.info(colors.gray('  stopping worker gracefully (15s timeout)...'))
        await run(`${ssh} "docker stop -t 15 ${containerId}"`, { silent: true })
        console.info(colors.gray('  worker stopped cleanly'))
      } catch {
        console.info(colors.gray('  worker: not running or already stopped'))
      }
    }

    async function gracefulStopPgdb(host: string, sshKey: string): Promise<void> {
      const ssh = getSSHCmd(host, sshKey)
      try {
        const { stdout } = await run(`${ssh} "docker ps -qf name=pgdb"`, {
          captureOutput: true,
          silent: true,
        })
        const containerId = stdout.trim()
        if (!containerId) return

        const pgUser = process.env.POSTGRES_USER || 'user'
        const { stdout: ready } = await run(
          `${ssh} "docker exec ${containerId} pg_isready -U ${pgUser} 2>&1 || echo NOT_READY"`,
          { captureOutput: true, silent: true },
        )

        if (ready.includes('NOT_READY')) {
          console.info(colors.gray('  pgdb: not ready, skipping graceful stop'))
          return
        }

        console.info(colors.gray('  pgdb: issuing CHECKPOINT before stop...'))
        await run(
          `${ssh} "docker exec ${containerId} psql -U ${pgUser} -d postgres -c 'CHECKPOINT;'"`,
          { silent: true },
        )

        console.info(colors.gray('  stopping pgdb gracefully (60s timeout)...'))
        await run(`${ssh} "docker stop -t 60 ${containerId}"`, { silent: true })
        console.info(colors.gray('  pgdb stopped cleanly'))
      } catch {
        console.info(colors.gray('  pgdb: not running or already stopped'))
      }
    }

    // run migrations as a one-off container from the pushed web image, before the
    // stack deploys. db url goes through a scp'd env file so it never lands in logs.
    async function runMigrations(
      host: string,
      sshKey: string,
      dbUrls: { DATABASE_URL: string },
    ): Promise<void> {
      console.info('\n🔧 running database migrations...\n')

      const envFileContent =
        [
          'ALLOW_MISSING_ENV=1',
          'NODE_TLS_REJECT_UNAUTHORIZED=0',
          `GIT_SHA=${process.env.GIT_SHA || 'unknown'}`,
          `DATABASE_URL=${dbUrls.DATABASE_URL}`,
        ].join('\n') + '\n'

      const localEnvFile = path.join(tmpdir(), 'mtd-migrate.env')
      const remoteEnvFile = '/tmp/mtd-migrate.env'
      await fs.promises.writeFile(localEnvFile, envFileContent, { mode: 0o600 })

      const ssh = getSSHCmd(host, sshKey)
      try {
        await run(
          `scp -i ${sshKey} -o StrictHostKeyChecking=no ${localEnvFile} ${host}:${remoteEnvFile}`,
          { silent: true },
        )

        // capture output so we can both verify success and surface it on failure.
        let migrationOutput = ''
        try {
          const { stdout } = await run(
            `${ssh} "docker run --rm --env-file ${remoteEnvFile} mtd-web:latest bun src/database/migrate.ts 2>&1"`,
            { captureOutput: true },
          )
          migrationOutput = stdout.trim()
        } catch (err) {
          const out = (err as { cause?: { stdout?: string } })?.cause?.stdout?.trim()
          if (out) console.error(colors.red(out))
          throw err
        }

        if (migrationOutput) console.info(colors.gray(migrationOutput))

        if (!/\[database\] migrations complete/.test(migrationOutput)) {
          throw new Error('migration did not report completion (see output above)')
        }
        console.info('✅ migrations complete')
      } finally {
        await run(`${ssh} "rm -f ${remoteEnvFile}"`, { silent: true }).catch(() => {})
        await fs.promises.unlink(localEnvFile).catch(() => {})
      }
    }

    async function checkPrerequisites(): Promise<{
      DATABASE_URL: string
    }> {
      console.info('📋 checking prerequisites...\n')

      if (!DEPLOY_HOST) {
        throw new Error(
          'DEPLOY_HOST not set\n\nFor local use, run: bun tko onboard\nFor CI, ensure DEPLOY_HOST is in GitHub secrets',
        )
      }

      // derive database URL from DEPLOY_DB
      const deployDb = process.env.DEPLOY_DB
      if (!deployDb) {
        throw new Error(
          'DEPLOY_DB not set\n\nFor uncloud deployment, set DEPLOY_DB in .env.production\nExample: postgresql://user:pass@host:port/dbname?sslmode=require\n\nRun: bun tko onboard to configure',
        )
      }

      const DATABASE_URL = deployDb

      console.info(`✅ database configured`)
      console.info(
        colors.gray(`   host: ${deployDb.split('@')[1]?.split('/')[0] || 'configured'}`),
      )

      console.info(`✅ deploy host: ${DEPLOY_HOST}`)
      console.info(`✅ deploy user: ${DEPLOY_USER}`)
      console.info(`✅ using external managed database`)

      await checkUncloudCLI()
      await checkSSHKey(DEPLOY_SSH_KEY)

      return { DATABASE_URL }
    }

    async function uploadOriginCACertsIfConfigured(
      host: string,
      sshKey: string,
    ): Promise<void> {
      const certPath = process.env.ORIGIN_CA_CERT
      const keyPath = process.env.ORIGIN_CA_KEY

      if (!certPath || !keyPath) {
        return // not configured, use default ACME
      }

      const resolvedCert = path.resolve(process.cwd(), certPath)
      const resolvedKey = path.resolve(process.cwd(), keyPath)

      if (!fs.existsSync(resolvedCert)) {
        console.warn(colors.yellow(`⚠️  origin ca cert not found: ${resolvedCert}`))
        console.warn(colors.gray("   falling back to let's encrypt"))
        return
      }

      if (!fs.existsSync(resolvedKey)) {
        console.warn(colors.yellow(`⚠️  origin ca key not found: ${resolvedKey}`))
        console.warn(colors.gray("   falling back to let's encrypt"))
        return
      }

      console.info('\n🔐 uploading origin ca certificates...')

      try {
        await uploadOriginCACerts(host, sshKey, DEPLOY_USER, resolvedCert, resolvedKey)
        console.info(colors.green('✓ origin ca certificates uploaded'))
        console.info(
          colors.gray('  certs available at /config/certs inside caddy container'),
        )
      } catch (err) {
        console.warn(colors.yellow('⚠️  failed to upload origin ca certs'))
        console.warn(colors.gray(`   ${err instanceof Error ? err.message : err}`))
        console.warn(colors.gray("   falling back to let's encrypt"))
      }
    }

    async function deployCaddyWithTLS(host: string, sshKey: string): Promise<void> {
      const certPath = process.env.ORIGIN_CA_CERT
      const keyPath = process.env.ORIGIN_CA_KEY

      if (!certPath || !keyPath) {
        return // not using origin ca, caddy will use default acme
      }

      const webHost = process.env.VITE_WEB_HOSTNAME
      const apiHost = process.env.VITE_API_HOSTNAME
      // include the api subdomain so origin-ca tls covers api.<domain> too.
      // dedupe: staging mirrors web+api onto the same host.
      const domains = [
        ...new Set([webHost, apiHost].filter((d): d is string => Boolean(d))),
      ]

      if (domains.length === 0) {
        console.warn(
          colors.yellow(
            '⚠️  no custom domains configured (VITE_WEB_HOSTNAME/VITE_API_HOSTNAME)',
          ),
        )
        console.warn(colors.gray("   caddy will use let's encrypt for tls"))
        return
      }

      const caddyfilePath = path.resolve(process.cwd(), 'src/uncloud/Caddyfile')
      await fs.promises.writeFile(caddyfilePath, buildOriginCACaddyfile(domains))
      console.info(colors.gray(`   generated caddyfile for: ${domains.join(', ')}`))

      console.info('\n🔄 deploying caddy with custom tls config...')

      try {
        await run(`echo "y" | uc -c ${context} caddy deploy --caddyfile ${caddyfilePath}`)

        // uncloud auto-generates https:// blocks without tls — patch them for origin ca
        await patchRemoteCaddyfile(host, sshKey, DEPLOY_USER, domains)
        await restartCaddy(host, sshKey, DEPLOY_USER)

        console.info(colors.green('✓ caddy deployed with origin ca certificates'))
      } catch (err) {
        console.warn(colors.yellow('⚠️  failed to deploy caddy with custom config'))
        console.warn(colors.gray(`   ${err instanceof Error ? err.message : err}`))
        console.warn(
          colors.gray(
            '   you may need to run: uc caddy deploy --caddyfile src/uncloud/Caddyfile',
          ),
        )
      }
    }

    console.info(`🎯 deploying mtd to ${target.name}\n`)

    // derive database URLs from DEPLOY_DB
    const { DATABASE_URL } = await checkPrerequisites()

    // api-only targets (staging ships api+worker, no web) don't need the web build
    // and its dist/ output. the api/worker bundles are produced inside the docker
    // image from src/, so skip buildWeb and relax the image's web-dist guard.
    const shipsWeb = target.services.includes('web')

    // build steps
    if (skipBuild) {
      console.info('⏭️  skipping web build (--skip-build)')
    } else if (!shipsWeb) {
      console.info('⏭️  skipping web build (api-only target ships no web app)')
    } else {
      await buildWeb()
    }

    if (!skipDocker) {
      await buildDockerImage({ webDistRequired: shipsWeb })
    } else {
      console.info('⏭️  skipping docker build (--skip-docker)')
    }

    const host = `${DEPLOY_USER}@${DEPLOY_HOST}`

    await testSSHConnection(host, DEPLOY_SSH_KEY)

    const ssh = getSSHCmd(host, DEPLOY_SSH_KEY)

    if (!skipLock) {
      await acquireDeployLock(ssh)
      console.info(colors.gray('  acquired deploy lock'))
    }

    try {
      await tagPreviousImage(host, DEPLOY_SSH_KEY)

      await initUncloud(host, DEPLOY_SSH_KEY, { context })

      // upload origin ca certs AFTER init (cluster reset creates fresh caddy volume)
      await uploadOriginCACertsIfConfigured(host, DEPLOY_SSH_KEY)

      // --skip-docker means "reuse the image already on the cluster" (env-only
      // redeploys). pushing requires a local mtd-web:latest that we deliberately
      // did not build.
      if (skipDocker) {
        console.info('⏭️  skipping image push (--skip-docker; reuse cluster image)')
      } else {
        await pruneUnusedDockerImages(host, DEPLOY_SSH_KEY)
        await pushImage('mtd-web:latest', { context })
      }

      // process environment variables in compose file
      console.info(`\n📝 processing compose file with ${target.name} env...\n`)
      const processedCompose = 'src/uncloud/docker-compose.processed.yml'
      processComposeEnv('src/uncloud/docker-compose.yml', processedCompose, {
        ...(process.env as Record<string, string | undefined>),
        DATABASE_URL,
      })
      // pgdb uses a relative bind mount for local self-hosted-db only. uncloud validates
      // the whole compose file even when deploying web/worker, so strip it for external db.
      if (process.env.DEPLOY_DB && usesExternalDatabase(process.env.DEPLOY_DB)) {
        stripSelfHostedDbFromCompose(processedCompose)
      }

      await gracefulStopWorker(host, DEPLOY_SSH_KEY)
      await gracefulStopPgdb(host, DEPLOY_SSH_KEY)

      await runMigrations(host, DEPLOY_SSH_KEY, {
        DATABASE_URL,
      })

      // deploy the target's services in order. the standalone api service
      // (dist/api.js) runs on its own subdomain; the worker is never recreated
      // in place so in-flight jobs drain. migrations already ran once above.
      for (const service of target.services) {
        await deployStack(processedCompose, {
          service,
          context,
          ...(service === 'worker' ? { recreate: false } : {}),
        })
      }

      // deploy caddy with custom tls config if origin ca certs are configured
      await deployCaddyWithTLS(host, DEPLOY_SSH_KEY)

      await showStatus({ context })

      printDeploySummary(target, DEPLOY_USER, DEPLOY_HOST ?? '')
    } finally {
      if (!skipLock) {
        await releaseDeployLock(ssh)
        console.info(colors.gray('  released deploy lock'))
      }
    }
  })
}
