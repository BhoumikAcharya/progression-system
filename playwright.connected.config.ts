import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/connected',
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:5174/mock',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'local-test-publishable-key',
    },
  },
  reporter: 'list',
})
