import {
  createMultipassConfig,
  getVMIP as _getVMIP,
  createVM as _createVM,
  setupVMSSH as _setupVMSSH,
  setupPortForward as _setupPortForward,
} from '@mtd/scripts/helpers/multipass'

export type { MultipassConfig } from '@mtd/scripts/helpers/multipass'
export { checkMultipass } from '@mtd/scripts/helpers/multipass'

const config = createMultipassConfig('mtd-deploy')

export function getVMName(): string {
  return config.vmName
}

export function getVMSSHKey(): string {
  return config.sshKeyPath
}

export async function getVMIP(): Promise<string | null> {
  return _getVMIP(config)
}

export async function createVM(): Promise<void> {
  return _createVM(config)
}

export async function setupVMSSH(): Promise<void> {
  return _setupVMSSH(config)
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
  console.info(`  multipass shell ${config.vmName}   # ssh to vm`)
  console.info('\nto redeploy after changes:')
  console.info('  bun run web build && bun scripts/uncloud/deploy-local.ts')
}
