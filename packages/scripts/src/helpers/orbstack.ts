import { sleep } from '@mtd/helpers'

import { run } from './run'

export interface OrbstackConfig {
  vmName: string
  sshKeyPath: string
  distro: string
}

// orbstack manages its own ssh keypair for linux machines
const ORB_SSH_KEY = `${process.env.HOME}/.orbstack/ssh/id_ed25519`

export function createOrbstackConfig(name: string, sshKeyPath?: string): OrbstackConfig {
  return {
    vmName: name,
    sshKeyPath: sshKeyPath || ORB_SSH_KEY,
    distro: 'ubuntu',
  }
}

export async function checkOrbstack(): Promise<void> {
  try {
    await run('orb version', { silent: true })
    console.info('✅ orbstack installed')
  } catch {
    throw new Error(
      'orbstack not found - install: brew install --cask orbstack (or https://orbstack.dev)',
    )
  }
}

interface OrbInfo {
  state: string | null
  ip: string | null
  user: string | null
}

async function getVMInfo(config: OrbstackConfig): Promise<OrbInfo> {
  try {
    const { stdout } = await run(`orbctl info ${config.vmName} --format json`, {
      silent: true,
      captureOutput: true,
    })
    const data = JSON.parse(stdout)
    return {
      state: data.record?.state ?? null,
      ip: data.ip4 ?? null,
      user: data.record?.config?.default_username ?? null,
    }
  } catch {
    return { state: null, ip: null, user: null }
  }
}

export async function getVMIP(config: OrbstackConfig): Promise<string | null> {
  return (await getVMInfo(config)).ip
}

export async function getVMUser(config: OrbstackConfig): Promise<string> {
  return (await getVMInfo(config)).user || process.env.USER || 'ubuntu'
}

// orbstack machines don't run a standard sshd, but uncloud connects over raw ssh.
// install + enable openssh-server so the machine behaves like a normal vm.
async function ensureSSHServer(config: OrbstackConfig): Promise<void> {
  console.info('ensuring sshd is running in machine...')
  await run(
    `orb -m ${config.vmName} sudo bash -c 'export DEBIAN_FRONTEND=noninteractive; ` +
      `if ! systemctl is-active --quiet ssh; then ` +
      `apt-get update -qq && apt-get install -y -qq openssh-server >/dev/null 2>&1; ` +
      `systemctl enable --now ssh; fi'`,
    { silent: true },
  )
}

async function waitUntilRunning(config: OrbstackConfig): Promise<void> {
  console.info('\n⏳ waiting for vm to be ready...')

  let attempts = 0
  while (attempts < 60) {
    const info = await getVMInfo(config)
    if (info.state === 'running' && info.ip) {
      break
    }
    await sleep(2000)
    attempts++
  }

  const info = await getVMInfo(config)
  if (info.state !== 'running' || !info.ip) {
    throw new Error(
      `vm '${config.vmName}' not ready (state: ${info.state ?? 'missing'}). run: bun tko uncloud clean && bun tko uncloud deploy-local`,
    )
  }

  console.info('✅ vm ready')
}

export async function createVM(config: OrbstackConfig): Promise<void> {
  console.info('\n🖥️  creating orbstack vm...\n')

  const info = await getVMInfo(config)

  if (info.state === 'running') {
    console.info(`✅ vm '${config.vmName}' already running`)
  } else if (info.state === 'stopped') {
    console.info(`starting stopped vm '${config.vmName}'...`)
    await run(`orbctl start ${config.vmName}`)
    await waitUntilRunning(config)
  } else {
    await run(`orb create ${config.distro} ${config.vmName}`)
    await waitUntilRunning(config)
  }

  await ensureSSHServer(config)
}

export async function setupVMSSH(config: OrbstackConfig): Promise<void> {
  console.info('\n🔑 setting up ssh...\n')

  // orbstack ships a machine keypair; reuse its public key for uncloud's raw ssh
  const { stdout: pubKey } = await run(`cat ${config.sshKeyPath}.pub`, {
    silent: true,
    captureOutput: true,
  })

  // add the key via orb exec so it works before/independent of sshd
  await run(
    `orb -m ${config.vmName} bash -c 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && ` +
      `grep -qxF "${pubKey.trim()}" ~/.ssh/authorized_keys 2>/dev/null || ` +
      `echo "${pubKey.trim()}" >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys'`,
    { silent: true },
  )

  // verify raw ssh connectivity (uncloud relies on it)
  const ip = await getVMIP(config)
  const user = await getVMUser(config)
  let ok = false
  for (let i = 0; i < 15; i++) {
    try {
      await run(
        `ssh -i ${config.sshKeyPath} -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=5 ${user}@${ip} true`,
        { silent: true },
      )
      ok = true
      break
    } catch {
      await sleep(2000)
    }
  }
  if (!ok) {
    throw new Error(`could not establish ssh to ${user}@${ip}`)
  }

  console.info('✅ ssh key configured')
}

export async function setupPortForward(
  config: OrbstackConfig,
  ports: { local: number; containerName: string; containerPort: number }[],
): Promise<void> {
  console.info('\n🌐 setting up port forwarding...\n')

  const ip = await getVMIP(config)
  if (!ip) {
    console.error('❌ could not get vm ip')
    return
  }
  const user = await getVMUser(config)

  const forwards: string[] = []
  for (const { local, containerName, containerPort } of ports) {
    const { stdout: containerIP } = await run(
      `orb -m ${config.vmName} sudo docker inspect $(orb -m ${config.vmName} sudo docker ps -q -f name=${containerName}) -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`,
      { silent: true, captureOutput: true },
    )
    console.info(`${containerName} container: ${containerIP.trim()}:${containerPort}`)
    forwards.push(`-L ${local}:${containerIP.trim()}:${containerPort}`)
  }

  // kill any existing port forwards for this vm
  try {
    await run(`pkill -f "ssh.*${ip}"`, { silent: true })
  } catch {
    // ignore if none found
  }

  for (const { local, containerName, containerPort } of ports) {
    console.info(`forwarding localhost:${local} -> ${containerName}:${containerPort}`)
  }

  await run(
    `ssh -i ${config.sshKeyPath} -o StrictHostKeyChecking=no -f -N ${forwards.join(' ')} ${user}@${ip}`,
    { silent: true },
  )

  console.info('✅ port forwarding active')
}

export async function deleteVM(config: OrbstackConfig): Promise<void> {
  await run(`orbctl delete ${config.vmName}`, { silent: true })
}
