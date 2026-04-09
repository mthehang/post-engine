/**
 * publish-instagram.js — post-engine
 * Publishes a carousel (or single image) to Instagram via Meta Graph API.
 *
 * Requires:
 *   IG_USER_ID         — Instagram Business Account user ID
 *   IG_ACCESS_TOKEN    — Long-lived page access token
 *   IMGUR_CLIENT_ID    — OR Cloudinary vars (images must be at public URLs)
 *
 * Usage:
 *   node scripts/publish-instagram.js "Caption text #hashtag" [path/to/manifest.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fetch from 'node-fetch';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const {
  IG_USER_ID,
  IG_ACCESS_TOKEN,
  IMGUR_CLIENT_ID,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

const GRAPH = 'https://graph.facebook.com/v19.0';

// ─── Image hosting helpers ─────────────────────────────────────────────────

async function uploadToImgur(filePath) {
  if (!IMGUR_CLIENT_ID) throw new Error('IMGUR_CLIENT_ID not set in .env');
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}`, ...form.getHeaders() },
    body: form,
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Imgur upload failed: ${JSON.stringify(data)}`);
  return data.data.link;
}

async function uploadToCloudinary(filePath) {
  if (!CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary credentials not set in .env');
  const { default: cloudinary } = await import('cloudinary');
  cloudinary.v2.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  const result = await cloudinary.v2.uploader.upload(filePath, { folder: 'post-engine' });
  return result.secure_url;
}

async function getPublicUrl(filePath) {
  if (IMGUR_CLIENT_ID) return uploadToImgur(filePath);
  if (CLOUDINARY_CLOUD_NAME) return uploadToCloudinary(filePath);
  throw new Error('No image host configured. Set IMGUR_CLIENT_ID or Cloudinary vars in .env — see .env.example');
}

// ─── Graph API helpers ─────────────────────────────────────────────────────

async function createMediaContainer(imageUrl, isCarouselItem = false) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    access_token: IG_ACCESS_TOKEN,
    ...(isCarouselItem && { is_carousel_item: 'true' }),
  });
  const res = await fetch(`${GRAPH}/${IG_USER_ID}/media?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!data.id) throw new Error(`createMediaContainer failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function createCarouselContainer(childIds, caption) {
  const params = new URLSearchParams({
    media_type: 'CAROUSEL',
    caption,
    children: childIds.join(','),
    access_token: IG_ACCESS_TOKEN,
  });
  const res = await fetch(`${GRAPH}/${IG_USER_ID}/media?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!data.id) throw new Error(`createCarouselContainer failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function publishMedia(containerId) {
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: IG_ACCESS_TOKEN,
  });
  const res = await fetch(`${GRAPH}/${IG_USER_ID}/media_publish?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!data.id) throw new Error(`publishMedia failed: ${JSON.stringify(data)}`);
  return data.id;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
    console.error('Missing IG_USER_ID or IG_ACCESS_TOKEN in .env');
    process.exit(1);
  }

  const caption = process.argv[2] || '';
  const manifestPath = process.argv[3] || path.join(ROOT, 'output', 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`manifest.json not found at ${manifestPath}. Run render.js first.`);
    process.exit(1);
  }

  const pngFiles = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`Publishing ${pngFiles.length} image(s) to Instagram...`);

  // Step 1: Upload all images to public host
  console.log('\n1. Uploading to image host...');
  const imageUrls = [];
  for (const filePath of pngFiles) {
    const url = await getPublicUrl(filePath);
    imageUrls.push(url);
    console.log(`  ✓ ${path.basename(filePath)} → ${url}`);
  }

  if (imageUrls.length === 1) {
    // Single image post
    console.log('\n2. Creating media container...');
    const containerId = await createMediaContainer(imageUrls[0]);
    console.log(`  ✓ Container: ${containerId}`);

    console.log('\n3. Publishing...');
    const postId = await publishMedia(containerId);
    console.log(`\nPublished. Post ID: ${postId}`);
  } else {
    // Carousel post
    console.log('\n2. Creating carousel item containers...');
    const childIds = [];
    for (const url of imageUrls) {
      const id = await createMediaContainer(url, true);
      childIds.push(id);
      console.log(`  ✓ Child: ${id}`);
    }

    console.log('\n3. Creating carousel container...');
    const carouselId = await createCarouselContainer(childIds, caption);
    console.log(`  ✓ Carousel: ${carouselId}`);

    console.log('\n4. Publishing...');
    const postId = await publishMedia(carouselId);
    console.log(`\nPublished. Post ID: ${postId}`);
  }
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
