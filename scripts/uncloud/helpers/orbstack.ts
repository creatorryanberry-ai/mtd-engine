import {
  createOrbstackConfig,
  getVMIP as _getVMIP,
  getVMUser as _getVMUser,
  createVM as _createVM,
  setupVMSSH as _setupVMSSH,
  setupPortForward as _setupPortForward,
  deleteVM as _deleteVM,
} from '@mtd/scripts/helpers/orbstack'

export type { OrbstackConfig } from '@mtd/scripts/helpers/orbstack'
export { checkOrbstack } from '@mtd/scripts/helpers/orbstack'

const config = createOrbstackConfig('mtd-deploy')

export function getVMName(): string {
  return config.vmName
}

export function getVMSSHKey(): string {
  return config.sshKeyPath
}

export async function getVMIP(): Promise<string | null> {
  return _getVMIP(config)
}

export async function getVMHost(): Promise<string | null> {
  const ip = await _getVMIP(config)
  if (!ip) return null
  const user = await _getVMUser(config)
  return `${user}@${ip}`
}

export async function createVM(): Promise<void> {
  return _createVM(config)
}

export async function setupVMSSH(): Promise<void> {
  return _setupVMSSH(config)
}

export async function deleteVM(): Promise<void> {
  return _deleteVM(config)
}

export async function setupPortForward(): Promise<void> {
  return _setupPortForward(config, [
    { local: 8081, containerName: 'web', containerPort: 8081 },
  ])
}

export async function showLocalStatus(): Promise<void> {
  const ip = await getVMIP()

  console.info('\n🎉 deployment ready!')
  console.info('\naccess your app:')
  console.info('  web app:     http://localhost:8081')
  if (ip) {
    console.info(`  vm ip:       ${ip}`)
  }
  console.info('\nuseful commands:')
  console.info('  uc ls                              # list services')
  console.info('  uc logs web                        # view web logs')
  console.info('  uc logs web -f                     # follow web logs')
  console.info(`  orb -m ${config.vmName} bash       # ssh to vm`)
  console.info('\nto redeploy after changes:')
  console.info('  bun run web build && bun scripts/uncloud/deploy-local.ts')
}
