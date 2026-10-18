# Toppreise.ch Suite: Documentation Site & Google Stitch Workflow

This directory contains the source code, media assets, and AI design pipelines for the official Toppreise.ch Suite documentation website, deployed to GitHub Pages at **[https://tazztone.github.io/userscripts/](https://tazztone.github.io/userscripts/)**.

---

## Architecture & Directory Layout

```text
toppreise/site/
├── README.md               # Site architecture, deployment, and Stitch workflow (this file)
├── index.html              # Responsive dark-theme landing page with video players & i18n
├── poster-short.webp       # Extracted video poster frame for 9:16 mobile quick demo
└── poster-explainer.webp   # Extracted video poster frame for 16:9 desktop walkthrough
```

### Key Components

1. **Dual-Track Video Showcase**:
   - Tab 1: **Quick Demo (1 min)** — 9:16 vertical video (`short.mp4` / `short_DE.mp4`).
   - Tab 2: **Full Walkthrough (7 min)** — 16:9 HD horizontal video (`explainer.mp4` / `explainer_DE.mp4`).
   - **Aspect Ratio Handling**: CSS `object-fit: contain` with centered flex container ensures letterboxing without clipping across both aspect ratios.
   - **Keyboard Controls**: Press `Space` or `K` anywhere on page to toggle video playback.
2. **Instant Bilingual Switcher (EN / DE)**:
   - Client-side JSON dictionary switches headlines, feature cards, install instructions, and underlying MP4 video streams without page reloads.
3. **1-Click Userscript Installation**:
   - Direct CTA links to the raw user script bundle: `https://raw.githubusercontent.com/tazztone/userscripts/main/toppreise/toppreise.user.js`.
4. **Sister Userscripts Navigation**:
   - Links to Perplexity Enhancements and Hugging Face Heart & Filter scripts in footer.

---

## Video Asset Hosting & Delivery Pipeline

To prevent Git repository bloat (raw videos total ~93.3 MB), video binaries are **never committed to git**.

### Storage & CDN
Videos are hosted as release assets under GitHub release tag [`media-v1`](https://github.com/tazztone/userscripts/releases/tag/media-v1):

| File | Resolution | Aspect Ratio | Duration | Size | Direct Stream URL |
|---|---|---|---|---|---|
| `short.mp4` | 720×1280 | 9:16 (Vertical) | 1m 18s | 10.4 MB | [Stream](https://github.com/tazztone/userscripts/releases/download/media-v1/short.mp4) |
| `short_DE.mp4` | 720×1280 | 9:16 (Vertical) | 1m 18s | 8.8 MB | [Stream](https://github.com/tazztone/userscripts/releases/download/media-v1/short_DE.mp4) |
| `explainer.mp4` | 1280×720 | 16:9 (Landscape) | 7m 22s | 32.5 MB | [Stream](https://github.com/tazztone/userscripts/releases/download/media-v1/explainer.mp4) |
| `explainer_DE.mp4` | 1280×720 | 16:9 (Landscape) | 7m 22s | 41.5 MB | [Stream](https://github.com/tazztone/userscripts/releases/download/media-v1/explainer_DE.mp4) |

### Git Hygiene
- The directory `toppreise/docs/videos/` is permanently excluded via `.gitignore`.
- Cloning the repository transfers only ~1 MB of text/code.

### Poster Generation (FFmpeg)
To regenerate poster frames from video files:
```bash
# 9:16 vertical poster from short.mp4
ffmpeg -y -ss 00:00:04 -i toppreise/docs/videos/short.mp4 -vframes 1 -vf "scale=720:-1" -c:v libwebp -quality 85 toppreise/site/poster-short.webp

# 16:9 horizontal poster from explainer.mp4
ffmpeg -y -ss 00:00:05 -i toppreise/docs/videos/explainer.mp4 -vframes 1 -vf "scale=1280:-1" -c:v libwebp -quality 85 toppreise/site/poster-explainer.webp
```

---

## Deployment to GitHub Pages

Deployment is automated via GitHub Actions:

- **Workflow File**: [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml)
- **Trigger**: Any push to `main` modifying `toppreise/site/**` or the workflow itself.
- **Artifact Path**: `toppreise/site/`
- **Live URL**: `https://tazztone.github.io/userscripts/`

To inspect deployment runs from terminal:
```bash
gh run list --workflow=deploy-pages.yml --limit 3
gh run view <run-id>
```

---

## Google Stitch Setup & Workflows

[Google Stitch](https://stitch.withgoogle.com) is an AI UI/UX generation engine from Google Labs. It is integrated into this workspace via `@google/stitch` CLI.

### 1. Installation & Authentication

Stitch CLI runs via `npx` inside the repository:

```bash
# Check version (v0.11.1+)
npx @google/stitch --version

# Check authentication status
npx @google/stitch status

# Sign in via browser OAuth 2.0 PKCE
npx @google/stitch login

# Or authenticate via API key
npx @google/stitch login --api-key <YOUR_API_KEY>
```

Credentials are saved in `~/.stitch/credentials.json`.

---

### 2. Project Configuration

The Toppreise design project is registered on Stitch:

- **Project Title**: `Toppreise.ch Suite`
- **Project ID**: `3774864796664946048`
- **Canvas Link**: [https://stitch.google.com/projects/3774864796664946048](https://stitch.google.com/projects/3774864796664946048)
- **Active Screen ID**: `2a1031c8411e4035a603851b9cdf6736` (PricePulse Developer Landing Page)
- **Screen Canvas**: [Direct Canvas Node Link](https://stitch.google.com/projects/3774864796664946048?node-id=2a1031c8411e4035a603851b9cdf6736)

To list all existing projects:
```bash
npx @google/stitch find projects
```

---

### 3. Common Stitch CLI Commands

#### Generate New Screens
Create new responsive desktop or mobile designs:
```bash
npx @google/stitch generate screen \
  --project 3774864796664946048 \
  --prompt "Ultra-modern dark mode landing page with deal calculation simulator, neon ruby and amber accents, and glowing video player" \
  --device DESKTOP
```

#### Generate Design Variants
Generate variations of an existing screen:
```bash
npx @google/stitch generate variant \
  --project 3774864796664946048 \
  --screen <SCREEN_ID> \
  --prompt "Refine layout with more compact spacing and prominent install buttons" \
  --count 3
```

#### List Screens & Inspect
```bash
# List all screens in the project
npx @google/stitch find screens --project 3774864796664946048

# Get details/markup of a specific screen
npx @google/stitch get screen --project 3774864796664946048 --id <SCREEN_ID> --json
```

#### Capture Local / Live Page into Stitch
Capture the live site or a local development server for design comparison:
```bash
# Capture live GitHub Pages site
npx @google/stitch capture https://tazztone.github.io/userscripts/

# Capture local preview
npx @google/stitch capture http://localhost:8000/
```

#### Launch Local Preview Server
```bash
npx @google/stitch serve --project 3774864796664946048
```

---

## Local Development

Preview the landing page locally:
```bash
python3 -m http.server 8000 -d toppreise/site
```
Open `http://localhost:8000/` in your browser.
