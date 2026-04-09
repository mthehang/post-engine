/**
 * publish-linkedin.js — post-engine
 * Publishes an image post to LinkedIn via UGC Posts API.
 * Uses the first image in manifest.json (LinkedIn supports single image posts).
 *
 * Requires:
 *   LINKEDIN_TOKEN      — OAuth 2.0 access token with w_member_social scope
 *   LINKEDIN_PERSON_ID  — urn:li:person:XXXXXXXX
 *
 * Usage:
 *   node scripts/publish-linkedin.js "Post text" [path/to/manifest.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const { LINKEDIN_TOKEN, LINKEDIN_PERSON_ID } = process.env;
const LI_BASE = 'https://api.linkedin.com/v2';

async function registerUpload() {
  const body = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: LINKEDIN_PERSON_ID,
      serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
    },
  };
  const res = await fetch(`${LI_BASE}/assets?action=registerUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.value) throw new Error(`Register upload failed: ${JSON.stringify(data)}`);
  const uploadUrl = data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  return { uploadUrl, asset: data.value.asset };
}

async function uploadImage(uploadUrl, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: fileBuffer,
  });
  if (!res.ok) throw new Error(`Image upload failed: HTTP ${res.status}`);
}

async function createPost(asset, commentary) {
  const body = {
    author: LINKEDIN_PERSON_ID,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: commentary },
        shareMediaCategory: 'IMAGE',
        media: [{ status: 'READY', media: asset }],
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  const res = await fetch(`${LI_BASE}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Post creation failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function main() {
  if (!LINKEDIN_TOKEN || !LINKEDIN_PERSON_ID) {
    console.error('Missing LINKEDIN_TOKEN or LINKEDIN_PERSON_ID in .env');
    process.exit(1);
  }

  const commentary = process.argv[2] || '';
  const manifestPath = process.argv[3] || path.join(ROOT, 'output', 'manifest.json');
  const pngFiles = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const imagePath = pngFiles[0];

  console.log(`Publishing to LinkedIn: ${path.basename(imagePath)}`);

  console.log('\n1. Registering upload...');
  const { uploadUrl, asset } = await registerUpload();
  console.log(`  ✓ Asset: ${asset}`);

  console.log('\n2. Uploading image...');
  await uploadImage(uploadUrl, imagePath);
  console.log('  ✓ Uploaded');

  console.log('\n3. Creating post...');
  const postId = await createPost(asset, commentary);
  console.log(`\nPublished. Post ID: ${postId}`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
