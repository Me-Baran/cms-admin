/**
 * Media Library — manage images with metadata, alt text, and SEO fields.
 *
 * Stores metadata in public/images/_media.json (versioned with git).
 * Images are uploaded to public/images/uploads/ via GitHub API.
 */

import { readFile, writeFile, writeFileBase64, bytesToBase64, listDirectory, deleteFile } from './github.js';

const MEDIA_PATH = 'public/images/_media.json';
const UPLOADS_DIR = 'public/images/uploads';

/**
 * Load the media metadata file.
 * Returns { images: {}, sha } or empty structure if not found.
 */
export async function loadMedia(token) {
  const result = await readFile(token, MEDIA_PATH);
  if (!result) return { images: {}, sha: null };

  try {
    const data = JSON.parse(result.content);
    return { images: data.images || {}, sha: result.sha };
  } catch {
    return { images: {}, sha: result.sha };
  }
}

/**
 * Save the media metadata file.
 * Returns the new sha from GitHub.
 */
export async function saveMedia(token, mediaData, sha) {
  const content = JSON.stringify({ images: mediaData.images }, null, 2);
  const message = sha ? 'Update media metadata' : 'Create media metadata';
  const result = await writeFile(token, MEDIA_PATH, content, message, sha);
  return result.content.sha;
}

/**
 * Scan public/images/ for all image files using the GitHub tree API.
 * Returns array of { path, name, url, size }.
 */
export async function scanImages(token) {
  const files = await listDirectory(token, 'public/images');
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.ico'];

  return files
    .filter(f => {
      if (f.type !== 'file') return false;
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
      return imageExts.includes(ext);
    })
    .filter(f => f.name !== '_media.json')
    .map(f => ({
      path: f.path.replace(/^public\//, ''),
      name: f.name,
      url: `/${f.path.replace(/^public\//, '')}`,
      size: f.size || 0,
    }));
}

/**
 * Scan content frontmatter for image references.
 * Returns { [imagePath]: [{ collection, slug, field }] }
 */
export async function scanUsage(token, collections) {
  const usage = {};

  for (const [name, col] of Object.entries(collections)) {
    const files = await listDirectory(token, col.folder);
    const mdFiles = files.filter(f => f.name.endsWith('.md') || f.name.endsWith('.mdx'));

    for (const file of mdFiles) {
      const result = await readFile(token, file.path);
      if (!result) continue;

      const match = result.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) continue;

      const yaml = match[1];
      const slug = file.name.replace(/\.(md|mdx)$/, '');

      for (const field of col.fields) {
        if (field.type !== 'image') continue;

        const fieldMatch = yaml.match(new RegExp(`^${field.name}:\\s*(.+)$`, 'm'));
        if (!fieldMatch) continue;

        let imagePath = fieldMatch[1].trim().replace(/^["']|["']$/g, '');
        if (!imagePath) continue;

        if (!usage[imagePath]) usage[imagePath] = [];
        usage[imagePath].push({ collection: name, slug, field: field.name });
      }
    }
  }

  return usage;
}

/**
 * Upload an image and add it to the media metadata.
 * Returns { url, path, mediaSha, entry }
 */
export async function uploadMedia(token, file, currentUser) {
  const ext = file.name.split('.').pop().toLowerCase();
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
  const uniqueId = Date.now().toString(36);
  const filename = `${safeName}-${uniqueId}.${ext}`;
  const fullPath = `public/images/uploads/${filename}`;
  const urlPath = `images/uploads/${filename}`;

  const buffer = await file.arrayBuffer();
  const base64 = bytesToBase64(new Uint8Array(buffer));

  const result = await writeFileBase64(
    token,
    fullPath,
    base64,
    `Upload image: ${filename}`
  );

  const { images, sha } = await loadMedia(token);
  const entry = {
    alt: '',
    title: safeName.replace(/-/g, ' '),
    caption: '',
    seo: { ogTitle: '', ogDescription: '' },
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: currentUser?.login || '',
  };

  images[urlPath] = entry;
  const mediaSha = await saveMedia(token, { images }, sha);

  return { url: `/${urlPath}`, path: urlPath, mediaSha, entry };
}

/**
 * Add an external image URL to the media metadata.
 * Returns { path, mediaSha, entry }
 */
export async function addExternalUrl(token, url, metadata = {}) {
  const { images, sha } = await loadMedia(token);

  const entry = {
    alt: metadata.alt || '',
    title: metadata.title || '',
    caption: metadata.caption || '',
    seo: metadata.seo || { ogTitle: '', ogDescription: '' },
    external: true,
  };

  images[url] = entry;
  const mediaSha = await saveMedia(token, { images }, sha);

  return { path: url, mediaSha, entry };
}

/**
 * Update metadata for a specific image.
 * Returns { mediaSha }
 */
export async function updateMetadata(token, imagePath, metadata) {
  const { images, sha } = await loadMedia(token);

  if (!images[imagePath]) {
    images[imagePath] = {
      alt: '',
      title: '',
      caption: '',
      seo: { ogTitle: '', ogDescription: '' },
    };
  }

  const entry = images[imagePath];
  if (metadata.alt !== undefined) entry.alt = metadata.alt;
  if (metadata.title !== undefined) entry.title = metadata.title;
  if (metadata.caption !== undefined) entry.caption = metadata.caption;
  if (metadata.seo) {
    entry.seo = { ...entry.seo, ...metadata.seo };
  }

  images[imagePath] = entry;
  const mediaSha = await saveMedia(token, { images }, sha);

  return { mediaSha };
}

/**
 * Delete an image from the repo and remove from metadata.
 * For uploaded images only (not external URLs).
 * Returns { mediaSha }
 */
export async function deleteMedia(token, imagePath, mediaSha, imageSha) {
  const { images, sha } = await loadMedia(token);

  delete images[imagePath];
  const newMediaSha = await saveMedia(token, { images }, sha || mediaSha);

  if (!imagePath.startsWith('http') && imageSha) {
    await deleteFile(token, `public/${imagePath}`, `Delete image: ${imagePath}`, imageSha);
  }

  return { mediaSha: newMediaSha };
}

/**
 * Get the file SHA for an image (needed for deletion).
 */
export async function getImageSha(token, imagePath) {
  const result = await readFile(token, `public/${imagePath}`);
  return result?.sha || null;
}
