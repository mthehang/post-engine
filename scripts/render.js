/**
 * render.js — post-engine
 * Renders HTML slides to PNG using Puppeteer.
 *
 * Usage:
 *   node scripts/render.js                                  # all filled-*.html in output/
 *   node scripts/render.js output/my-post/slide-01.html    # single file
 *   node scripts/render.js output/my-post/                 # all HTMLs in folder
 *
 * Platform detection (from filename):
 *   *tiktok*          → 1080 x 1920
 *   *stories*         → 1080 x 1920
 *   *linkedin-cover*  → 1128 x 191
 *   *linkedin*        → 1200 x 627
 *   (default)         → 1080 x 1350  (Instagram carousel 4:5)
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

function detectPlatform(filename) {
  if (filename.includes('tiktok') || filename.includes('stories')) return { width: 1080, height: 1920 };
  if (filename.includes('linkedin-cover'))                          return { width: 1128, height: 191  };
  if (filename.includes('linkedin'))                                return { width: 1200, height: 627  };
  return                                                                   { width: 1080, height: 1350 };
}

async function renderFile(browser, htmlPath) {
  const filename = path.basename(htmlPath, '.html');
  const { width, height } = detectPlatform(filename);
  const outputPath = path.join(path.dirname(htmlPath), `${filename}.png`);

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 }); // 2x for crisp retina quality

  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

  // Seek animations to t=5s so PNG captures the fully-entered state
  await page.evaluate(() => {
    document.getAnimations().forEach(a => {
      try { a.pause(); a.currentTime = 5000; } catch (_) {}
    });
  });

  await page.screenshot({
    path: outputPath,
    type: 'png',
    clip: { x: 0, y: 0, width, height },
  });

  await page.close();
  return outputPath;
}

async function collectHtmlFiles(arg) {
  if (!arg) {
    // No argument: scan output/ for filled-*.html
    return fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.startsWith('filled-') && f.endsWith('.html'))
      .sort()
      .map(f => path.join(OUTPUT_DIR, f));
  }

  const target = path.resolve(arg);

  if (!fs.existsSync(target)) {
    console.error(`Not found: ${target}`);
    process.exit(1);
  }

  const stat = fs.statSync(target);

  if (stat.isDirectory()) {
    return fs.readdirSync(target)
      .filter(f => f.endsWith('.html'))
      .sort()
      .map(f => path.join(target, f));
  }

  return [target];
}

async function main() {
  const htmlFiles = await collectHtmlFiles(process.argv[2]);

  if (htmlFiles.length === 0) {
    console.log('No HTML files found. Generate slides first.');
    process.exit(0);
  }

  console.log(`Rendering ${htmlFiles.length} slide(s)...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  const rendered = [];

  for (const htmlPath of htmlFiles) {
    const outputPath = await renderFile(browser, htmlPath);
    console.log(`  ✓ ${path.relative(ROOT, outputPath)}`);
    rendered.push(outputPath);
  }

  await browser.close();

  // Write manifest.json for publish scripts
  const manifestPath = path.join(path.dirname(rendered[0]), 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(rendered, null, 2));

  console.log(`\nDone. ${rendered.length} PNG(s) saved.`);
  console.log(`Manifest: ${path.relative(ROOT, manifestPath)}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
