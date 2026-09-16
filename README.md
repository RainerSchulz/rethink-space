# RE-THINK SPACE — Website

Statische Website mit Unterseiten, zweisprachig DE/EN.
Aufgebaut nach dem FORGE-Portal-Muster: Vite-Multi-Page mit `pages/<name>/index.html`, HTML-Shells ohne Inline-Code, Module mit je einer Verantwortung, DE/EN-Wörterbuch, Tests, CI und Docker/nginx-Deploy.

## Entwickeln

```bash
npm install
npm run dev        # öffnet http://localhost:3100/pages/landing/
```

## Prüfen

```bash
npm run lint       # ESLint
npm run test:run   # Vitest: i18n-Parität, Module, HTML-Shell- und SEO-Regeln
npm run test:e2e   # Playwright (einmalig: npx playwright install chromium)
npm run build      # erzeugt dist/
npm run preview    # dist/ lokal ansehen
```

## Veröffentlichen

`npm run build` erzeugt `dist/`. Der Inhalt ist die fertige Website für das Domain-Root (absolute Pfade wie im FORGE-Portal).

- **Docker/nginx** (wie FORGE): `docker build -t rethink-space .` — das Image liefert `dist/` mit `deploy/nginx.conf` aus (Sicherheits-Header, Caching, 404-Seite, Healthcheck unter `/health/`).
- **GitHub Pages:** Bei jedem Push auf `main` baut `.github/workflows/ci.yml` nach Lint, Tests und Secret-Scan und veröffentlicht `dist/`. Voraussetzungen: Repo-Settings → Pages → Source = "GitHub Actions" **und** eine eigene Domain (Custom domain), weil die Seite im Domain-Root laufen muss.

Die Domain ist an drei Stellen hinterlegt und vor dem Livegang zu prüfen: Canonical/Open-Graph in jeder Seite (`https://rethink.space`), `public/sitemap.xml`, `public/robots.txt`.

Ein direktes Öffnen von `index.html` per Doppelklick funktioniert nicht (ES-Module brauchen einen HTTP-Server). Lokal `npm run dev` oder `npm run preview` verwenden.

## Seiten

| URL | Inhalt |
|---|---|
| `/` | Weiterleitung auf `/pages/landing/` |
| `/pages/landing/` | Landingpage |
| `/pages/vision/` | Vision |
| `/pages/design/` | Re-Think Design |
| `/pages/space/` | Re-Think Space |
| `/pages/deployment/` | Re-Think Deployment |
| `/pages/dual-use/` | Dual-Use |
| `/pages/ip/` | IP & Schutzrechte |
| `/pages/news/` | News & Presse |
| `/pages/autor/` | Dr. Johannes Lierfeld |
| `/pages/kontakt/` | Kontakt |
| `/pages/impressum/` | Impressum (Platzhalter) |
| `/pages/datenschutz/` | Datenschutz (Platzhalter) |
| `/pages/404/` → `/404.html` | Fehlerseite (noindex) |

Welche Seiten ein Build erzeugt, steht in `vite.pages.js` (`RETHINK_PAGES=landing,impressum` baut nur diese).

## Struktur

```
index.html              Weiterleitung auf /pages/landing/
pages/<name>/index.html Seiten-Shells (nur Markup + Kopfdaten)
public/                 Bilder/, favicon.svg, Icons, og-image.jpg, robots.txt, sitemap.xml, site.webmanifest
src/site/main.js        Vite-Entry
src/site/site.css       Alle Stile
src/site/fonts.css      Inter, selbst gehostet (kein Google Fonts)
src/site/i18n/          index.js (t, setLang, applyLang), de.js, en.js
src/site/modules/       router.js, nav.js, lang-switch.js, contact.js, portrait.js
deploy/nginx.conf       nginx-Konfiguration für das Docker-Image
tests/unit/             Vitest
tests/e2e/              Playwright
```

Jede Seite bringt Canonical, Open Graph, CSP-Meta, Favicon und Manifest mit; Landing und Autorenseite zusätzlich JSON-LD (Organisation, Website, Person).

**Sprache:** Englisch ist Standard, Deutsch ist per Schalter wählbar und wird im Browser gemerkt. Texte stehen im HTML als englischer Fallback mit `data-i18n="schlüssel"`, beide Sprachen liegen in `src/site/i18n/`.

**Seitenwechsel:** `src/site/modules/router.js` holt die nächste Seite per `fetch` und tauscht nur den Inhalt zwischen Header und Footer, mit Überblendung (View Transitions, Fallback CSS-Fade). Die URLs bleiben echte Seiten, jede ist direkt aufrufbar und indexierbar. Das Stylesheet ist im HTML verlinkt, damit nie eine Seite ohne CSS erscheint.

Regeln: `.claude/skills/coding-guide.md`.

## Noch zu erledigen

- Domain prüfen (siehe oben) und ggf. `public/CNAME` für GitHub Pages anlegen.
- Portrait als `public/Bilder/Lierfeld.jpg` ablegen (Hochformat 3:4). Solange die Datei fehlt, zeigt die Autorenseite einen Platzhalter.
- Bildzuordnung prüfen: Die Bilder wurden nach Dateinamen zugeordnet. Ändern in der jeweiligen Seite (Suche nach `/Bilder/`).
- Texte prüfen: alle Inhalte sind Entwürfe.
- Buchangaben (Verlag, Jahr, ISBN) auf der Autorenseite ergänzen.
- E-Mail-Adresse `kontakt@rethink.space` durch die echte ersetzen (Kontaktseite, Footer, JSON-LD auf der Landing).
- Kontaktformular an einen Versanddienst anbinden (`src/site/modules/contact.js`) oder entfernen.
- Impressum und Datenschutz ausfüllen.
- Social-Links: nur LinkedIn ist gesetzt.
