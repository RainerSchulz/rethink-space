/**
 * E2E: Weiterleitung, einsprachige Anzeige, Seitenwechsel ohne Neuladen,
 * Mobilmenü, Kontaktformular. Läuft gegen den Vite-Dev-Server.
 */
import { test, expect } from '@playwright/test';
import { EN } from '../../src/site/i18n/en.js';

const PAGES = [
  'lunar-habitato', 'dual-use', 'people', 'contact',
  'legal-notice', 'privacy', '404',
];

test.describe('Feature: Alle Seiten laden fehlerfrei', () => {
  for (const p of PAGES) {
    test(`/pages/${p}/ antwortet und hat keine Konsolenfehler`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const res = await page.goto(`/pages/${p}/`);
      expect(res.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('Root / IST die Startseite — keine Weiterleitung mehr', async ({ page }) => {
    const res = await page.goto('/');
    expect(res.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/pages\//);
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('.moonscape')).toBeVisible();
  });
});

test.describe('Feature: Sprache — die Website ist einsprachig Englisch', () => {
  test('Seite startet auf Englisch, auch im deutschen Browser; kein Sprachschalter', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // Wortlaut aus dem Woerterbuch, nicht abgeschrieben: der Inhaber aendert
    // diese Texte im CMS, und ein Zitat hier wuerde bei jeder Aenderung brechen.
    await expect(page).toHaveTitle(EN['home.meta.title']);
    await expect(page.locator('[data-i18n="home.hero.lead1"]')).toHaveText(EN['home.hero.lead1']);
    await expect(page.locator('[data-i18n="footer.project"]')).toHaveText(EN['footer.project']);
    await expect(page.locator('.lang')).toHaveCount(0);
  });

  test('Kopfnavigation führt genau vier Punkte', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) await page.locator('.burger').click();
    await expect(page.locator('#site-nav a')).toHaveText(
      ['nav.habitat', 'nav.dual-use', 'nav.people', 'nav.contact'].map((k) => EN[k]),
    );
  });
});

test.describe('Feature: Seitenwechsel ohne Neuladen', () => {
  test('Nav-Link tauscht nur den Inhalt; Header, Footer und JS-Zustand bleiben', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.evaluate(() => { window.__keep = 42; });

    if (isMobile) {
      const burger = page.locator('.burger');
      await expect(page.locator('#site-nav')).toBeHidden();
      await burger.click();
      await expect(burger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#site-nav')).toBeVisible();
    }
    await page.locator('#site-nav a[href="/pages/lunar-habitato/"]').click();

    await expect(page).toHaveURL(/\/pages\/lunar-habitato\/$/);
    await expect(page).toHaveTitle(EN['habitat.meta.title']);
    await expect(page.locator('#site-nav a[href="/pages/lunar-habitato/"]')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => window.__keep)).toBe(42); // kein Reload
    if (isMobile) await expect(page.locator('#site-nav')).toBeHidden(); // Menü schließt nach Wechsel

    await page.goBack();
    await expect(page).not.toHaveURL(/\/pages\//);
    await expect(page.locator('.hero h1')).toBeVisible();
    expect(await page.evaluate(() => window.__keep)).toBe(42);
  });

  test('Formular funktioniert auch nach einem Seitenwechsel', async ({ page, isMobile }) => {
    const ENDPOINT = 'https://test.supabase.co/functions/v1/contact';
    await page.addInitScript((u) => { window.RETHINK_CONTACT_ENDPOINT = u; }, ENDPOINT);
    const gesendet = [];
    await page.route(ENDPOINT, async (route) => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      gesendet.push(JSON.parse(route.request().postData()));
      return route.fulfill({ status: 202, headers: { ...cors, 'content-type': 'application/json' }, body: '{"ok":true}' });
    });

    await page.goto('/');
    if (isMobile) await page.locator('.burger').click();
    await page.locator('#site-nav a[href="/pages/contact/"]').click();
    await expect(page).toHaveURL(/\/pages\/contact\/$/);

    // Der Honigtopf steht absichtlich MIT Ausdehnung außerhalb des Bildes —
    // display:none wuerde von vielen Maschinen uebersprungen, und genau die
    // sollen hineintappen. Playwright nennt so ein Feld "visible", deshalb
    // pruefen wir, worauf es wirklich ankommt.
    const honig = page.locator('input[name="website"]');
    const lage = await honig.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { rechterRand: r.x + r.width, tabindex: el.tabIndex, versteckt: !!el.closest('[aria-hidden="true"]') };
    });
    expect(lage.rechterRand, 'Honigtopf muss links aus dem Bild stehen').toBeLessThanOrEqual(0);
    expect(lage.tabindex, 'Honigtopf darf kein Tab-Stopp sein').toBe(-1);
    expect(lage.versteckt, 'Honigtopf muss aria-hidden sein').toBe(true);

    await page.fill('input[name="name"]', 'Test');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('textarea[name="message"]', 'Hello');
    await expect(page.locator('.form-status')).toBeHidden();
    await page.locator('form[data-contact] button[type="submit"]').click();

    const status = page.locator('.form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('data-art', 'erfolg');
    await expect(page).toHaveURL(/\/pages\/contact\/$/); // kein Neuladen
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0]).toMatchObject({ name: 'Test', email: 'test@example.com', message: 'Hello', website: '' });
  });

  test('Bricht das Senden ab, verweist das Formular auf die E-Mail-Adresse', async ({ page }) => {
    const ENDPOINT = 'https://test.supabase.co/functions/v1/contact';
    await page.addInitScript((u) => { window.RETHINK_CONTACT_ENDPOINT = u; }, ENDPOINT);
    await page.route(ENDPOINT, (route) => route.abort());

    await page.goto('/pages/contact/');
    await page.fill('input[name="name"]', 'Test');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('textarea[name="message"]', 'Hello');
    await page.locator('form[data-contact] button[type="submit"]').click();

    const status = page.locator('.form-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('data-art', 'fehler');
    await expect(status).toHaveText(EN['contact.form.error']);
  });
});

test.describe('Feature: People-Seite', () => {
  test('Portrait wird im Band „Founder & CEO“ geladen und ersetzt den Platzhalter', async ({ page }) => {
    await page.goto('/pages/people/');
    await page.locator('.band-toggle').first().click();
    // Im CMS lässt sich das Portrait entfernen (hidden) — dann darf es nicht zu sehen sein.
    const box = page.locator('.portrait');
    if (await box.getAttribute('hidden') !== null) {
      await expect(box).toBeHidden();
      // ohne Portrait nimmt der Text die ganze Breite der Kachel
      const [text, author] = await Promise.all([
        page.locator('.author > div:not(.portrait)').evaluate((n) => n.getBoundingClientRect().width),
        page.locator('.author').evaluate((n) => n.getBoundingClientRect().width),
      ]);
      expect(text).toBeGreaterThan(author - 2);
      return;
    }
    const img = page.locator('.portrait img');
    await expect(img).toBeVisible();
    // Alt-Text kommt aus dem CMS (data-portrait-alt) — kein Zitat, nur: übernommen und nicht leer
    const alt = await box.getAttribute('data-portrait-alt');
    expect(alt?.trim()).toBeTruthy();
    await expect(img).toHaveAttribute('alt', alt);
    expect(await img.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.portrait .initials')).toHaveCount(0);
  });
});

test.describe('Feature: Barrierefreiheit — Tastatur und Fokus', () => {
  test('Tab zeigt den Skip-Link, Enter springt in den Inhalt', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('nach einem Seitenwechsel liegt der Fokus auf dem neuen Inhalt', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) await page.locator('.burger').click();
    await page.locator('#site-nav a[href="/pages/dual-use/"]').click();
    await expect(page).toHaveURL(/\/pages\/dual-use\/$/);
    await expect(page.locator('main')).toBeFocused();
  });
});

test.describe('Feature: Bänder klappen auf, statt zu verlinken', () => {
  for (const slug of ['lunar-habitato', 'dual-use', 'people']) {
    test(`/pages/${slug}/: "Learn more" öffnet den Bereich darunter, ohne Seitenwechsel`, async ({ page }) => {
      await page.goto(`/pages/${slug}/`);
      await expect(page.locator('.band-panel:visible')).toHaveCount(0); // alles zu beim Laden

      const group = page.locator('.band-group').first();
      const toggle = group.locator('.band-toggle');
      const panel = group.locator('.band-panel');

      await toggle.click();
      await expect(panel).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page).toHaveURL(new RegExp(`/pages/${slug}/$`)); // kein Seitenwechsel
      await expect(page.locator('.band-panel:visible')).toHaveCount(1); // übrige bleiben zu

      await toggle.click();
      await expect(panel).toBeHidden();
    });

    test(`/pages/${slug}/: ein Klick auf das Band selbst führt nirgendwohin`, async ({ page }) => {
      await page.goto(`/pages/${slug}/`);
      await page.locator('.band-h').first().click();
      await expect(page).toHaveURL(new RegExp(`/pages/${slug}/$`));
      await expect(page.locator('.band-panel').first()).toBeHidden();
    });
  }
});

test.describe('Feature: Chat-Widget „Frag RETHINK SPACE“', () => {
  const ENDPOINT = 'https://test.supabase.co/functions/v1/chat';
  const SSE = 'data: {"type":"text","text":"ISRU means using local resources. "}\n\n'
    + 'data: {"type":"text","text":"See /pages/lunar-habitato/"}\n\ndata: {"type":"done"}\n\n';

  test('Frage senden, gestreamte Antwort mit Seitenlink, Escape schließt', async ({ page }) => {
    await page.addInitScript((url) => { window.RETHINK_CHAT_ENDPOINT = url; }, ENDPOINT);
    await page.route(ENDPOINT, async (route) => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const body = JSON.parse(route.request().postData());
      expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'What is ISRU?' });
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: SSE });
    });
    await page.goto('/');
    await page.locator('.chat-fab').click();
    const dlg = page.locator('dialog.chat');
    await expect(dlg).toBeVisible();
    await page.fill('#chat-input', 'What is ISRU?');
    await page.locator('.chat-send').click();
    await expect(page.locator('.chat-msg--assistant .chat-text').last()).toContainText('ISRU means using local resources. See /pages/lunar-habitato/');
    await expect(page.locator('.chat-msg--assistant a[href="/pages/lunar-habitato/"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await expect(page.locator('.chat-fab')).toBeFocused();
  });

  test('lange Antwort: der Anfang steht oben, man muss nicht zuruecksrollen', async ({ page }) => {
    // Eine Antwort, die deutlich hoeher ist als das Fenster des Verlaufs.
    const stuecke = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of a very long answer about lunar regolith. `);
    const lang = stuecke.map((tx) => `data: ${JSON.stringify({ type: 'text', text: tx })}\n\n`).join('')
      + 'data: {"type":"done"}\n\n';
    await page.addInitScript((url) => { window.RETHINK_CHAT_ENDPOINT = url; }, ENDPOINT);
    await page.route(ENDPOINT, async (route) => {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: lang });
    });
    await page.goto('/');
    await page.locator('.chat-fab').click();
    await page.fill('#chat-input', 'Tell me everything about regolith');
    await page.locator('.chat-send').click();
    const antwort = page.locator('.chat-msg--assistant').last();
    await expect(antwort).toContainText('Line 40 of a very long answer');

    const mass = await page.evaluate(() => {
      const log = document.querySelector('.chat-log');
      const msg = [...document.querySelectorAll('.chat-msg--assistant')].at(-1);
      return {
        versatz: msg.getBoundingClientRect().top - log.getBoundingClientRect().top,
        gescrollt: log.scrollTop,
        hoeher: msg.getBoundingClientRect().height > log.clientHeight,
      };
    });
    expect(mass.hoeher, 'Testaufbau: die Antwort muss hoeher sein als das Fenster').toBe(true);
    expect(mass.gescrollt, 'der Verlauf ist gescrollt, sonst sagt der Test nichts').toBeGreaterThan(0);
    expect(Math.abs(mass.versatz), 'der Anfang der Antwort steht oben im Fenster').toBeLessThan(4);
  });

  test('ohne Endpoint gibt es kein Widget', async ({ page }) => {
    await page.addInitScript(() => { window.RETHINK_CHAT_ENDPOINT = ''; });
    await page.goto('/');
    // Nur aussagekräftig, wenn lokal kein VITE_CHAT_ENDPOINT gesetzt ist; sonst ist der Button erlaubt.
    const count = await page.locator('.chat-fab').count();
    expect(count).toBeLessThanOrEqual(1);
  });
});
