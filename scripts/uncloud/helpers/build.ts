import { ensureDockerDaemon } from '@mtd/scripts/helpers/ensure-docker'
import { run } from '@mtd/scripts/helpers/run'

export async function buildWeb(): Promise<void> {
  console.info('\n📦 building web app...\n')
  await run('bun tko web build --prod')
  console.info('✅ web build complete')
}

export async function buildDockerImage(
  options: { webDistRequired?: boolean } = {},
  imageName = 'mtd-web:latest',
  platform = process.env.DEPLOYMENT_ARCH || 'linux/amd64',
): Promise<void> {
  const { webDistRequired = true } = options
  console.info('\n🐳 building docker image...\n')
  console.info(`platform: ${platform}`)
  if (!webDistRequired) {
    console.info('api-only image: skipping web dist requirement')
  }
  await ensureDockerDaemon()
  const gitSha = process.env.GIT_SHA || 'unknown'
  await run(
    `docker build --platform ${platform} --build-arg GIT_SHA=${gitSha} --build-arg WEB_DIST_REQUIRED=${webDistRequired} -t ${imageName} .`,
  )
  console.info('✅ docker image built')
}

export async function checkDist(): Promise<boolean> {
  try {
    await run('test -d dist', { silent: true })
    console.info('✅ dist/ directory exists')
    return true
  } catch {
    return false
  }
}
