/**
 * Veröffentlichten Stand im CMS vermerken (letzter Schritt von content.yml).
 *
 *   node scripts/record-publish.mjs <snapshot.json>
 *
 * Die Datei schreibt scripts/apply-content.mjs (Umgebungsvariable
 * CMS_SNAPSHOT_FILE) mit genau dem, was übernommen wurde. Dieses Skript legt
 * sie erst NACH Prüfung und Push als Zeile in cms_publishes ab — scheitert
 * vorher etwas, bleibt im CMS alles als „noch nicht online“ markiert.
 *
 * Braucht SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY (GitHub-Secret).
 */
import { readFileSync, existsSync } from 'fs';

const file = process.argv[2] ?? process.env.CMS_SNAPSHOT_FILE;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!file || !existsSync(file)) {
  console.error(`Kein Stand zum Vermerken (${file ?? 'CMS_SNAPSHOT_FILE fehlt'}).`);
  process.exit(1);
}
if (!url || !key) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY fehlen.');
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(file, 'utf8'));
const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
const runUrl = GITHUB_RUN_ID ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : null;

const res = await fetch(`${url}/rest/v1/cms_publishes`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ source: 'content.yml', run_url: runUrl, snapshot }),
});
if (!res.ok) {
  console.error(`Vermerken fehlgeschlagen: HTTP ${res.status} ${await res.text()}`);
  // Rot statt still: sonst zeigte das CMS veröffentlichte Änderungen weiter als offen.
  process.exit(1);
}
console.log(`Im CMS als veröffentlicht vermerkt: ${Object.keys(snapshot.pages ?? {}).length} Seiten${runUrl ? ` (${runUrl})` : ''}.`);
