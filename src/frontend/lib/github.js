/**
 * GitHub API wrapper for file operations.
 *
 * Uses the user's GitHub token (from Supabase OAuth provider_token)
 * to read/write files in the site repo.
 *
 * All operations go through the GitHub REST API v3.
 */

const GITHUB_API = 'https://api.github.com';

/**
 * Create headers for GitHub API requests.
 */
function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

/**
 * Get the site repo — auto-detected from git remote at build time,
 * or falls back to PUBLIC_SITE_REPO env var.
 */
export function getSiteRepo() {
  // @ts-ignore — injected by integration at build time
  return (typeof __CMS_ADMIN_REPO__ !== 'undefined' && __CMS_ADMIN_REPO__)
    || import.meta.env.PUBLIC_SITE_REPO
    || '';
}

/**
 * Get the default branch — auto-detected from git at build time.
 */
export function getDefaultBranch() {
  // @ts-ignore — injected by integration at build time
  return (typeof __CMS_ADMIN_BRANCH__ !== 'undefined' && __CMS_ADMIN_BRANCH__)
    || 'main';
}

/**
 * Read a file from the repo.
 * Returns { content, sha } or null if not found.
 */
export async function readFile(token, path, ref) {
  const repo = getSiteRepo();
  if (!ref) ref = getDefaultBranch();
  const url = `${GITHUB_API}/repos/${repo}/contents/${path}?ref=${ref}`;

  const resp = await fetch(url, { headers: headers(token) });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`GitHub read failed: ${resp.status} ${err.message || ''}`);
  }

  const data = await resp.json();
  const content = atob(data.content);
  return { content, sha: data.sha };
}

/**
 * List files in a directory.
 * Returns array of { name, path, sha, type }.
 */
export async function listFiles(token, dirPath, ref) {
  const repo = getSiteRepo();
  if (!ref) ref = getDefaultBranch();
  const url = `${GITHUB_API}/repos/${repo}/contents/${dirPath}?ref=${ref}`;

  const resp = await fetch(url, { headers: headers(token) });
  if (resp.status === 404) return [];
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`GitHub list failed: ${resp.status} ${err.message || ''}`);
  }

  const data = await resp.json();
  return (data || []).map(item => ({
    name: item.name,
    path: item.path,
    sha: item.sha,
    type: item.type,
    size: item.size,
  }));
}

/**
 * Create or update a file.
 * For updates, pass the current sha.
 */
export async function writeFile(token, path, content, message, sha = null) {
  const repo = getSiteRepo();
  const url = `${GITHUB_API}/repos/${repo}/contents/${path}`;

  const body = {
    message,
    content: btoa(content),
    branch: getDefaultBranch(),
  };
  if (sha) body.sha = sha;

  const resp = await fetch(url, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`GitHub write failed: ${resp.status} ${err.message || ''}`);
  }

  return await resp.json();
}

/**
 * Delete a file.
 */
export async function deleteFile(token, path, message, sha) {
  const repo = getSiteRepo();
  const url = `${GITHUB_API}/repos/${repo}/contents/${path}`;

  const resp = await fetch(url, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ message, sha, branch: getDefaultBranch() }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`GitHub delete failed: ${resp.status} ${err.message || ''}`);
  }

  return await resp.json();
}

/**
 * Recursively list all files in a directory.
 * Uses the Git Tree API for efficiency, falls back to Contents API.
 * Returns array of { name, path, sha, type, size }.
 */
export async function listDirectory(token, dirPath, ref) {
  const repo = getSiteRepo();
  if (!ref) ref = getDefaultBranch();

  // Try tree API first (single request for entire subtree)
  try {
    const url = `${GITHUB_API}/repos/${repo}/git/trees/${ref}:${dirPath}?recursive=1`;
    const resp = await fetch(url, { headers: headers(token) });

    if (resp.ok) {
      const data = await resp.json();
      return (data.tree || [])
        .filter(item => item.type === 'blob')
        .map(item => ({
          name: item.path.split('/').pop(),
          path: `${dirPath}/${item.path}`,
          sha: item.sha,
          type: 'file',
          size: item.size || 0,
        }));
    }

    // Tree API failed — fall through to contents API
    console.warn(`[cms-admin] Tree API returned ${resp.status} for ${dirPath}, falling back to contents API`);
  } catch (e) {
    console.warn('[cms-admin] Tree API error, falling back to contents API:', e.message);
  }

  // Fallback: contents API (non-recursive, one level at a time)
  return listDirectoryRecursive(token, dirPath, ref);
}

/**
 * Recursively list files using the Contents API (fallback).
 */
async function listDirectoryRecursive(token, dirPath, ref) {
  const items = await listFiles(token, dirPath, ref);
  const results = [];

  for (const item of items) {
    if (item.type === 'file') {
      results.push(item);
    } else if (item.type === 'dir') {
      const subItems = await listDirectoryRecursive(token, item.path, ref);
      results.push(...subItems);
    }
  }

  return results;
}

/**
 * Upload an image to the repo.
 * Stores in public/images/uploads/ with a unique filename.
 */
export async function uploadImage(token, file, collectionName) {
  const ext = file.name.split('.').pop().toLowerCase();
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
  const uniqueId = Date.now().toString(36);
  const filename = `${safeName}-${uniqueId}.${ext}`;
  const path = `public/images/uploads/${filename}`;

  // Read file as base64
  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  const result = await writeFile(
    token,
    path,
    atob(base64),
    `Upload image: ${filename}`
  );

  return {
    url: `/images/uploads/${filename}`,
    path,
    sha: result.content.sha,
  };
}
