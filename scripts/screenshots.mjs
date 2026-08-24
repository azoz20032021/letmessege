/**
 * Captures the screenshots used in the README.
 *
 *   npm run dev:db      # terminal 1
 *   npm run seed        # once
 *   npm run dev         # terminal 2
 *   npm run screenshots # terminal 3
 *
 * Drives an already-installed Chrome through puppeteer-core, so nothing extra
 * is downloaded. Override the browser with CHROME_PATH if it lives elsewhere.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'docs/screenshots');
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error('No Chrome found. Set CHROME_PATH to your browser executable.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Signs in through the demo endpoint and primes localStorage before first paint. */
async function newPage(browser, { width, height, theme, lang }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

  const token = await page.evaluate(async () => {
    const res = await fetch('/api/auth/demo', { method: 'POST' });
    const body = await res.json();
    return body?.data?.accessToken ?? null;
  });

  if (!token) throw new Error('Demo login failed — did you run `npm run seed`?');

  await page.evaluate(
    (t, th, lg) => {
      localStorage.setItem('lm.token', t);
      localStorage.setItem('lm.theme', th);
      localStorage.setItem('lm.lang', lg);
    },
    token,
    theme,
    lang
  );

  await page.goto(APP_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('aside', { timeout: 15000 });
  await sleep(1200); // let entrance animations settle
  return page;
}

/** Clicks the conversation whose title matches, then waits for the thread. */
async function openConversation(page, title) {
  await page.evaluate((wanted) => {
    const row = [...document.querySelectorAll('aside button[type=button]')].find((b) =>
      b.textContent?.includes(wanted)
    );
    row?.click();
  }, title);
  await page.waitForSelector('main header', { timeout: 10000 });
  await sleep(1200);
}

async function shoot(page, name) {
  const path = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path });
  console.log(`  ✓ ${name}.png`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
  });

  console.log('Capturing screenshots…');

  try {
    // 1 — Login page, dark
    const login = await browser.newPage();
    await login.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await login.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await login.evaluate(() => {
      localStorage.setItem('lm.theme', 'dark');
      localStorage.setItem('lm.lang', 'en');
      localStorage.removeItem('lm.token');
    });
    await login.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await shoot(login, 'login');
    await login.close();

    // 2 — Group chat, dark
    const dark = await newPage(browser, { width: 1440, height: 900, theme: 'dark', lang: 'en' });
    await openConversation(dark, 'Product Team');
    await shoot(dark, 'chat-dark');
    await dark.close();

    // 3 — Direct chat, light
    const light = await newPage(browser, { width: 1440, height: 900, theme: 'light', lang: 'en' });
    await openConversation(light, 'Layla Haddad');
    await shoot(light, 'chat-light');
    await light.close();

    // 4 — Arabic, RTL
    const rtl = await newPage(browser, { width: 1440, height: 900, theme: 'dark', lang: 'ar' });
    await openConversation(rtl, 'Product Team');
    await shoot(rtl, 'chat-arabic-rtl');
    await rtl.close();

    // 5 — Turkish
    const tr = await newPage(browser, { width: 1440, height: 900, theme: 'light', lang: 'tr' });
    await openConversation(tr, 'Product Team');
    await shoot(tr, 'chat-turkish');
    await tr.close();

    // 6 — Mobile conversation list
    const mobile = await newPage(browser, { width: 414, height: 860, theme: 'dark', lang: 'en' });
    await shoot(mobile, 'mobile-list');
    await openConversation(mobile, 'Product Team');
    await shoot(mobile, 'mobile-chat');
    await mobile.close();

    console.log(`\nSaved to ${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
