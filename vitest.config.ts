import { defineConfig } from 'vitest/config'

// Standalone config so tests don't load vite.config.ts (which boots the Electron plugin).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
