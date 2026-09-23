# Chatbot „Frag RETHINK SPACE“ – Backend (Supabase Edge Function)

Stufe 1: Wissensbasis als gecachter Systemprompt, kein Vektorindex.
Der Anthropic-Schlüssel liegt ausschließlich als Supabase-Secret in der Funktion.

## Bestandteile

| Pfad | Zweck |
|---|---|
| `functions/chat/index.ts` | Edge Function: CORS, Rate-Limit, Claude-Aufruf mit Streaming, Protokoll |
| `functions/chat/knowledge.txt` | **Generiert** aus `knowledge/` durch `npm run knowledge` (gitignored); `npm run knowledge:push` lädt sie in `public.chat_knowledge`, von wo die Funktion sie beim Start liest |
| `../scripts/push-knowledge.mjs` | Upload der Wissensbasis per Admin-Login (E-Mail/Passwort aus `.env`: `CMS_ADMIN_PASSWORD`, `SUPABASE_ANON_KEY`) |
| `functions/chat/knowledge/site-facts.md` | Fakten zu Projekt, Seiten, Kontakt, Büchern (von Hand gepflegt) |
| `functions/chat/knowledge/author.md` | Autorenprofil (von Hand gepflegt) |
| `functions/chat/knowledge/books/*.md` | Kondensierte Buchzusammenfassungen (aus den Manuskripten erzeugt) |
| `migrations/20260915120000_chat_log.sql` | Tabelle für das anonymisierte Protokoll |
| Tabelle `public.chat_knowledge` | Wissensbasis (eine Zeile `current`), per Migration `chat_knowledge` im Projekt angelegt |

Die Website-Texte (DE/EN-Wörterbücher) fließen beim Generieren automatisch ein.
Nach jeder Textänderung an der Website oder an `knowledge/`: `npm run knowledge && npm run knowledge:push` (kein Redeploy nötig).

## Einmalig einrichten

1. Supabase-Projekt anlegen (Region EU, z. B. Frankfurt) und CLI installieren: `npm i -g supabase`.
2. Anmelden und Projekt verknüpfen: `supabase login` → `supabase link --project-ref <ref>`.
3. Tabelle anlegen: `supabase db push` (führt die Migration aus).
4. Secrets setzen (nie ins Repo):
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=<Schlüssel aus console.anthropic.com>
   supabase secrets set CHAT_ALLOWED_ORIGINS=https://rethink.space,https://www.rethink.space,http://localhost:3100
   ```
   Optional: `CHAT_MODEL` (Standard `claude-opus-5`), `CHAT_FALLBACK_MODEL` (Standard `claude-opus-4-8`), `CHAT_RATE_LIMIT` (Standard 20 Anfragen je 10 Minuten und IP).
5. Wissensbasis bauen, hochladen und Funktion deployen:
   ```bash
   npm run knowledge && npm run knowledge:push
   supabase functions deploy chat --no-verify-jwt
   ```
   Stand 16.09.2026: im Projekt Re-Think-Space (ref `bdkvdufrdkxezutktzlt`) bereits erledigt; Endpoint `https://bdkvdufrdkxezutktzlt.supabase.co/functions/v1/chat`.
   `--no-verify-jwt`, weil die Website anonym anfragt; Schutz übernehmen Origin-Prüfung und Rate-Limit.
6. Website auf den Endpoint zeigen lassen. Lokal in `.env` (ist gitignored):
   ```
   VITE_CHAT_ENDPOINT=https://<ref>.supabase.co/functions/v1/chat
   ```
   Für den Build in GitHub Actions dieselbe URL als Repository-Variable `VITE_CHAT_ENDPOINT` hinterlegen.
   Ohne Endpoint bleibt das Widget aus.

## Prüfen

```bash
curl -N -X POST https://<ref>.supabase.co/functions/v1/chat \
  -H "Origin: http://localhost:3100" -H "Content-Type: application/json" \
  -d '{"lang":"de","messages":[{"role":"user","content":"Was ist RETHINK SPACE?"}]}'
```
Antwort ist ein SSE-Stream mit `data: {"type":"text","text":"…"}` und abschließend `data: {"type":"done"}`.

## Kosten und Verhalten

- Modell Claude Opus 5, Wissensbasis gemessen rund 48.000 Tokens, über Prompt-Caching (1 h) gelesen: etwa 3 bis 4 Cent je Antwort (Cache-Lesen ca. 2,4 Cent, Ausgabe ca. 1 Cent). Die erste Anfrage nach einer Stunde Pause schreibt den Cache neu (einmalig ca. 30 Cent).
- Fallback: Lehnt das Modell eine Anfrage ab, übernimmt in derselben Anfrage Claude Opus 4.8 (Server-seitiger Fallback).
- Protokoll: Sprache, Frage, Antwort, Modell, Tokenzahlen. Keine IP, kein Nutzerkonto.
- Datenschutz: Die Fragen werden an Anthropic (USA) übermittelt; das Widget weist darauf hin. Datenschutzerklärung entsprechend ergänzen.
