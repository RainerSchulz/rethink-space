// Supabase Edge Function „publish“ — löst aus dem CMS den Inhalts-Workflow aus.
//
// Warum eine Funktion und nicht ein Aufruf direkt aus dem Browser: GitHub
// verlangt für repository_dispatch ein Token mit Schreibrecht. Im CMS wäre es
// eine VITE_-Variable und läge damit im ausgelieferten JavaScript — also
// offen. Das Token bleibt deshalb hier als Supabase-Secret (GITHUB_TOKEN),
// der Browser sieht nur die öffentliche Adresse dieser Funktion.
//
// Der Aufruf ist nur für angemeldete Admins erlaubt: die Funktion prüft das
// mitgeschickte Zugangstoken gegen Supabase Auth und verlangt
// app_metadata.role === "admin" — dieselbe Bedingung wie cms_is_admin() in der
// Datenbank.
//
// Deploy: supabase functions deploy publish --project-ref <ref>
// Secrets: GITHUB_TOKEN, optional GITHUB_REPO, PUBLISH_ALLOWED_ORIGINS

const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "RainerSchulz/rethink-space";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const EVENT_TYPE = "cms-publish";
const ALLOWED_ORIGINS = (Deno.env.get("PUBLISH_ALLOWED_ORIGINS") ??
  "http://localhost:3200,http://127.0.0.1:3200")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin_not_allowed" }, 403, cors);

  // 1. Anmeldung prüfen — vor allem anderen, damit Unangemeldete nichts über
  //    den Zustand des Backends erfahren.
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "not_authenticated" }, 401, cors);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: "not_authenticated" }, 401, cors);
  const user = await userRes.json();
  if (user?.app_metadata?.role !== "admin") return json({ error: "not_allowed" }, 403, cors);

  if (!GITHUB_TOKEN) return json({ error: "github_token_missing" }, 503, cors);

  // 2. Workflow auslösen
  const gh = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "rethink-cms",
    },
    body: JSON.stringify({
      event_type: EVENT_TYPE,
      client_payload: { ausgeloest_von: user.email ?? user.id, am: new Date().toISOString() },
    }),
  });

  if (!gh.ok) {
    console.error("repository_dispatch", gh.status, await gh.text());
    return json({ error: "dispatch_failed", status: gh.status }, 502, cors);
  }

  return json({
    ok: true,
    hinweis: "Der Build läuft. Die Änderungen sind in wenigen Minuten auf rethink.space.",
    actions: `https://github.com/${GITHUB_REPO}/actions`,
  }, 202, cors);
});
