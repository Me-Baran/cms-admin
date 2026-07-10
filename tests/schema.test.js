import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the manifest that would be injected by the Astro integration
const mockManifest = {
  collections: {
    blog: {
      label: 'Blog',
      folder: 'src/content/blog',
      icon: ' ',
      fields: [
        { name: 'title', label: 'Title', type: 'string', required: true },
        { name: 'description', label: 'Description', type: 'text' },
        { name: 'draft', label: 'Draft', type: 'boolean', default: false },
        { name: 'order', label: 'Order', type: 'number', default: 99 },
        { name: 'tags', label: 'Tags', type: 'tags' },
        { name: 'body', label: 'Body', type: 'markdown' },
      ],
    },
    services: {
      label: 'Services',
      folder: 'src/content/services',
      icon: ' ',
      fields: [
        { name: 'title', label: 'Title', type: 'string', required: true },
        { name: 'featured', label: 'Featured', type: 'boolean', default: false },
        { name: 'order', label: 'Order', type: 'number', default: 99 },
        { name: 'body', label: 'Body', type: 'markdown' },
      ],
    },
  },
  settings: { file: 'src/config.ts' },
};

// Set the global that the integration would inject
globalThis.__CMS_ADMIN_MANIFEST__ = mockManifest;

// Now import the module (it reads the global on load)
const { COLLECTIONS, COLLECTION_KEYS, SETTINGS_CONFIG, getDefaults, slugify } = await import('../src/frontend/lib/schema.js');

describe('COLLECTIONS (dynamic from manifest)', () => {
  it('loads collections from manifest', () => {
    expect(COLLECTION_KEYS).toEqual(['blog', 'services']);
    expect(COLLECTIONS.blog.label).toBe('Blog');
    expect(COLLECTIONS.services.label).toBe('Services');
  });

  it('each collection has required fields', () => {
    for (const key of COLLECTION_KEYS) {
      const col = COLLECTIONS[key];
      expect(col.label).toBeDefined();
      expect(col.folder).toBeDefined();
      expect(col.fields).toBeDefined();
      expect(Array.isArray(col.fields)).toBe(true);
    }
  });

  it('blog has expected fields', () => {
    const fieldNames = COLLECTIONS.blog.fields.map(f => f.name);
    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('description');
    expect(fieldNames).toContain('body');
    expect(fieldNames).toContain('draft');
  });
});

describe('SETTINGS_CONFIG', () => {
  it('loads settings config from manifest', () => {
    expect(SETTINGS_CONFIG).toBeDefined();
    expect(SETTINGS_CONFIG.file).toBe('src/config.ts');
  });
});

describe('getDefaults (dynamic)', () => {
  it('returns defaults for blog', () => {
    const defaults = getDefaults('blog');
    expect(defaults.draft).toBe(false);
    expect(defaults.order).toBe(99);
    expect(defaults.tags).toEqual([]);
    expect(defaults.title).toBe('');
  });

  it('returns defaults for services', () => {
    const defaults = getDefaults('services');
    expect(defaults.featured).toBe(false);
    expect(defaults.order).toBe(99);
  });

  it('returns empty object for unknown collection', () => {
    const defaults = getDefaults('nonexistent');
    expect(defaults).toEqual({});
  });
});

describe('slugify', () => {
  it('converts to lowercase and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('trims and strips special chars', () => {
    expect(slugify('  Hello! World  ')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});
