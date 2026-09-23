/**
 * Baut die Wissensbasis des Chatbots: Website-Texte (DE/EN-Wörterbücher),
 * Fakten- und Autorendatei sowie die Buchzusammenfassungen werden zu einem
 * Text zusammengefügt und als supabase/functions/chat/knowledge.txt abgelegt.
 * Danach: npm run knowledge:push lädt den Text in public.chat_knowledge hoch,
 * von wo die Edge Function ihn beim Start liest (kein Redeploy nötig).
 * Aufruf: npm run knowledge
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { EN } from '../src/site/i18n/en.js';
import { DE } from '../src/site/i18n/de.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KDIR = join(ROOT, 'supabase/functions/chat/knowledge');
const OUT = join(ROOT, 'supabase/functions/chat/knowledge.txt');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim() : '');

// 1. Website-Texte: Schlüssel nach Seite gruppiert, EN und DE nebeneinander.
//    Meta-Texte und Navigation sind für Antworten unerheblich.
const skip = /^(nav\.|footer\.|common\.|lightbox\.|chat\.|.*\.meta\.)/;
const groups = new Map();
for (const key of Object.keys(EN)) {
  if (skip.test(key)) continue;
  const page = key.split('.')[0];
  if (!groups.has(page)) groups.set(page, []);
  groups.get(page).push(`- ${key}: EN „${EN[key]}“ | DE „${DE[key] ?? ''}“`);
}
const PAGE_URL = {
  home: '/pages/landing/', vision: '/pages/vision/', design: '/pages/design/', space: '/pages/space/',
  deployment: '/pages/deployment/', dual: '/pages/dual-use/', ip: '/pages/ip/', news: '/pages/news/',
  author: '/pages/autor/', contact: '/pages/kontakt/', legal: '/pages/impressum/', privacy: '/pages/datenschutz/',
};
const siteText = [...groups].map(([page, lines]) =>
  `### Seite „${page}“ (${PAGE_URL[page] ?? 'siehe Navigation'})\n${lines.join('\n')}`).join('\n\n');

// 2. Fakten, Autor, Bücher
const facts = read(join(KDIR, 'site-facts.md'));
const author = read(join(KDIR, 'author.md'));
const booksDir = join(KDIR, 'books');
const books = existsSync(booksDir)
  ? readdirSync(booksDir).filter((f) => f.endsWith('.md')).sort().map((f) => read(join(booksDir, f))).join('\n\n---\n\n')
  : '';

const text = `# Wissensbasis RETHINK SPACE (generiert ${new Date().toISOString().slice(0, 10)})

## Teil 1: Fakten zu Projekt, Website und Kontakt
${facts || '(keine Faktendatei)'}

## Teil 2: Der Autor
${author || '(keine Autorendatei)'}

## Teil 3: Website-Texte (alle Seiten, EN und DE)
${siteText}

## Teil 4: Bücher des Autors (kondensiert)
${books || '(noch keine Buchzusammenfassungen)'}
`;

writeFileSync(OUT, text);
const bookCount = existsSync(booksDir) ? readdirSync(booksDir).filter((f) => f.endsWith('.md')).length : 0;
console.log(`knowledge.txt geschrieben: ${text.length.toLocaleString('de-DE')} Zeichen (ca. ${Math.round(text.length / 3.6).toLocaleString('de-DE')} Tokens), ${groups.size} Seiten, ${bookCount} Bücher`);
