// Drives the real Witness web app (local dev build pointed at the local notary)
// and saves screenshots of every shot the film uses. The seal step submits a
// real extrinsic to the Portaldot V3 testnet.
//   BASE=http://localhost:5173 node src/capture.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'assets/screens');
mkdirSync(OUT, { recursive: true });
const log = {};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
const shot = async (name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.fullPage ?? false });
  console.log('shot', name);
};

// SKIP_SEAL=<record path> reuses an existing capture instead of sealing a new one.
const SKIP_SEAL = process.env.SKIP_SEAL;
let recordHref = SKIP_SEAL ?? null;

// Landing page: hero, then a full-page capture for slow scrolls.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await shot('home-hero', { wait: 2500 });
await shot('home-full', { fullPage: true, wait: 500 });

// Capture: import the delivery photo, review, seal for real.
if (!SKIP_SEAL) {
  await page.goto(`${BASE}/capture`, { waitUntil: 'networkidle' });
  await shot('capture-start', { wait: 2500 });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(resolve(ROOT, 'assets/parcel-sealed.png'));
  await page.getByText('Ready to seal').waitFor();
  await page.getByPlaceholder('Order 4471, unboxing').fill('Order 4471, delivered to door');
  await page.locator('label.check input[type=checkbox]').check();
  await shot('capture-review', { wait: 800 });
  await page.getByRole('button', { name: 'Seal on Portaldot' }).click();
  const t0 = Date.now();
  let n = 0;
  let last = '';
  while (Date.now() - t0 < 240_000) {
    if (await page.getByText('Witness certificate').count()) break;
    const steps = await page
      .locator('.split')
      .innerText()
      .catch(() => '');
    if (steps !== last && n < 8) {
      last = steps;
      await shot(`capture-sealing-${n++}`, { wait: 150 });
    }
    await page.waitForTimeout(400);
  }
  log.sealSeconds = (Date.now() - t0) / 1000;
  await page.getByText('Witness certificate').waitFor({ timeout: 5000 });
  await shot('capture-sealed', { wait: 1500 });
  await shot('capture-sealed-full', { fullPage: true, wait: 200 });
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download certificate').click(),
  ]);
  await dl.saveAs(resolve(ROOT, 'assets/parcel-sealed.witness.json'));
  log.certificate = await page.locator('main').innerText();
  recordHref = await page
    .locator('a[href*="/v/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
}
log.recordHref = recordHref;

// Verify: the untouched original, then the edited copy.
for (const [name, file] of [
  ['verify-original', 'parcel-sealed.png'],
  ['verify-edited', 'parcel-edited.png'],
]) {
  await page.goto(`${BASE}/verify`, { waitUntil: 'networkidle' });
  if (name === 'verify-original') await shot('verify-start', { wait: 1500 });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(resolve(ROOT, 'assets', file));
  await page.locator('.verdict').waitFor({ timeout: 120_000 });
  await shot(name, { wait: 2500 });
  await shot(`${name}-full`, { fullPage: true, wait: 200 });
  log[name] = await page.locator('.verdict').innerText();
}

// Public record, ledger, developers.
if (recordHref) {
  await page.goto(new URL(recordHref, BASE).href, { waitUntil: 'networkidle' });
  await shot('record', { wait: 4000 });
  await shot('record-full', { fullPage: true, wait: 200 });
}
for (const p of ['ledger', 'developers']) {
  await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
  await shot(p, { wait: 4000 });
  await shot(`${p}-full`, { fullPage: true, wait: 200 });
}

writeFileSync(resolve(ROOT, 'assets/capture-log.json'), JSON.stringify(log, null, 2));
await browser.close();
console.log(JSON.stringify(log, null, 2));
