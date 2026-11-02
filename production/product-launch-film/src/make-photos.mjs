// Renders the delivery photo used in the film: a parcel on a doorstep (intact),
// plus an edited copy with fake damage painted onto one corner. The intact photo
// is the one sealed on chain; the edited copy is what gets checked in Verify.
// Both are rendered illustrations, not camera photos (see ASSETS.md).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '../assets');
mkdirSync(OUT, { recursive: true });

const barcode = Array.from({ length: 46 }, (_, i) => {
  const w = [2, 1, 3, 1, 2, 4, 1][(i * 7) % 7];
  return `<rect x="${i * 5.2}" y="0" width="${w}" height="46" fill="#1b1814"/>`;
}).join('');

const svg = (damaged) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${process.env.SEED ?? 4}"/>
      <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0.18 0"/></filter>
    <filter id="wood"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.18" numOctaves="3" seed="9"/>
      <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.29  0 0 0 0 0.19  0 0 0 0.55 0"/></filter>
    <filter id="card"><feTurbulence type="fractalNoise" baseFrequency="0.6 0.02" numOctaves="2" seed="2"/>
      <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.18  0 0 0 0.22 0"/>
      <feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="blur30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
    <filter id="blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8a6446"/><stop offset="1" stop-color="#5c3f2a"/></linearGradient>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9d2c4"/><stop offset="1" stop-color="#c4bba9"/></linearGradient>
    <linearGradient id="top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d7ad78"/><stop offset="1" stop-color="#c49561"/></linearGradient>
    <linearGradient id="front" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c18f58"/><stop offset="1" stop-color="#a87843"/></linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#94673a"/><stop offset="1" stop-color="#7a5430"/></linearGradient>
    <radialGradient id="vig" cx="0.5" cy="0.48" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff6e2" stop-opacity="0.22"/><stop offset="0.6" stop-color="#fff6e2" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1600" height="560" fill="url(#wall)"/>
  <rect x="980" y="0" width="420" height="560" fill="#5b4a3a"/>
  <rect x="1000" y="20" width="380" height="540" fill="#6a5644"/>
  <circle cx="1040" cy="330" r="12" fill="#c9b27a"/>
  <rect x="0" y="545" width="1600" height="22" fill="#a89d8a"/>
  <rect y="560" width="1600" height="640" fill="url(#floor)"/>
  <rect y="560" width="1600" height="640" filter="url(#wood)"/>
  ${Array.from({ length: 9 }, (_, i) => `<line x1="0" x2="1600" y1="${600 + i * i * 9 + i * 40}" y2="${600 + i * i * 9 + i * 40}" stroke="#3d2a1c" stroke-opacity="0.35" stroke-width="2"/>`).join('')}
  <rect x="160" y="700" width="980" height="300" rx="20" fill="#5e4a33" opacity="0.9"/>
  <rect x="180" y="716" width="940" height="268" rx="14" fill="#6e5a40"/>
  <text x="650" y="880" font-family="Georgia" font-size="74" fill="#4e3d2a" text-anchor="middle" letter-spacing="14">WELCOME</text>
  <ellipse cx="770" cy="905" rx="420" ry="70" fill="#000" opacity="0.55" filter="url(#blur30)"/>
  <polygon points="420,520 820,440 1110,520 710,610" fill="url(#top)"/>
  <polygon points="420,520 820,440 1110,520 710,610" filter="url(#card)"/>
  <polygon points="420,520 710,610 710,900 420,800" fill="url(#front)"/>
  <polygon points="420,520 710,610 710,900 420,800" filter="url(#card)"/>
  <polygon points="710,610 1110,520 1110,800 710,900" fill="url(#side)"/>
  <polygon points="710,610 1110,520 1110,800 710,900" filter="url(#card)"/>
  <polygon points="555,563 597,576 995,489 950,478" fill="#e6d3a9" opacity="0.88"/>
  <polygon points="555,563 597,576 597,640 555,627" fill="#e6d3a9" opacity="0.75"/>
  <polygon points="760,620 1050,556 1050,690 760,756" fill="#f7f4ec"/>
  <g transform="matrix(1,-0.22,0,1,780,640)">
    <text x="0" y="22" font-family="Arial" font-weight="700" font-size="20" fill="#1b1814">PRIORITY</text>
    <text x="0" y="48" font-family="Arial" font-size="15" fill="#3b362f">14 ALDER ROW · UNIT 3</text>
    <g transform="translate(0,60)">${barcode}</g>
  </g>
  <polygon points="420,520 820,440 1110,520 710,610" fill="url(#light)"/>
  ${damaged ? `
  <g>
    <polygon points="1110,520 1036,536 1016,572 1048,604 1032,650 1070,664 1110,640" fill="#4a3018" opacity="0.92"/>
    <polygon points="1036,536 1062,562 1048,604 1080,596 1110,580 1110,520" fill="#2c1c0e" opacity="0.7"/>
    <path d="M1036 536 L1060 566 L1044 602 L1078 618 L1060 650" stroke="#1a0f06" stroke-width="5" fill="none"/>
    <path d="M1010 700 q30 -14 60 6 t40 -4" stroke="#1a0f06" stroke-width="3" fill="none" opacity="0.6"/>
    <ellipse cx="1070" cy="610" rx="60" ry="80" fill="#3a2410" opacity="0.35" filter="url(#blur3)"/>
  </g>` : ''}
  <rect width="1600" height="1200" fill="url(#vig)"/>
  <rect width="1600" height="1200" filter="url(#grain)"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
for (const [name, damaged] of [['parcel-sealed', false], ['parcel-edited', true]]) {
  await page.setContent(`<body style="margin:0">${svg(damaged)}</body>`);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`wrote assets/${name}.png`);
}
await browser.close();
