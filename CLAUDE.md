# post-engine — AI Operating Manual

This is the complete guide for any AI CLI (Claude Code, Cursor, Copilot, etc.) to generate
publication-ready social media posts using this pipeline.

## What this does

1. You write the HTML/CSS slide
2. `node scripts/render.js` converts it to a pixel-perfect PNG (2x retina)
3. `node scripts/render-video.js` converts it to a 10s looping MP4
4. Done — ready to post

The pipeline supports Instagram carousel (4:5), Instagram Stories (9:16),
LinkedIn (1.91:1), and TikTok (9:16).

---

## Step 1 — Read brand config

Always read `brand.json` before generating. Use those values for all colors, fonts, and gradients.
If brand.json has placeholder values ("Your Brand"), ask the user:

- Brand name
- Primary color (hex)
- Secondary color (hex)
- Dark/background color (hex)
- Font name (Google Fonts)
- Logo file path or URL
- Tagline (optional)

Then update brand.json before proceeding.

---

## Step 2 — Understand the brief

Ask the user:

1. **Platform** — `instagram-carousel` | `instagram-stories` | `linkedin` | `tiktok`
2. **Topic** — what is this post about? (1–2 sentences)
3. **Hook** — the opening tension or surprising fact (if they have one)
4. **Image** — do you have an image, or should I describe what to find?
5. **Caption needed?** — yes/no (Instagram/TikTok posts need a caption + hashtags)

If the user provides an image file path, use it directly.
If they describe what they want, find a relevant image from Unsplash or Pexels using their
open CDN URLs (no API key needed):
- Unsplash: `https://images.unsplash.com/photo-PHOTO_ID?w=1080&q=80`
- Pexels: use the user-provided URL or describe the query

---

## Step 3 — Platform specs

| Platform | Dimensions | Slides | Output |
|---|---|---|---|
| instagram-carousel | 1080 x 1350 px (4:5) | 4 slides | PNG + MP4 each |
| instagram-stories | 1080 x 1920 px (9:16) | 1 slide | PNG + MP4 |
| linkedin | 1200 x 627 px (1.91:1) | 1 slide | PNG only |
| tiktok | 1080 x 1920 px (9:16) | 1 slide | PNG + MP4 |

File naming convention (the renderer uses this to detect dimensions):
- Instagram carousel: `slide-01.html`, `slide-02.html`, etc.
- Instagram stories: `stories-slide.html`
- LinkedIn: `linkedin-post.html`
- TikTok: `tiktok-slide.html`

---

## Step 4 — Create output folder

```
output/<slug-of-post>/
```

Use a descriptive slug: `output/launch-day-carousel/`, `output/stat-post-q1/`

---

## Step 5 — Generate the HTML slides

Write self-contained HTML files with all CSS inline (no external stylesheets).
Reference templates in `templates/` for structure guidance, but generate fresh HTML
tuned for the specific content and brand.

### Design rules (mandatory)

**Structure of every 10s animation loop:**
- 0–35%: elements enter with `translateY(32px) → 0` + opacity 0→1, staggered
- 35–85%: hold state + subtle idle float (–8px vertical, ease-in-out)
- 85–95%: fade out gracefully
- 95–100%: reset (background only, ready for loop)

**NEVER use `animation-delay`** — encode the delay inside keyframe percentages.

**Brand bars (mandatory on all slides):**
```css
.top-bar    { position: absolute; top: 0;    left: 0; width: 100%; height: 6px; background: LINEAR_GRADIENT; z-index: 100; }
.bottom-bar { position: absolute; bottom: 0; left: 0; width: 100%; height: 5px; background: LINEAR_GRADIENT; z-index: 100; }
```

**Typography scale:**
- Hero headlines: 88–120px, weight 900, letter-spacing –2.5px to –3px
- Section headlines: 52–72px, weight 800
- Body copy: 28–36px, weight 400, line-height 1.55–1.65
- Labels/tags: 16–22px, weight 600–700, letter-spacing 1–3px

**No page numbers / slide counters** — never add "1/4", "01 / 04", etc.

**Font loading** — always inline the Google Fonts link in `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="BRAND_FONT_URL" rel="stylesheet" />
```

### Instagram carousel — 4-slide structure

| Slide | Type | Bg | Purpose |
|---|---|---|---|
| 01 | Cover | Dark gradient | Hook — 3 lines max, emotional tension |
| 02 | Content | Light (#FAFAFA–#F0FDFA) | Evidence / data / context |
| 03 | Article+Comment | Light (#F7F4EE) | Zone A: source evidence, Zone B: brand commentary |
| 04 | CTA | Dark gradient | Single action word + brand |

**Slide 04 CTA pattern:**
```html
<div class="cta-label">BRAND NAME</div>
<div class="cta-headline">COMMENT</div>  <!-- or SAVE / SHARE / etc -->
<p class="cta-sub">supporting line</p>
```

### Instagram Stories — 1 slide

Full-bleed background image with gradient overlay (dark bottom to transparent top).
Brand in top-left, headline center, CTA pill at bottom.

### LinkedIn — 1 slide, golden ratio layout

```
┌─────────────────────┬────────────────────────────────────┐
│                     │  LOGO + BRAND NAME                 │
│   PHOTO (38.2%)     │                                    │
│   Circle inset      │  HEADLINE (3 lines uppercase)      │
│   image, teal ring  │                                    │
│                     │  STAT PRIMARY    STAT SECONDARY    │
└─────────────────────┴────────────────────────────────────┘
```

Photo column: 38.2% width (459px), circle inset with primary color ring border.
Text column: 61.8% width. Headline 38–42px weight 900 uppercase. Stats row at bottom.

### TikTok — 1 slide

Full-bleed image, strong bottom gradient overlay. Big stat callout + headline + CTA pill.
Headline max 96px, aggressive typography. Zero corporate energy.

---

## Step 6 — Render

After generating all HTML files:

```bash
# Render to PNG (all slides in a folder)
node scripts/render.js output/<post-folder>/

# Render to MP4 (skip for linkedin — static only)
node scripts/render-video.js output/<post-folder>/
```

Both commands are idempotent — safe to re-run after editing HTML.

---

## Step 7 — Caption (Instagram / TikTok)

Save the caption to `output/<post-folder>/legenda.txt`.

Caption structure:
1. Hook line (appears before "see more" — make it hit)
2. Context / evidence (1–2 short paragraphs)
3. Brand solution (brand acts, does not instruct)
4. CTA: `Comment KEYWORD below`
5. Exactly 5 hashtags on a separate line

Hashtag rules:
- Avoid generic (100M+ posts) — they bury you
- Avoid brand-specific (0 reach)
- Sweet spot: 300K–3M posts, high intent or viral format
- Mix: 1 solution category + 1 viral format (#didyouknow, #funfact) + 2 topic-specific + 1 innovation

---

## Step 8 — Publish (optional)

```bash
# Instagram
node scripts/publish-instagram.js "$(cat output/<post>/legenda.txt)" output/<post>/manifest.json

# LinkedIn
node scripts/publish-linkedin.js "Post text here" output/<post>/manifest.json
```

Requires `.env` configured from `.env.example`.

---

## Image handling

**User provides image path:**
Use it directly in the HTML `src` attribute. Puppeteer resolves local paths correctly
when using `file:///` URLs.

**User describes image:**
Use an Unsplash CDN URL with relevant keywords in the slug. Always test that the URL
resolves before using it.

**Fetching from web:**
Use the `mcp__plugin_context-mode_context-mode__ctx_fetch_and_index` tool to fetch and
inspect image URLs before embedding them.

---

## File structure

```
post-engine/
├── scripts/
│   ├── render.js           HTML → PNG (Puppeteer, 2x retina)
│   ├── render-video.js     HTML → MP4 (frame capture + ffmpeg)
│   ├── publish-instagram.js
│   └── publish-linkedin.js
├── templates/
│   ├── instagram-carousel/ Reference templates with markers
│   ├── instagram-stories/
│   ├── linkedin-post/
│   └── tiktok-slide/
├── output/                 Generated posts (gitignored)
│   └── <post-slug>/
│       ├── slide-01.html / .png / .mp4
│       ├── manifest.json   PNG file list for publish scripts
│       └── legenda.txt     Caption + hashtags
├── assets/images/          Brand logo and other static assets
├── brand.json              Brand config (edit this first)
└── .env                    API credentials (copy from .env.example)
```

---

## Quality checklist before calling render

- [ ] All HTML files are self-contained (CSS inline, no broken external refs)
- [ ] Brand colors match brand.json
- [ ] No hardcoded font names — uses brand.typography.font
- [ ] Animations use 10s loop pattern (no animation-delay)
- [ ] Top bar (6px) and bottom bar (5px) present on all slides
- [ ] No page number labels on any slide
- [ ] Image URLs resolve (test before embedding)
- [ ] File names follow naming convention (platform detection depends on it)
