import { defineConfig } from '@playwright/test'

const PORT = 4179

// The system Edge is used locally; CI installs Chromium instead (PLAYWRIGHT_CHANNEL=chromium).
const channel = process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true,
  // every test downloads and indexes the 4 MB atlas; more browsers than this starve each other
  workers: process.env.CI ? 2 : 4,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}/`, channel: channel === 'chromium' ? undefined : channel },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
})
