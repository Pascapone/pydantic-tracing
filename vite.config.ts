import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const isVitest = process.env.VITEST === 'true'

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'resource-auth': fileURLToPath(new URL('./src/lib/mock-resource-auth.ts', import.meta.url)),
    },
  },
  plugins: [
    // devtools(),
    !isVitest &&
      nitro({
        rollupConfig: { external: [/^@sentry\//] },
        // WebSocket enabled for development - production build has Rollup bug
        features: { websocket: true },
      }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ].filter(Boolean),
})

export default config
