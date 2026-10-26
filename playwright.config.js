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
  // CI: das vorinstallierte Google Chrome des GitHub-Runners (PW_CHANNEL=chrome) — kein Download, kein apt.
  // Die Installation mit --with-deps hing am 01.10. und 26.10.2026 in apt und hielt das Veröffentlichen auf.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // Dev-Server-Start vom NAS-Share dauert länger

  },
});
