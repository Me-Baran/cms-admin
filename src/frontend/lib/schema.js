/**
 * Collection schema — dynamic at runtime.
 *
 * Collections are defined by the integration at build time via __CMS_ADMIN_MANIFEST__.
 * If no manifest is available (standalone mode), falls back to defaults.
 *
 * The admin page reads the manifest and uses this module to access collection info.
 */

// Manifest is injected at build time by the Astro integration
const MANIFEST = typeof __CMS_ADMIN_MANIFEST__ !== 'undefined'
  ? __CMS_ADMIN_MANIFEST__
  : { collections: {}, settings: null };

export const COLLECTIONS = MANIFEST.collections || {};
export const COLLECTION_KEYS = Object.keys(COLLECTIONS);
export const SETTINGS_CONFIG = MANIFEST.settings || null;

/**
 * Get default values for a collection's fields.
 */
export function getDefaults(collectionName) {
  const col = COLLECTIONS[collectionName];
  if (!col) return {};
  const defaults = {};
  for (const field of col.fields) {
    if (field.default !== undefined) {
      defaults[field.name] = field.default;
    } else if (field.type === 'boolean') {
      defaults[field.name] = false;
    } else if (field.type === 'number') {
      defaults[field.name] = field.default ?? 0;
    } else if (field.type === 'tags' || field.type === 'list') {
      defaults[field.name] = [];
    } else if (field.type === 'repeatable') {
      defaults[field.name] = [];
    } else {
      defaults[field.name] = '';
    }
  }
  return defaults;
}

/**
 * Generate a slug from a title string.
 */
export function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
