import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // vmThreads statt forks/threads: auf dem NAS-Share (W:) dauert das Laden
    // der Worker-Module über SMB so lange, dass forks und threads in Vitests
    // festen Start-Timeout (60 s) laufen. vmThreads startet zuverlässig
    // (gemessen 15.09.2026: happy-dom-Import allein 69 s vom Share).
    pool: 'vmThreads',
    fileParallelism: false,
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/vitest.setup.js'],
    include: ['tests/unit/**/*.test.js'],
    // Vite laedt .env auch im Test. Ohne diese Ueberschreibung liefe der
    // Test gegen den echten Endpoint statt gegen den Fall "nicht gesetzt".
    env: { VITE_CONTACT_ENDPOINT: '', VITE_CHAT_ENDPOINT: '', VITE_GATE_HASH: '' },
  },
});
