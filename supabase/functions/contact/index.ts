// Supabase Edge Function „contact“ — nimmt das Kontaktformular der Website an.
//
// Die Anfrage landet in public.contact_messages. Ist zusaetzlich ein
// Mailserver hinterlegt (SMTP_HOST/PORT/USER/PASS, eigener Server — kein
// Resend, Inhaber 28.10.2026), geht eine Benachrichtigung an CONTACT_TO raus. Ohne Versanddienst geht nichts verloren:
// die Anfrage steht in der Tabelle und ist im CMS lesbar.
//
// Warum ueber eine Funktion und nicht direkt in die Tabelle: Die Website
// kennt nur den anon-Key, der im ausgelieferten JavaScript steht. Ein
// Insert-Recht fuer anon waere eine offene Einladung, die Tabelle
// vollzuschreiben. Die Funktion schreibt mit dem Service-Role-Key, der hier
// als Secret liegt, und prueft vorher.
//
// Deploy: supabase functions deploy contact --project-ref <ref> --no-verify-jwt
// Secrets: optional SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO, CONTACT_FROM
// (Absender = CONTACT_FROM oder SMTP_USER; der Server nimmt nur das eigene Postfach als Absender)

import nodemailer from "npm:nodemailer@6.9.16";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Eigener Mailserver (SMTP, Inhaber 28.10.2026 — kein Resend). Port 465 = TLS sofort, sonst STARTTLS (Pflicht).
// Supabase sperrt ausgehend Port 25 und 587; der Server hat 30587, das geht.
const SMTP_HOST = (Deno.env.get("SMTP_HOST") ?? "").trim();
const SMTP_PORT = Number((Deno.env.get("SMTP_PORT") ?? "465").trim());
const SMTP_USER = (Deno.env.get("SMTP_USER") ?? "").trim();
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const SMTP_READY = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

/**
 * IPv4 des Mailservers. nodemailer löst Namen über node:dns auf, das in Supabase Edge Functions scheitert
 * („queryA UNKNOWN …“, 28.10.2026) — deshalb selbst: Deno.resolveDns, sonst DNS über HTTPS (Cloudflare).
 */
async function smtpAddress(): Promise<string> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(SMTP_HOST)) return SMTP_HOST;
  try {
    const [ip] = await Deno.resolveDns(SMTP_HOST, "A");
    if (ip) return ip;
  } catch { /* weiter über DNS über HTTPS */ }
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(SMTP_HOST)}&type=A`, { headers: { accept: "application/dns-json" } });
    const data = await res.json() as { Answer?: { type: number; data: string }[] };
    const ip = data.Answer?.find((a) => a.type === 1)?.data;
    if (ip) return ip;
  } catch { /* zuletzt den Namen selbst versuchen */ }
  return SMTP_HOST;
}

/** Verbindung mit der IP, das Zertifikat wird weiter für den Namen geprüft (servername). */
async function smtpTransport() {
  return nodemailer.createTransport({
    host: await smtpAddress(), port: SMTP_PORT, secure: SMTP_PORT === 465, requireTLS: SMTP_PORT !== 465,
    tls: { servername: SMTP_HOST }, name: "rethink.space",
    auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
}
const CONTACT_TO = Deno.env.get("CONTACT_TO") ?? "contact@rethink.space";
const CONTACT_FROM = Deno.env.get("CONTACT_FROM") || SMTP_USER || "contact@rethink.space";
const ALLOWED_ORIGINS = (Deno.env.get("CONTACT_ALLOWED_ORIGINS") ??
  "https://rethink.space,https://www.rethink.space,http://localhost:3100")
  .split(",").map((s) => s.trim()).filter(Boolean);

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 5000;
const MAX_AREA = 120;                    // Geschäftsbereich (optional), gepflegt im CMS (Liste contact.areas)
const RATE_LIMIT = 5;                    // Anfragen …
const RATE_WINDOW_MS = 10 * 60 * 1000;   // … je 10 Minuten und Herkunft

const buckets = new Map<string, number[]>();
function rateLimited(kennung: string): boolean {
  const jetzt = Date.now();
  const treffer = (buckets.get(kennung) ?? []).filter((t) => jetzt - t < RATE_WINDOW_MS);
  if (treffer.length >= RATE_LIMIT) return true;
  treffer.push(jetzt);
  buckets.set(kennung, treffer);
  return false;
}

/** IP nur gehasht ablegen — fuer Missbrauchsabwehr reicht der Hash. */
async function hash(wert: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wert));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

/**
 * GET: die Geschäftsbereiche, wie sie gerade im CMS stehen (Inhaber 23.11.2026: „nicht nach jeder Änderung
 * veröffentlichen“). Das Formular lädt sie beim Öffnen der Seite (modules/contact.js) und behält sonst die
 * Auswahl aus dem HTML. Gibt nur Überschrift und sichtbare Bezeichnungen heraus — dieselben Texte, die ohnehin
 * auf der Seite stehen; gelesen mit dem Service-Role-Key, kein Leserecht für anon.
 */
async function areas(cors: Record<string, string>): Promise<Response> {
  const headers = { ...cors, "Cache-Control": "public, max-age=60" };
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "not_configured" }, 503, headers);
  const hole = async (path: string) => {
    const get = () => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    let res = await get();
    // Der erste Abruf nach einer Pause scheitert vereinzelt mit 401 (Logs 27.11.2026), der zweite klappt — einmal wiederholen
    if (res.status === 401) res = await get();
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return await res.json();
  };
  try {
    const [items, texts] = await Promise.all([
      hole("cms_list_items?select=id,position&list=eq.contact.areas&order=position"),
      hole("cms_texts?select=key,en,hidden&or=(key.like.contact.areas.*,key.eq.contact.form.area)"),
    ]) as [{ id: string }[], { key: string; en: string; hidden?: boolean }[]];
    const byKey = new Map(texts.map((t) => [t.key, t]));
    const list = items
      .map(({ id }) => ({ id, t: byKey.get(`contact.areas.${id}.label`) }))
      .filter(({ id, t }) => /^[a-z0-9-]+$/.test(id) && t && !t.hidden && t.en.trim())
      .map(({ id, t }) => ({ id, label: t!.en.trim().slice(0, MAX_AREA) }));
    return json({ legend: byKey.get("contact.form.area")?.en?.trim() ?? "", areas: list }, 200, headers);
  } catch (err) {
    console.error("areas", err);
    return json({ error: "unavailable" }, 502, headers);
  }
}

const istEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "GET") return areas(cors);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin_not_allowed" }, 403, cors);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unbekannt";
  if (rateLimited(ip)) return json({ error: "rate_limited" }, 429, cors);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }

  // Honigtopf: ein Feld, das kein Mensch sieht und nur Maschinen ausfuellen.
  // Wir antworten mit Erfolg, damit der Absender nicht lernt, woran es lag.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ok: true }, 202, cors);
  }

  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  const email = String(body.email ?? "").trim().slice(0, MAX_EMAIL);
  const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);
  // deno-lint-ignore no-control-regex
  const area = String(body.area ?? "").replace(/[\u0000-\u001F\u007F]+/g, " ").trim().slice(0, MAX_AREA);

  if (!name || !email || !message) return json({ error: "fields_missing" }, 400, cors);
  if (!istEmail(email)) return json({ error: "email_invalid" }, 400, cors);

  const zeile: Record<string, unknown> = {
    name,
    email,
    message,
    ...(area ? { area } : {}),
    ip_hash: await hash(ip),
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  };

  const speichern = (daten: Record<string, unknown>) => fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(daten),
  });
  let res = await speichern(zeile);
  // Ältere Datenbank ohne Spalte area (rethink-cms Migration 0039): Bereich in die Nachricht, damit nichts verloren geht
  if (!res.ok && area && res.status === 400) {
    const { area: _ohne, ...rest } = zeile;
    res = await speichern({ ...rest, message: `[${area}]\n\n${message}` });
  }
  if (!res.ok) {
    console.error("contact_messages", res.status, await res.text());
    return json({ error: "storage_failed" }, 502, cors);
  }
  const [gespeichert] = await res.json();

  // Benachrichtigung, falls ein Versanddienst hinterlegt ist. Schlaegt sie
  // fehl, ist die Anfrage trotzdem sicher gespeichert — der Besucher soll
  // deshalb keinen Fehler sehen.
  let benachrichtigt = false;
  if (SMTP_READY) {
    try {
      await (await smtpTransport()).sendMail({
        from: `RETHINK SPACE <${CONTACT_FROM}>`,
        to: CONTACT_TO,
        replyTo: email,
        subject: `Anfrage von ${name}${area ? ` · ${area}` : ""}`,
        text: `${message}\n\n---\nName:  ${name}\nE-Mail: ${email}\n${area ? `Geschäftsbereich: ${area}\n` : ""}Eingegangen: ${new Date().toISOString()}\nID: ${gespeichert?.id ?? "-"}`,
      });
      benachrichtigt = true;
    } catch (err) {
      console.error("smtp", err instanceof Error ? err.message : err);
    }
    if (benachrichtigt && gespeichert?.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/contact_messages?id=eq.${gespeichert.id}`, {
        method: "PATCH",
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ notified_at: new Date().toISOString() }),
      }).catch(() => {});
    }
  }

  return json({ ok: true, benachrichtigt }, 202, cors);
});
