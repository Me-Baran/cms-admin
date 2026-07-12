import { describe, it, expect } from 'vitest';
import { inferFieldsFromYaml, inferType } from '../src/integration.js';

describe('inferType', () => {
  it('detects image fields', () => {
    expect(inferType('featuredImage', '/images/blog/x.jpg')).toBe('image');
    expect(inferType('photo', '/images/dentists/x.jpg')).toBe('image');
    expect(inferType('image', '/x.png')).toBe('image');
  });

  it('detects common typed fields', () => {
    expect(inferType('draft', 'false')).toBe('boolean');
    expect(inferType('order', '1')).toBe('number');
    expect(inferType('pubDate', '2026-01-01')).toBe('date');
    expect(inferType('tags', '')).toBe('tags');
    expect(inferType('relatedServices', '')).toBe('list');
    expect(inferType('description', 'x')).toBe('text');
    expect(inferType('slug', 'x')).toBe('string');
  });
});

describe('inferFieldsFromYaml CRLF handling', () => {
  const yamlLines = [
    'title: "Welcome"',
    'description: "Intro"',
    'pubDate: 2026-07-01',
    'featuredImage: /images/blog/welcome.jpg',
    'draft: false',
  ];

  it('parses all fields with LF line endings', () => {
    const fields = inferFieldsFromYaml(yamlLines.join('\n'));
    const names = fields.map((f) => f.name);
    expect(names).toContain('title');
    expect(names).toContain('featuredImage');
    expect(names).toContain('draft');
    expect(names).toContain('body');
  });

  it('parses all fields with CRLF line endings (regression)', () => {
    const fields = inferFieldsFromYaml(yamlLines.join('\r\n'));
    const names = fields.map((f) => f.name);
    // Previously only the last frontmatter line matched with CRLF input.
    expect(names).toContain('title');
    expect(names).toContain('description');
    expect(names).toContain('pubDate');
    expect(names).toContain('featuredImage');
    expect(names).toContain('draft');
    const img = fields.find((f) => f.name === 'featuredImage');
    expect(img.type).toBe('image');
  });

  it('marks title as required', () => {
    const fields = inferFieldsFromYaml('title: X\r\nphoto: /a.jpg');
    expect(fields.find((f) => f.name === 'title').required).toBe(true);
    expect(fields.find((f) => f.name === 'photo').type).toBe('image');
  });
});
