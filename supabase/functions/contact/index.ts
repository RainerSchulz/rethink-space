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
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const smtp = SMTP_HOST && SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, requireTLS: SMTP_PORT !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  })
  : null;
const CONTACT_TO = Deno.env.get("CONTACT_TO") ?? "contact@rethink.space";
const CONTACT_FROM = Deno.env.get("CONTACT_FROM") || SMTP_USER || "contact@rethink.space";
const ALLOWED_ORIGINS = (Deno.env.get("CONTACT_ALLOWED_ORIGINS") ??
  "https://rethink.space,https://www.rethink.space,http://localhost:3100")
  .split(",").map((s) => s.trim()).filter(Boolean);

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 5000;
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

const istEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

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

  if (!name || !email || !message) return json({ error: "fields_missing" }, 400, cors);
  if (!istEmail(email)) return json({ error: "email_invalid" }, 400, cors);

  const zeile = {
    name,
    email,
    message,
    ip_hash: await hash(ip),
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(zeile),
  });
  if (!res.ok) {
    console.error("contact_messages", res.status, await res.text());
    return json({ error: "storage_failed" }, 502, cors);
  }
  const [gespeichert] = await res.json();

  // Benachrichtigung, falls ein Versanddienst hinterlegt ist. Schlaegt sie
  // fehl, ist die Anfrage trotzdem sicher gespeichert — der Besucher soll
  // deshalb keinen Fehler sehen.
  let benachrichtigt = false;
  if (smtp) {
    try {
      await smtp.sendMail({
        from: `RETHINK SPACE <${CONTACT_FROM}>`,
        to: CONTACT_TO,
        replyTo: email,
        subject: `Anfrage von ${name}`,
        text: `${message}\n\n---\nName:  ${name}\nE-Mail: ${email}\nEingegangen: ${new Date().toISOString()}\nID: ${gespeichert?.id ?? "-"}`,
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
