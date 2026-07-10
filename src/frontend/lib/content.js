/**
 * Content CRUD operations.
 *
 * Reads/writes Markdown files with YAML frontmatter via the GitHub API.
 * Parses frontmatter using gray-matter (or manual YAML parsing for browser).
 */

import { COLLECTIONS, getDefaults, slugify } from './schema.js';
import { readFile, listFiles, writeFile, deleteFile } from './github.js';

/**
 * Parse YAML frontmatter from a markdown string.
 * Browser-safe: doesn't need gray-matter (which is Node-only).
 */
export function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw.trim() };

  const yamlStr = match[1];
  const body = match[2].trim();
  const data = parseYamlSimple(yamlStr);
  return { data, body };
}

/**
 * Simple YAML parser for frontmatter.
 * Handles: strings, numbers, booleans, dates, arrays, nested arrays of objects.
 */
function parseYamlSimple(yaml) {
  const data = {};
  const lines = yaml.split('\n');
  let currentKey = null;
  let currentArray = null;
  let currentObject = null;
  let inMultiline = false;
  let multilineKey = '';
  let multilineValue = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rawLine = line.replace(/\r$/, '');

    // Continuation of multiline string
    if (inMultiline) {
      if (rawLine.match(/^\s{2,}/)) {
        multilineValue += ' ' + rawLine.trim();
        continue;
      } else {
        data[multilineKey] = multilineValue.trim();
        inMultiline = false;
        multilineKey = '';
        multilineValue = '';
      }
    }

    // Array item under a key (indented with -)
    const arrayMatch = rawLine.match(/^\s+-\s+(.+)$/);
    if (arrayMatch && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(parseValue(arrayMatch[1]));
      continue;
    }

    // Nested object in array (key: value under - )
    const objMatch = rawLine.match(/^\s+(\w+):\s*(.*)$/);
    if (objMatch && currentArray !== null) {
      if (!currentObject) {
        currentObject = {};
        if (!Array.isArray(data[currentKey])) data[currentKey] = [];
        data[currentKey].push(currentObject);
      }
      currentObject[objMatch[1]] = parseValue(objMatch[2]);
      continue;
    }

    // New key
    const keyMatch = rawLine.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      currentObject = null;
      currentArray = null;

      if (value === '' || value === '|' || value === '>') {
        // Could be multiline or array
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.match(/^\s+-\s/)) {
          currentArray = [];
          data[currentKey] = currentArray;
        } else if (value === '|' || value === '>') {
          inMultiline = true;
          multilineKey = currentKey;
          multilineValue = '';
        } else {
          data[currentKey] = '';
        }
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
        data[currentKey] = value.slice(1, -1).split(',').map(s => parseValue(s.trim()));
      } else {
        data[currentKey] = parseValue(value);
      }
      continue;
    }
  }

  if (inMultiline && multilineKey) {
    data[multilineKey] = multilineValue.trim();
  }

  return data;
}

/**
 * Parse a YAML value string to its JS type.
 */
function parseValue(str) {
  if (!str || str === '~' || str === 'null') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str; // Keep dates as strings
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
  // Remove surrounding quotes and unescape
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return str;
}

/**
 * Serialize data + body back to frontmatter markdown.
 */
export function serializeFrontmatter(data, body) {
  const lines = ['---'];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // Check if array of objects (like faq)
      if (typeof value[0] === 'object' && value[0] !== null) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  -`);
          for (const [k, v] of Object.entries(item)) {
            if (v !== null && v !== undefined && v !== '') {
              lines.push(`    ${k}: ${formatYamlValue(v)}`);
            }
          }
        }
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${formatYamlValue(item)}`);
        }
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${formatYamlValue(value)}`);
    }
  }

  lines.push('---');
  lines.push('');
  lines.push(body);

  return lines.join('\n');
}

function formatYamlValue(val) {
  if (val === null || val === undefined) return 'null';
  const str = String(val);
  // Quote if contains special chars
  if (str.includes(':') || str.includes('#') || str.includes('"') || str.includes("'") || str.includes('\n')) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * List all items in a collection.
 * Returns array of { slug, ...frontmatter }.
 */
export async function listCollection(token, collectionName) {
  const col = COLLECTIONS[collectionName];
  if (!col) throw new Error(`Unknown collection: ${collectionName}`);

  const files = await listFiles(token, col.folder);
  const items = [];

  for (const file of files) {
    if (file.type !== 'file') continue;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['md', 'mdx'].includes(ext)) continue;

    const slug = file.name.replace(/\.(md|mdx)$/, '');
    items.push({ slug, path: file.path, sha: file.sha, name: file.name });
  }

  return items;
}

/**
 * Get a single content item by slug.
 * Returns { slug, data, body, sha, path }.
 */
export async function getContent(token, collectionName, slug) {
  const col = COLLECTIONS[collectionName];
  if (!col) throw new Error(`Unknown collection: ${collectionName}`);

  const ext = col.extension || '.md';
  const path = `${col.folder}/${slug}${ext}`;
  const result = await readFile(token, path);

  if (!result) return null;

  const { data, body } = parseFrontmatter(result.content);
  return { slug, data, body, sha: result.sha, path };
}

/**
 * Create a new content item.
 */
export async function createContent(token, collectionName, slug, data, body) {
  const col = COLLECTIONS[collectionName];
  if (!col) throw new Error(`Unknown collection: ${collectionName}`);

  const ext = col.extension || '.md';
  const path = `${col.folder}/${slug}${ext}`;
  const content = serializeFrontmatter(data, body);

  const result = await writeFile(
    token,
    path,
    content,
    `Create ${collectionName}: ${data.title || data.name || slug}`
  );

  return { slug, path, sha: result.content.sha };
}

/**
 * Update an existing content item.
 */
export async function updateContent(token, collectionName, slug, data, body, sha) {
  const col = COLLECTIONS[collectionName];
  if (!col) throw new Error(`Unknown collection: ${collectionName}`);

  const ext = col.extension || '.md';
  const path = `${col.folder}/${slug}${ext}`;
  const content = serializeFrontmatter(data, body);

  const result = await writeFile(
    token,
    path,
    content,
    `Update ${collectionName}: ${data.title || data.name || slug}`,
    sha
  );

  return { slug, path, sha: result.content.sha };
}

/**
 * Delete a content item.
 */
export async function deleteContent(token, collectionName, slug, sha) {
  const col = COLLECTIONS[collectionName];
  if (!col) throw new Error(`Unknown collection: ${collectionName}`);

  const ext = col.extension || '.md';
  const path = `${col.folder}/${slug}${ext}`;

  await deleteFile(
    token,
    path,
    `Delete ${collectionName}: ${slug}`,
    sha
  );

  return { deleted: true, slug };
}

/**
 * Load all items in a collection with their frontmatter.
 * Warning: makes one API call per item. Use listCollection for the slug list first.
 */
export async function loadCollection(token, collectionName) {
  const items = await listCollection(token, collectionName);
  const loaded = [];

  for (const item of items) {
    try {
      const content = await getContent(token, collectionName, item.slug);
      if (content) {
        loaded.push(content);
      }
    } catch (e) {
      console.warn(`Failed to load ${item.slug}:`, e.message);
    }
  }

  return loaded;
}
