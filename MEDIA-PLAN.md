# Media Library — Implementation Plan

## Overview

Add a **Media Library** to cms-admin before Phase 3. This gives content authors a centralized place to browse, upload, and manage images with alt text and SEO metadata. Currently images are just text inputs with a basic file upload — no way to see all images, edit alt text, or manage SEO fields.

## What We're Building

### User-Facing Features
1. **Media Library page** (`/admin?view=media`) — grid of all images in the repo
2. **Image detail panel** — click an image to edit alt text, SEO fields, see where it's used
3. **Upload flow** — drag-and-drop or file picker, OR paste an external URL
4. **Content editor integration** — image fields get a "Browse Media" button that opens the library as a picker
5. **SEO fields per image** — alt text, title, caption, og:image description
6. **Usage tracking** — which content files reference each image

### Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Metadata storage | `public/images/_media.json` in the repo | No backend needed, versioned with git, accessible via GitHub API |
| Image upload target | `public/images/uploads/` (existing) | Already works, keeps convention |
| External URLs | Store URL directly in `_media.json` | No download/re-upload needed |
| Usage scanning | Parse frontmatter at load time | Accurate, no stale data |
| Picker mode | URL param `?picker=1&callback=...` | Embeds cleanly in content editor |

## Data Model

### `_media.json` structure
```json
{
  "images": {
    "uploads/hero-banner-abc123.webp": {
      "alt": "Hero banner showing mountain landscape",
      "title": "Mountain Hero Banner",
      "caption": "Used on homepage hero section",
      "seo": {
        "ogTitle": "Mountain Adventure",
        "ogDescription": "Explore the mountains with us"
      },
      "size": 45000,
      "uploadedAt": "2026-07-11T10:00:00Z",
      "uploadedBy": "username"
    },
    "https://images.unsplash.com/photo-123": {
      "alt": "External stock photo",
      "title": "Stock Photo",
      "external": true
    }
  }
}
```

Key: relative path from `public/` for repo images, full URL for external images.

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/frontend/lib/media.js` | Media CRUD: load/save `_media.json`, scan usage, upload image |
| `src/frontend/pages/admin.astro` | Add `renderMediaLibrary()` and `renderMediaDetail()` functions |

### Modified Files

| File | Change |
|------|--------|
| `src/frontend/components/AdminShell.astro` | Add "Media" nav item in sidebar |
| `src/frontend/pages/admin.astro` | Add media library view, media picker for image fields |
| `src/frontend/lib/github.js` | Add `listDirectory()` to recursively find images |
| `tests/media.test.js` | New test file for media module |

## Implementation Steps

### Step 1: `src/frontend/lib/media.js`

Core module with:

```
loadMedia(token)
  → reads public/images/_media.json via GitHub API
  → returns { images: {} } or empty structure

saveMedia(token, mediaData, sha)
  → writes _media.json back to GitHub
  → returns new sha

scanImages(token)
  → lists public/images/ recursively via GitHub API
  → returns array of { path, name, size, url }

scanUsage(token, collections)
  → for each collection, list all content files
  → parse frontmatter, extract image field values
  → returns { [imagePath]: [{ collection, slug, field }] }

uploadMedia(token, file)
  → upload to public/images/uploads/ (reuse existing logic)
  → auto-add entry to _media.json with filename as alt fallback
  → returns { url, path, sha }

addExternalUrl(token, url, metadata)
  → add entry to _media.json with external: true
  → returns updated media data

updateMetadata(token, imagePath, metadata)
  → update alt/title/caption/seo for a specific image in _media.json
  → returns updated media data

deleteMedia(token, imagePath, mediaSha, imageSha)
  → remove from _media.json + delete file from repo
  → only for uploaded images, not external URLs
```

### Step 2: Sidebar Navigation

In `AdminShell.astro`, add between Content nav and Settings nav:

```html
<div class="nav-section-label" style="margin-top: 1.5rem;">Media</div>
<a href="/admin?view=media" class="nav-item">
  <span class="nav-icon"> ️</span>
  <span class="nav-label">Media Library</span>
</a>
```

Also accept `currentView` prop for active state.

### Step 3: Media Library View (`renderMediaLibrary()`)

URL: `/admin?view=media`

Layout:
```
┌─────────────────────────────────────────┐
│ Media Library                    [Upload]│
├─────────────────────────────────────────┤
│ [  ] [  ] [  ] [  ]          │
│ [  ] [  ] [  ] [  ]          │
│ ...                            │
│                                │
│ ─── Detail Panel (on click) ───│
│ Preview                        │
│ Alt text: [____________]       │
│ Title:    [____________]       │
│ Caption:  [____________]       │
│ SEO Title:       [______]     │
│ SEO Description: [______]     │
│ Used in: blog/post-1, blog/...│
│ [Save] [Delete] [Copy URL]    │
└─────────────────────────────────────────┘
```

Features:
- Grid of image thumbnails (lazy loaded)
- Click image → detail panel slides in from right
- Upload button → file picker or drag-drop zone
- "Add URL" button → paste external image URL
- Search/filter by name
- Shows usage count badge on each image

### Step 4: Upload Flow

When user clicks Upload:
1. Show drag-drop zone overlay
2. Accept file(s) via drop or file picker
3. For each file:
   - Call `uploadMedia(token, file)` which uploads to GitHub and adds to `_media.json`
   - Show progress indicator
   - Add thumbnail to grid when done
4. On completion, open detail panel for the first uploaded image (prompt for alt text)

For URL paste:
1. Show input field for URL
2. Preview the image
3. On confirm, call `addExternalUrl(token, url, { alt: '' })`
4. Open detail panel for the new entry

### Step 5: Content Editor Integration

Modify the `image` field rendering in `admin.astro`:

Before:
```html
<input type="text" name="..." value="..." placeholder="/images/..." />
<p class="field-help">Enter a path or upload after saving.</p>
```

After:
```html
<div class="image-field-controls">
  <input type="text" name="..." value="..." placeholder="/images/..." />
  <button type="button" class="btn-browse-media">Browse</button>
  <label class="btn-upload-inline">
    Upload <input type="file" accept="image/*" hidden />
  </label>
</div>
<div class="image-alt-field">
  <input type="text" name="..._alt" value="..." placeholder="Alt text" />
</div>
```

The "Browse" button opens the media library in a modal/picker mode (`?picker=1`). When user selects an image, the modal closes and the image field + alt text are populated.

### Step 6: `github.js` — Add `listDirectory()`

```js
export async function listDirectory(token, dirPath, ref)
```

Recursively lists files in a directory (needed to find all images under `public/images/`). Uses the tree API for efficiency:

```
GET /repos/{owner}/{repo}/git/trees/{branch}:public/images?recursive=1
```

Falls back to the contents API if tree is too large.

### Step 7: Tests — `tests/media.test.js`

```
loadMedia — parses _media.json correctly
loadMedia — returns empty structure when file not found
saveMedia — serializes and writes correctly
scanUsage — extracts image paths from frontmatter
addExternalUrl — adds external entry
updateMetadata — updates specific fields
deleteMedia — removes entry and file
uploadMedia — sanitizes filename, uploads, adds entry
```

## Alt Text & SEO Fields

Each image entry in `_media.json` supports:

| Field | Purpose | Used In |
|-------|---------|---------|
| `alt` | Accessibility text | `<img alt="...">`, content frontmatter fallback |
| `title` | Display title | Admin UI, `<img title="...">` |
| `caption` | Visible caption | Admin UI display |
| `seo.ogTitle` | Open Graph title | `<meta property="og:title">` |
| `seo.ogDescription` | Open Graph description | `<meta property="og:description">` |

When a user picks an image from the media library for a content field, the `alt` text auto-populates in the content's frontmatter if the content doesn't already have one.

## Migration Path

Existing images in `public/images/uploads/` continue to work. On first media library load:
1. Scan `public/images/` for all files
2. Check if `_media.json` exists
3. If not, create it with empty metadata for each found image
4. User can then fill in alt text and SEO fields

This is a one-time bootstrap — no migration script needed.

## Order of Implementation

1. `media.js` — core module (load, save, scan, upload)
2. `github.js` — add `listDirectory()` helper
3. `AdminShell.astro` — add Media nav item
4. `admin.astro` — `renderMediaLibrary()` view (grid + detail panel)
5. `admin.astro` — upload flow (drag-drop + URL paste)
6. `admin.astro` — image field integration (Browse button, alt text)
7. `tests/media.test.js` — test coverage
8. Update PROGRESS.md and AGENTS.md

## Files Summary

| Action | File |
|--------|------|
| **Create** | `src/frontend/lib/media.js` |
| **Create** | `tests/media.test.js` |
| **Modify** | `src/frontend/lib/github.js` (add `listDirectory`) |
| **Modify** | `src/frontend/components/AdminShell.astro` (add Media nav) |
| **Modify** | `src/frontend/pages/admin.astro` (media library view + image field upgrade) |
| **Update** | `PROGRESS.md` |
| **Update** | `AGENTS.md` work state |
