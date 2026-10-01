import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // HTML-Report nur in der CI: auf dem NAS-Share scheitert das Anlegen des Ordners.
  // 'github' schreibt Fehler als Workflow-Annotation. Ohne sie steht die Meldung
  // nur im Joblog, an das weder das CMS noch jemand ohne Admin-Rechte kommt —
  // ein fehlgeschlagenes Veröffentlichen war dann nicht nachvollziehbar.
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    locale: 'de-DE', // Erstbesuch aus deutschem Browser — Sprachtests gehen davon aus
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // Dev-Server-Start vom NAS-Share dauert länger

  },
});
