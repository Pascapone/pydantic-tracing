import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['e2e/**', 'python-workers/**', 'node_modules/**', 'dist/**', '.output/**'],
      passWithNoTests: true,
    },
  }),
)
