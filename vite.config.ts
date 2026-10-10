import { tamaguiAliases, tamaguiPlugin } from '@tamagui/vite-plugin'
import { autoWarmPlugin, one } from 'one/vite'
import { visualizer } from 'rollup-plugin-visualizer'

import type { UserConfig } from 'vite'

export default {
  resolve: {
    alias: [
      // much smaller bundle size on web
      ...tamaguiAliases({
        rnwLite: 'without-animated',
        svg: true,
      }),
    ],
  },

  server: {
    allowedHosts: ['host.docker.internal'],
  },

  optimizeDeps: {
    include: ['async-retry'],

    // @hot-updater/cli-tools contains native .node binaries (oxc-transform)
    // that esbuild can't handle - exclude from optimization
    exclude: [
      '@hot-updater/cli-tools',
      'qrcode-terminal',
      'oxc-parser',
      // Flow sources — rolldown cannot parse them during web dep optimize
      '@react-native-community/datetimepicker',
      // we are avoiding reanimated on web - for many apps this may not be desirable
      // if you can live with motion/tamagui animations + one-off CSS, then its simpler
      // 'react-native-reanimated',
    ],
  },

  ssr: {
    // we set this as it generally improves compatability by optimizing all deps for node
    noExternal: true,
    external: [
      'retext',
      'retext-smartypants',
      // og image generation - native node addons
      '@resvg/resvg-js',
      'satori',
      // rolldown tree-shaking bug: drops AlgorithmId from @smithy re-exports
      // vite SSR also fails resolving extensionless aws-sdk ESM (arn → arn.js)
      '@aws-sdk/client-s3',
      '@aws-sdk/lib-storage',
      '@aws-sdk/s3-request-presigner',
      '@aws-sdk/core',
      '@aws-sdk/credential-provider-node',
      // CJS — breaks when Vite SSR inlines it (exports is not defined)
      '@google-cloud/storage',
      'google-auth-library',
      'google-logging-utils',
      'gcp-metadata',
      'gtoken',
      // rolldown tree-shaking bug: with sideEffects:false, rolldown drops
      // motion-dom/scale-border-radius.mjs (defines correctBorderRadius) while
      // keeping scale-correction.mjs that references it. externalizing avoids
      // the broken bundling and lets node resolve the correct import chain.
      // motion is no-oped on SSR anyway (Configuration disableSSR in app layout)
      'framer-motion',
      'motion-dom',
      'motion-utils',
      // CJS SDK — breaks when Vite SSR inlines it (exports is not defined)
      'postmark',
      // better-auth core pulls in opentelemetry CJS — breaks Vite SSR eval
      '@opentelemetry/semantic-conventions',
      '@better-auth/core',
      'better-auth',
      'better-auth/plugins',
      '@better-auth/expo',
      '@react-native-community/datetimepicker',
      // job queue: its cron-parser dep is CJS and breaks Vite SSR eval (exports is not defined)
      'pg-boss',
      'cron-parser',
    ],
  },

  plugins: [
    // learns which deps you need optimized so dev mode gets faster
    autoWarmPlugin('./warm-deps.generated.json'),

    tamaguiPlugin(
      // see tamagui.build.ts for configuration
      // this is what lets us nicely do commands like `bun tamagui generate-css`
    ),

    one({
      patches: {
        // vxrn metro overrides sourceExts and breaks .native.ts resolution from src/.
        // use prebuilt lib output instead (has bundleMode.native.js etc).
        'react-native-worklets': {
          'package.json': (contents) =>
            contents
              ?.replace(
                '"react-native": "./src/index"',
                '"react-native": "./lib/module/index"',
              )
              .replace('"source": "./src/index"', '"source": "./lib/module/index"'),
        },
        // better-auth's createDynamicPathProxy returns a recursive proxy for
        // unknown keys instead of undefined. react 19.2 / rn 0.83 introspect
        // objects ($$typeof, constructor, etc) triggering fake API calls and
        // 404 loops on native. fix: return undefined when path doesn't exist
        // in routes. see: better-auth/better-auth#6938
        // better-auth's proxy returns recursive proxies for ALL property access,
        // including introspection keys ($$typeof, constructor, toJSON). react 19.2
        // / rn 0.83 introspect objects more aggressively, triggering fake API calls.
        // extend existing then/catch/finally guard with common introspection keys.
        // see: better-auth/better-auth#6938
        'better-auth': {
          'dist/shared/better-auth.RKafzlkP.mjs': (contents) =>
            contents?.replace(
              'if (prop === "then" || prop === "catch" || prop === "finally")',
              'if (prop === "then" || prop === "catch" || prop === "finally" || prop === "$$$$typeof" || prop === "constructor" || prop === "toJSON" || prop === "nodeType")',
            ),
          'dist/shared/better-auth.8HJ5v58s.cjs': (contents) =>
            contents?.replace(
              'if (prop === "then" || prop === "catch" || prop === "finally")',
              'if (prop === "then" || prop === "catch" || prop === "finally" || prop === "$$$$typeof" || prop === "constructor" || prop === "toJSON" || prop === "nodeType")',
            ),
        },
      },

      setupFile: {
        client: './src/setupClient.ts',
        native: './src/setupNative.ts',
        server: './src/setupServer.ts',
      },

      react: {
        compiler: process.env.NODE_ENV === 'production',
      },

      native: {
        bundler: 'metro',
        bundlerOptions: {
          watchman: false, // had some slowness
          babelConfigOverrides: (config) => {
            const reserved = new Set([
              'babel-plugin-react-compiler',
              'hot-updater/babel-plugin',
            ])
            const basePlugins = (config?.plugins || []).filter((plugin) => {
              const name = Array.isArray(plugin) ? plugin[0] : plugin
              return !reserved.has(name)
            })

            return {
              ...config,
              plugins: [
                // React Compiler for automatic memoization - must run first
                'babel-plugin-react-compiler',
                ...basePlugins,
                // Hot Updater (React Native OTA solution)
                'hot-updater/babel-plugin',
                // worklets/reanimated are added by babel-preset-expo when installed.
                // reanimated/plugin re-exports worklets/plugin — do not add either here.
              ],
            }
          },
        },
      },

      router: {
        experimental: {
          typedRoutesGeneration: 'runtime',
        },
      },

      web: {
        // ONE_DEPLOY_TARGET=vercel emits .vercel/output (see scripts/vercel/build.ts)
        ...(process.env.ONE_DEPLOY_TARGET === 'vercel'
          ? { deploy: 'vercel' as const }
          : {}),
        experimental_scriptLoading: 'after-lcp-aggressive',
        inlineLayoutCSS: true,
        defaultRenderMode: 'spa',
        sitemap: {
          priority: 0.5,
          changefreq: 'weekly',
          exclude: [
            '/login/**',
            '/signup/**',
            '/profile-setup',
            '/avatar-setup',
            '/settings/**',
          ],
        },
      },

      build: {
        api: {
          config: {
            build: {
              rollupOptions: {
                external: [
                  'better-auth',
                  'better-auth/plugins',
                  'sharp',
                  '@aws-sdk/client-s3',
                  '@aws-sdk/lib-storage',
                  '@aws-sdk/s3-request-presigner',
                ],
              },
            },
          },
        },
      },
    }),

    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: 'bundle_stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true,
            emitFile: true,
          }),
          visualizer({
            filename: 'bundle_stats.json',
            template: 'raw-data',
            gzipSize: true,
            brotliSize: true,
            emitFile: true,
          }),
        ]
      : []),
  ],
} satisfies UserConfig
