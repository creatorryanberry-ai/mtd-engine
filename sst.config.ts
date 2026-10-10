/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Note: this is example configuration we pulled from a working
 * real world app. It's not been updated in a while and would need work
 * to get back into proper shape. We've included it here as it should
 * save significant time at least to see a somewhat validated example.
 */

export default $config({
  async app(input) {
    const { APP_NAME_LOWERCASE } = await import('./src/constants/app')

    return {
      name: APP_NAME_LOWERCASE,
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        cloudflare: '6.2.0',
        aws: {
          region: 'us-west-1',
          profile: input.stage === 'production' ? 'tamagui-prod' : 'tamagui-dev',
        },
        command: '1.0.2',
      },
    }
  },

  async run() {
    const { execSync } = await import('node:child_process')
    const { loadEnv } = await import('@mtd/scripts/helpers/env-load')
    const { DOMAIN } = await import('./src/constants/app')
    const stage = $dev ? 'development' : 'production'

    const { ONE_SERVER_URL } = process.env
    if (!ONE_SERVER_URL) {
      throw new Error(`Missing ONE_SERVER_URL`)
    }
    if (stage === 'production' && ONE_SERVER_URL.includes('localhost')) {
      throw new Error(`Invalid ONE_SERVER_URL for production: ${ONE_SERVER_URL}`)
    }

    console.info(`ONE_SERVER_URL ${ONE_SERVER_URL}`)

    const serverEnv = {
      ...(await loadEnv(stage, {
        optional: ['DATABASE_URL'],
      })),
      ONE_SERVER_URL,
    }

    const domain = DOMAIN

    // VPC Configuration
    const vpc = new sst.aws.Vpc(`VPC`, {
      // allows tunnel into the vpc, about ~$3/mo ec2 micro
      bastion: true,
      // allows lambda functions
      // bug https://github.com/sst/sst/issues/5657
      nat: 'ec2',
    })

    // ECS Cluster
    const cluster = new sst.aws.Cluster(`Cluster`, {
      vpc,
      transform: {
        cluster: {
          settings: [
            {
              name: 'containerInsights',
              value: 'enhanced',
            },
          ],
        },
      },
    })

    // Postgres
    const database = new sst.aws.Aurora(`Postgres2`, {
      vpc,
      engine: 'postgres',
      database: 'postgres',
      version: '16.8',
      scaling: {
        min: '0 ACU',
        max: '4 ACU',
      },
      transform: {
        cluster: {
          backupRetentionPeriod: 7,
          preferredBackupWindow: '03:00-04:00',
          deletionProtection: true,
          finalSnapshotIdentifier: $interpolate`${$app.name}-${$app.stage}-postgres-final-${Date.now()}`,
        },
        clusterParameterGroup: {
          parameters: [
            {
              name: 'rds.logical_replication',
              value: '1',
              applyMethod: 'pending-reboot',
            },
            {
              name: 'max_slot_wal_keep_size',
              value: '10240',
              applyMethod: 'pending-reboot',
            },
            {
              name: 'log_statement',
              value: 'ddl',
              applyMethod: 'pending-reboot',
            },
            {
              name: 'log_min_duration_statement',
              value: '1000',
              applyMethod: 'pending-reboot',
            },
            {
              name: 'max_connections',
              value: '100',
              applyMethod: 'pending-reboot',
            },
            {
              name: 'idle_session_timeout',
              value: '35000',
              applyMethod: 'pending-reboot',
            },
            {
              name: 'shared_preload_libraries',
              value: 'pg_stat_statements',
              applyMethod: 'pending-reboot',
            },
          ],
        },
      },
    })

    const pgConnectString = $interpolate`postgres://${database.username}:${database.password}@${database.host}:${database.port}`
    const pgDefaultDBConnectString = $interpolate`${pgConnectString}/${database.database}`

    const dbEnv = {
      DATABASE_URL: pgDefaultDBConnectString,
    }

    // Shared Environment
    const commonEnv = {
      ...serverEnv,
      ...dbEnv,
      BETTER_AUTH_URL: `https://${DOMAIN}`,
      GIT_SHA: execSync('git rev-parse HEAD').toString().trim(),
    }

    const gitSha = execSync(`git rev-parse HEAD`).toString()

    const image = process.env.WEB_APP_DOCKER_IMAGE
    console.info(`web app image:`, image)

    // web app
    const webApp = new sst.aws.Service(`WebApp`, {
      cluster,
      image: image || {
        context: '.',
      },
      architecture: 'arm64',
      cpu: '4 vCPU',
      memory: '8 GB',
      capacity: 'spot',
      link: [database],
      scaling: {
        min: 1,
        max: 1,
      },
      environment: {
        ...commonEnv,
        GIT_SHA: gitSha,
        NODE_OPTIONS: '--max-old-space-size=6144',
      },
      health: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8081/api/health || exit 1'],
        interval: '10 seconds',
        retries: 8,
        startPeriod: '300 seconds',
      },
      logging: {
        retention: '2 weeks',
      },
      serviceRegistry: {
        port: 8081,
      },
      loadBalancer: {
        public: true,
        health: {
          '8081/http': {
            path: '/api/health',
            interval: '10 seconds',
          },
        },
        domain: $dev
          ? undefined
          : {
              name: domain,
              dns: sst.cloudflare.dns(),
            },
        rules: [
          {
            listen: '80/http',
            forward: '8081/http',
          },
          ...(!$dev
            ? ([
                {
                  listen: '443/https',
                  forward: '8081/http',
                },
              ] as const)
            : []),
        ],
      },
    })

    // job runner
    // TODO
    // const jobRunner = $dev
    //   ? null
    //   : new sst.aws.Service(`JobRunner`, {
    //       cluster,
    //       image: image || {
    //         context: '.',
    //       },
    //       cpu: '0.5 vCPU',
    //       memory: '1 GB',
    //       capacity: 'spot',
    //       architecture: 'arm64',
    //       link: [database],
    //       environment: {
    //         ...commonEnv,
    //         NODE_ENV: 'production',
    //       },
    //       dev: {
    //         command: 'bun run src/jobs/index.ts',
    //       },
    //       scaling: {
    //         min: 1,
    //         max: 1,
    //       },
    //       logging: {
    //         retention: '2 weeks',
    //       },
    //       transform: {
    //         taskDefinition: (args) => {
    //           args.containerDefinitions = args.containerDefinitions?.map((container) => ({
    //             ...container,
    //             command: ['bun', 'run', 'src/jobs/index.ts'],
    //           }))
    //         },
    //       },
    //     })

    // pg-boss job worker
    const jobRunner = $dev
      ? null
      : new sst.aws.Service(`JobRunner`, {
          cluster,
          image: image || {
            context: '.',
          },
          cpu: '0.5 vCPU',
          memory: '1 GB',
          capacity: 'spot',
          architecture: 'arm64',
          link: [database],
          environment: {
            ...commonEnv,
            NODE_ENV: 'production',
          },
          command: ['bun', 'run', 'src/jobs/worker.ts'],
          scaling: {
            min: 1,
            max: 1,
          },
          logging: {
            retention: '2 weeks',
          },
        })

    if (!jobRunner && !$dev) {
      throw new Error(`Job runner failed to create`)
    }

    // lambda can't access AWS_ stuff for some reason so remove it:
    const {
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      // lets also remove this huge key we dont need for migrations, lambda 4kb limit
      CHAT_GITHUB_APP_PRIVATE_KEY,
      ...lambdaEnv
    } = commonEnv

    // we moved away from pre-building our migrator as we found it cumbersome
    // to have a full-on vite build we manage, instead we've moved to bun
    // but you'd need to figure this out again for SST/AWS, likely avoid lambda.
    const migrator = new sst.aws.Function('PostgresMigrator', {
      vpc,
      link: [database, webApp],
      handler: 'src/database/migrate.main',
      runtime: 'nodejs22.x',
      environment: {
        ...lambdaEnv,
        CHAT_GITHUB_APP_PRIVATE_KEY: '', // avoid undefined error
      },
      timeout: `900 seconds`,
    })

    new aws.lambda.Invocation('PostgresMigratorInvocation', {
      input: Date.now().toString(),
      functionName: migrator.name,
    })
  },
})
