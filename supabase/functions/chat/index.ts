// Supabase Edge Function „chat“ – RETHINK SPACE Chatbot, Stufe 1.
// Hält den Anthropic-Schlüssel (Secret ANTHROPIC_API_KEY), prüft Herkunft und
// Rate, lädt die Wissensbasis aus public.chat_knowledge (Service-Rolle), ruft
// Claude mit gecachtem Systemprompt auf und streamt die Antwort als
// Server-Sent Events an das Widget (src/site/modules/chat.js).
// Deploy: supabase functions deploy chat --no-verify-jwt   (siehe supabase/README.md)
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = Deno.env.get("CHAT_MODEL") ?? "claude-opus-5";
const FALLBACK_MODEL = Deno.env.get("CHAT_FALLBACK_MODEL") ?? "claude-opus-4-8";
const ALLOWED_ORIGINS = (Deno.env.get("CHAT_ALLOWED_ORIGINS") ??
  "https://rethink.space,https://www.rethink.space,https://rainerschulz.github.io," +
  "http://localhost:3100,http://127.0.0.1:3100,http://localhost:3199,http://localhost:4173")
  .split(",").map((s) => s.trim()).filter(Boolean);
const RATE_LIMIT = Number(Deno.env.get("CHAT_RATE_LIMIT") ?? 20);      // Anfragen …
const RATE_WINDOW_MS = 10 * 60 * 1000;                                   // … je 10 Minuten und IP
const MAX_MESSAGES = 16;
const MAX_CHARS = 1500;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const RULES = `Du bist der Assistent der Website RETHINK SPACE von Dr. Karl Johannes Lierfeld.
Du beantwortest Fragen zum Projekt (Mond-Habitate, Design, Technik, Deployment, Dual-Use, IP), zum Autor und zu seinen Büchern.

Regeln:
- Antworte ausschließlich auf Basis der Wissensbasis unten. Wenn etwas dort nicht steht, sag das offen und verweise auf die Kontaktseite /pages/kontakt/ oder die E-Mail-Adresse.
- Erfinde keine Fakten, Zahlen, Daten, Partner oder Zitate. Angaben aus Projektmaterial des Inhabers kennzeichnest du als Angaben des Projekts.
- Zitiere aus Büchern höchstens einen Satz und verweise für mehr auf das Buch (Amazon-Link aus der Wissensbasis).
- Fragen außerhalb von RETHINK SPACE, dem Autor und seinen Themen lehnst du freundlich in einem Satz ab und bietest an, zu diesen Themen zu helfen.
- Keine medizinische, rechtliche oder finanzielle Beratung, keine personenbezogenen Daten über Dritte.
- Antworte knapp: meist 2 bis 6 Sätze, bei Aufzählungen kurze Zeilen. Reiner Text ohne Markdown, keine Sternchen, keine Überschriften.
- Verweise auf passende Seiten immer als Pfad in dieser Form: /pages/vision/ /pages/design/ /pages/space/ /pages/deployment/ /pages/dual-use/ /pages/ip/ /pages/news/ /pages/autor/ /pages/kontakt/
- Du bist eine KI; gib dich nicht als Person aus. Bei Fragen nach Kontakt oder Zusammenarbeit verweise auf /pages/kontakt/.`;

const LANG_HINT: Record<string, string> = {
  de: "Antworte in der Sprache, in der die Frage gestellt ist. Ist sie nicht erkennbar, antworte auf Deutsch (Sie-Form).",
  en: "Answer in the language the question is written in. If unclear, answer in English.",
};

type Msg = { role: "user" | "assistant"; content: string };

/** Wissensbasis je Isolate laden (Service-Rolle umgeht RLS), höchstens 5 Minuten
 *  alt – so wirkt ein "npm run knowledge:push" ohne Redeploy. */
let knowledge: string | null = null;
let knowledgeAt = 0;
const KNOWLEDGE_TTL_MS = 5 * 60 * 1000;
async function loadKnowledge(): Promise<string> {
  if (knowledge && Date.now() - knowledgeAt < KNOWLEDGE_TTL_MS) return knowledge;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/chat_knowledge?id=eq.current&select=text`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`knowledge http ${res.status}`);
  const rows = (await res.json()) as { text: string }[];
  const text = rows[0]?.text?.trim();
  if (!text) throw new Error("knowledge missing – npm run knowledge:push ausführen");
  knowledge = text;
  knowledgeAt = Date.now();
  return text;
}

/** Verlauf prüfen: abwechselnde Rollen, beginnt und endet mit user, Längen begrenzt. */
function sanitize(input: unknown): Msg[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) return null;
  const out: Msg[] = [];
  for (const m of input) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.trim().slice(0, MAX_CHARS);
    if (!content) return null;
    if (out.length && out[out.length - 1].role === m.role) return null;
    out.push({ role: m.role, content });
  }
  if (out[0].role !== "user" || out[out.length - 1].role !== "user") return null;
  return out;
}

const buckets = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) return true;
  hits.push(now);
  buckets.set(ip, hits);
  return false;
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

/** Anonymisiertes Protokoll (ohne IP) in public.chat_log; Fehler werden ignoriert. */
async function logExchange(row: Record<string, unknown>): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/chat_log`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin_not_allowed" }, 403, cors);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return json({ error: "rate_limited" }, 429, cors);

  let body: { lang?: string; messages?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const lang = body.lang === "de" ? "de" : "en";
  const messages = sanitize(body.messages);
  if (!messages) return json({ error: "invalid_messages" }, 400, cors);

  let base: string;
  try { base = await loadKnowledge(); } catch (err) {
    console.error("knowledge", err instanceof Error ? err.message : err);
    return json({ error: "knowledge_unavailable" }, 503, cors);
  }

  // Cache-Präfix: Regeln und Wissensbasis sind stabil (Breakpoint auf der
  // Wissensbasis), der Sprachhinweis variiert und kommt danach.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: FALLBACK_MODEL }],
    system: [
      { type: "text", text: RULES },
      { type: "text", text: base, cache_control: { type: "ephemeral", ttl: "1h" } },
      { type: "text", text: LANG_HINT[lang] },
    ],
    messages,
    output_config: { effort: "medium" },
  });

  const enc = new TextEncoder();
  let answer = "";
  const out = new ReadableStream({
    async start(ctrl) {
      const send = (ev: Record<string, unknown>) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            answer += ev.delta.text;
            send({ type: "text", text: ev.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !answer) {
          const note = lang === "de"
            ? "Diese Frage kann ich hier nicht beantworten. Bitte wenden Sie sich über /pages/kontakt/ an uns."
            : "I cannot answer that here. Please reach out via /pages/kontakt/.";
          answer = note;
          send({ type: "text", text: note });
        }
        send({ type: "done" });
        await logExchange({
          lang,
          question: messages[messages.length - 1].content,
          answer,
          model: final.model,
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          cache_read_tokens: final.usage.cache_read_input_tokens ?? 0,
        });
      } catch (err) {
        console.error("chat upstream error", err instanceof Error ? err.message : err);
        send({ type: "error", message: "upstream" });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(out, {
    headers: { ...cors, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
});
