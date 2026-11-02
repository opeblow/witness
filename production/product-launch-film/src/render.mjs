// Renders src/film.html frame by frame and pipes the frames straight into ffmpeg,
// muxed with build/mix.wav. No intermediate frames touch the disk.
//   node src/render.mjs                    -> witness-launch-film.mp4
//   node src/render.mjs --stills 5,60,115  -> build/stills/*.jpg (preview frames)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const tl = JSON.parse(readFileSync(resolve(ROOT, 'timeline.json'), 'utf8'));
const args = process.argv.slice(2);
const stills = args.includes('--stills') ? args[args.indexOf('--stills') + 1].split(',').map(Number) : null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: tl.width, height: tl.height } });
await page.goto(pathToFileURL(resolve(ROOT, 'src/film.html')).href);
await page.evaluate(() => window.ready);

if (stills) {
  mkdirSync(resolve(ROOT, 'build/stills'), { recursive: true });
  for (const s of stills) {
    await page.evaluate((t) => window.render(t), s);
    await page.screenshot({ path: resolve(ROOT, `build/stills/t${String(s).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 85 });
  }
  await browser.close();
  process.exit(0);
}

const out = resolve(ROOT, 'witness-launch-film.mp4');
const ff = spawn('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'mjpeg', '-i', '-',
  '-i', resolve(ROOT, 'build/mix.wav'),
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(tl.fps),
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-t', String(tl.duration), '-movflags', '+faststart', out,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const frames = Math.round(tl.duration * tl.fps);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate((t) => window.render(t), f / tl.fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 300 === 0) console.log(`frame ${f}/${frames} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log('wrote', out);
