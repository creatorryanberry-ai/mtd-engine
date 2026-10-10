#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`Deploy to local OrbStack VM`.run(async () => {
  const { buildWeb, buildDockerImage } = await import('./helpers/build')
  const {
    checkOrbstack,
    createVM,
    setupVMSSH,
    getVMHost,
    getVMSSHKey,
    setupPortForward,
    showLocalStatus,
  } = await import('./helpers/orbstack')
  const { checkUncloudCLI, initUncloud, pushImage, deployStack, showStatus } =
    await import('./helpers/uncloud')

  // parse args
  const args = process.argv.slice(2)
  const skipBuild = args.includes('--skip-build')
  const skipDocker = args.includes('--skip-docker')

  console.info('🎯 deploying mtd to local orbstack vm\n')

  await checkOrbstack()
  await checkUncloudCLI()

  if (!skipBuild) {
    await buildWeb()
  } else {
    console.info('⏭️  skipping web build (--skip-build)')
  }

  if (!skipDocker) {
    // local orbstack vm runs the host arch natively (arm64 on apple silicon);
    // build for it to avoid slow cross-arch emulation on the deploy target
    const localPlatform = `linux/${process.arch === 'arm64' ? 'arm64' : 'amd64'}`
    await buildDockerImage({}, 'mtd-web:latest', localPlatform)
  } else {
    console.info('⏭️  skipping docker build (--skip-docker)')
  }

  await createVM()
  await setupVMSSH()

  const host = await getVMHost()
  if (!host) {
    console.error('❌ could not get vm host')
    process.exit(1)
  }

  const sshKey = getVMSSHKey()

  // isolate local deploys in their own context/cluster so we never touch a
  // production 'default' context that may live in the same uncloud config
  const context = 'mtd-local'

  // the /https x-port needs a valid domain to parse; dev env sets
  // ssh port-forward (setupPortForward) + --no-caddy, so the value is cosmetic.
  if (
    !process.env.VITE_WEB_HOSTNAME ||
    process.env.VITE_WEB_HOSTNAME.includes('localhost')
  ) {
    process.env.VITE_WEB_HOSTNAME = 'mtd.local.test'
  }

  // self-hosted-db profile runs the pgdb service in-cluster; point the app at it
  // by service name (dev DATABASE_URL points at 127.0.0.1 which is unreachable
  // from inside the container network)
  // uncloud exposes services on the cluster network as <service>.internal
  const pgUser = process.env.POSTGRES_USER || 'user'
  const pgPass = process.env.POSTGRES_PASSWORD || 'password'
  const pgDb = process.env.POSTGRES_DB || 'postgres'
  process.env.DATABASE_URL = `postgresql://${pgUser}:${pgPass}@pgdb.internal:5432/${pgDb}`

  await initUncloud(host, sshKey, {
    noDNS: true,
    noCaddy: true,
    context,
    publicIp: 'none',
  })
  await pushImage('mtd-web:latest', { context })

  // deploy the database first so the app services can resolve it on startup
  // (pg-boss/worker exit if the db host is unreachable). pgdb rarely changes so
  // skip recreate; web/worker recreate to pick up the new :latest image
  const compose = 'src/uncloud/docker-compose.yml'
  await deployStack(compose, {
    profile: 'self-hosted-db',
    context,
    service: 'pgdb',
    recreate: false,
  })
  await deployStack(compose, { profile: 'self-hosted-db', context, service: 'web' })
  await deployStack(compose, { profile: 'self-hosted-db', context, service: 'worker' })

  await setupPortForward()
  await showStatus({ context })
  await showLocalStatus()
})
