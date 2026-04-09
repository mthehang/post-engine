/**
 * render-video.js — post-engine
 * Renders animated HTML slides to MP4 using Puppeteer frame capture + ffmpeg.
 *
 * Usage:
 *   node scripts/render-video.js output/my-post/slide-01.html   # single file
 *   node scripts/render-video.js output/my-post/                # all HTMLs in folder
 *
 * Strategy: pauses all CSS animations after load, then seeks frame-by-frame
 * via Web Animations API — no real-time bottleneck, deterministic output.
 *
 * Output: 10s MP4, 24fps, H.264 baseline, yuv420p (compatible with all platforms)
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FPS = 24;
const DURATION_MS = 10000; // 10s loop
const TOTAL_FRAMES = Math.floor(FPS * DURATION_MS / 1000); // 240 frames

function detectPlatform(filename) {
  if (filename.includes('tiktok') || filename.includes('stories')) return { width: 1080, height: 1920 };
  if (filename.includes('linkedin'))                                return { width: 1200, height: 627  };
  return                                                                   { width: 1080, height: 1350 };
}

async function renderVideoFile(browser, htmlPath) {
  const filename = path.basename(htmlPath, '.html');
  const { width, height } = detectPlatform(filename);
  const outputMp4 = htmlPath.replace(/\.html$/, '.mp4');
  const framesDir = path.join(path.dirname(htmlPath), '_frames_tmp');

  fs.mkdirSync(framesDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  // Pause all animations immediately so we can seek precisely
  await page.evaluate(() => {
    document.getAnimations().forEach(a => a.pause());
  });

  // Capture frame-by-frame
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const timeMs = (i / FPS) * 1000;

    await page.evaluate((t) => {
      document.getAnimations().forEach(a => {
        try { a.currentTime = t; } catch (_) {}
      });
    }, timeMs);

    const frameData = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height },
    });

    fs.writeFileSync(
      path.join(framesDir, `frame${String(i).padStart(4, '0')}.png`),
      frameData
    );

    if (i % 24 === 0) process.stdout.write(`\r  Capturing frame ${i}/${TOTAL_FRAMES}...`);
  }

  await page.close();
  process.stdout.write(`\r  Captured ${TOTAL_FRAMES} frames. Encoding...    \n`);

  // Encode with ffmpeg
  execFileSync(ffmpegPath, [
    '-framerate', String(FPS),
    '-i', path.join(framesDir, 'frame%04d.png'),
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-pix_fmt', 'yuv420p',
    '-crf', '20',
    '-movflags', 'faststart',
    '-y',
    outputMp4,
  ], { stdio: 'pipe' });

  fs.rmSync(framesDir, { recursive: true });
  return outputMp4;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/render-video.js <file.html|folder/>');
    process.exit(1);
  }

  const target = path.resolve(arg);
  let htmlFiles = [];

  if (target.endsWith('.html')) {
    htmlFiles = [target];
  } else if (fs.statSync(target).isDirectory()) {
    htmlFiles = fs.readdirSync(target)
      .filter(f => f.endsWith('.html'))
      .sort()
      .map(f => path.join(target, f));
  }

  if (htmlFiles.length === 0) {
    console.error('No HTML files found at target path.');
    process.exit(1);
  }

  console.log(`Rendering ${htmlFiles.length} video(s) at ${FPS}fps, ${DURATION_MS / 1000}s...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  for (const htmlPath of htmlFiles) {
    console.log(`\n  ${path.basename(htmlPath)}`);
    const outputPath = await renderVideoFile(browser, htmlPath);
    console.log(`  ✓ ${path.relative(ROOT, outputPath)}`);
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
