/**
 * Lädt die gebaute Wissensbasis (supabase/functions/chat/knowledge.txt) in die
 * Tabelle public.chat_knowledge hoch. Anmeldung als CMS-Admin (E-Mail/Passwort),
 * kein Service-Role-Key nötig. Aufruf: npm run knowledge:push
 *
 * Variablen (Umgebung oder .env): SUPABASE_URL, SUPABASE_ANON_KEY,
 * CMS_ADMIN_EMAIL (Standard admin@rethink.space), CMS_ADMIN_PASSWORD.
 * SUPABASE_URL wird sonst aus VITE_CHAT_ENDPOINT abgeleitet.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...readEnv(join(ROOT, '.env')), ...process.env };

function readEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
}

const url = env.SUPABASE_URL || (env.VITE_CHAT_ENDPOINT || '').replace(/\/functions\/v1\/.*$/, '');
const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const email = env.CMS_ADMIN_EMAIL || 'admin@rethink.space';
const password = env.CMS_ADMIN_PASSWORD;
const file = join(ROOT, 'supabase/functions/chat/knowledge.txt');

if (!url || !anon || !password) {
  console.error('Fehlt: SUPABASE_URL (oder VITE_CHAT_ENDPOINT), SUPABASE_ANON_KEY, CMS_ADMIN_PASSWORD (Umgebung oder .env).');
  process.exit(1);
}
if (!existsSync(file)) { console.error('knowledge.txt fehlt – zuerst npm run knowledge'); process.exit(1); }

const text = readFileSync(file, 'utf8');
const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) { console.error('Anmeldung fehlgeschlagen:', login.status, await login.text()); process.exit(1); }
const { access_token } = await login.json();

const res = await fetch(`${url}/rest/v1/chat_knowledge?on_conflict=id`, {
  method: 'POST',
  headers: { apikey: anon, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify([{ id: 'current', text, updated_at: new Date().toISOString() }]),
});
if (!res.ok) { console.error('Upload fehlgeschlagen:', res.status, await res.text()); process.exit(1); }
const [row] = await res.json();
console.log(`Wissensbasis hochgeladen: ${row.chars.toLocaleString('de-DE')} Zeichen, Stand ${row.updated_at}`);
