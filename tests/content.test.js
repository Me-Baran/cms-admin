import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  serializeFrontmatter,
  listCollection,
  getContent,
  createContent,
  updateContent,
  deleteContent,
} from '../src/frontend/lib/content.js';

describe('parseFrontmatter', () => {
  it('parses simple frontmatter', () => {
    const input = `---
title: Hello World
description: A test post
---
Body content here.`;
    const { data, body } = parseFrontmatter(input);
    expect(data.title).toBe('Hello World');
    expect(data.description).toBe('A test post');
    expect(body).toBe('Body content here.');
  });

  it('parses boolean values', () => {
    const input = `---
featured: true
draft: false
---
Body`;
    const { data } = parseFrontmatter(input);
    expect(data.featured).toBe(true);
    expect(data.draft).toBe(false);
  });

  it('parses numeric values', () => {
    const input = `---
order: 5
rating: 4
---
Body`;
    const { data } = parseFrontmatter(input);
    expect(data.order).toBe(5);
    expect(data.rating).toBe(4);
  });

  it('parses date strings', () => {
    const input = `---
pubDate: 2026-07-10
---
Body`;
    const { data } = parseFrontmatter(input);
    expect(data.pubDate).toBe('2026-07-10');
  });

  it('parses array values', () => {
    const input = `---
tags:
  - whitening
  - cosmetic
  - dental
---
Body`;
    const { data } = parseFrontmatter(input);
    expect(data.tags).toEqual(['whitening', 'cosmetic', 'dental']);
  });

  it('parses inline array values', () => {
    const input = `---
tags: [whitening, cosmetic]
---
Body`;
    const { data } = parseFrontmatter(input);
    expect(data.tags).toEqual(['whitening', 'cosmetic']);
  });

  it('parses relatedServices array', () => {
    const input = `---
relatedServices:
  - teeth-whitening
  - dental-implants
---
Body`;
    const { data } = parseFrontmatter(input);
    expect(data.relatedServices).toEqual(['teeth-whitening', 'dental-implants']);
  });

  it('handles empty body', () => {
    const input = `---
title: No Body
---`;
    const { data, body } = parseFrontmatter(input);
    expect(data.title).toBe('No Body');
    expect(body).toBe('');
  });

  it('handles body with markdown', () => {
    const input = `---
title: Post
---
## Heading

Some **bold** text.

- List item 1
- List item 2`;
    const { data, body } = parseFrontmatter(input);
    expect(data.title).toBe('Post');
    expect(body).toContain('## Heading');
    expect(body).toContain('**bold**');
    expect(body).toContain('- List item 1');
  });

  it('handles missing frontmatter', () => {
    const input = 'Just plain markdown';
    const { data, body } = parseFrontmatter(input);
    expect(data).toEqual({});
    expect(body).toBe('Just plain markdown');
  });

  it('handles CRLF line endings', () => {
    const input = '---\r\ntitle: Windows Post\r\ndescription: Test\r\n---\r\nBody';
    const { data, body } = parseFrontmatter(input);
    expect(data.title).toBe('Windows Post');
    expect(data.description).toBe('Test');
    expect(body).toBe('Body');
  });

  it('handles null/empty values', () => {
    const input = `---
title: Test
updatedDate: null
description: 
---
Body`;
    const { data } = parseFrontmatter(input);
    expect(data.title).toBe('Test');
    expect(data.updatedDate).toBeNull();
  });
});

describe('serializeFrontmatter', () => {
  it('serializes simple data', () => {
    const result = serializeFrontmatter(
      { title: 'Hello', description: 'World' },
      'Body content'
    );
    expect(result).toContain('---');
    expect(result).toContain('title: Hello');
    expect(result).toContain('description: World');
    expect(result).toContain('Body content');
  });

  it('serializes boolean values', () => {
    const result = serializeFrontmatter({ featured: true, draft: false }, 'Body');
    expect(result).toContain('featured: true');
    expect(result).toContain('draft: false');
  });

  it('serializes numeric values', () => {
    const result = serializeFrontmatter({ order: 5, rating: 4 }, 'Body');
    expect(result).toContain('order: 5');
    expect(result).toContain('rating: 4');
  });

  it('serializes array values', () => {
    const result = serializeFrontmatter({ tags: ['a', 'b', 'c'] }, 'Body');
    expect(result).toContain('tags:');
    expect(result).toContain('  - a');
    expect(result).toContain('  - b');
    expect(result).toContain('  - c');
  });

  it('serializes array of objects (faq)', () => {
    const result = serializeFrontmatter({
      faq: [
        { question: 'Q1?', answer: 'A1' },
        { question: 'Q2?', answer: 'A2' },
      ]
    }, 'Body');
    expect(result).toContain('faq:');
    expect(result).toContain('  -');
    expect(result).toContain('question: Q1?');
    expect(result).toContain('answer: A1');
  });

  it('skips null and empty values', () => {
    const result = serializeFrontmatter({ title: 'Test', updatedDate: null, desc: '' }, 'Body');
    expect(result).not.toContain('updatedDate');
    expect(result).not.toContain('desc');
  });

  it('skips empty arrays', () => {
    const result = serializeFrontmatter({ title: 'Test', tags: [] }, 'Body');
    expect(result).not.toContain('tags');
  });

  it('quotes values with special characters', () => {
    const result = serializeFrontmatter({ title: 'Title: A Story' }, 'Body');
    expect(result).toContain('title: "Title: A Story"');
  });

  it('roundtrips parse → serialize', () => {
    const original = `---
title: Test Post
description: A description
author: Dr. Sarah Mitchell
pubDate: 2026-07-10
featured: false
draft: false
tags:
  - cosmetic
  - whitening
relatedServices:
  - teeth-whitening
---

## Hello

Some content here.`;
    const { data, body } = parseFrontmatter(original);
    const serialized = serializeFrontmatter(data, body);
    const { data: data2, body: body2 } = parseFrontmatter(serialized);

    expect(data2.title).toBe(data.title);
    expect(data2.description).toBe(data.description);
    expect(data2.featured).toBe(data.featured);
    expect(data2.tags).toEqual(data.tags);
    expect(data2.relatedServices).toEqual(data.relatedServices);
    expect(body2).toBe(body);
  });
});

describe('parseFrontmatter + serializeFrontmatter roundtrip', () => {
  it('preserves all field types', () => {
    const data = {
      title: 'Test: A "Story"',
      description: 'Short desc',
      pubDate: '2026-01-15',
      featured: true,
      draft: false,
      order: 3,
      rating: 5,
      tags: ['tag1', 'tag2'],
      relatedServices: ['svc-1'],
    };
    const body = '# Heading\n\nParagraph with **bold**.';
    const serialized = serializeFrontmatter(data, body);
    const parsed = parseFrontmatter(serialized);

    expect(parsed.data.title).toBe(data.title);
    expect(parsed.data.description).toBe(data.description);
    expect(parsed.data.featured).toBe(true);
    expect(parsed.data.draft).toBe(false);
    expect(parsed.data.order).toBe(3);
    expect(parsed.data.rating).toBe(5);
    expect(parsed.data.tags).toEqual(data.tags);
    expect(parsed.data.relatedServices).toEqual(data.relatedServices);
    expect(parsed.body).toBe(body);
  });
});

// Tests that require GitHub API mocking
describe('GitHub-dependent functions', () => {
  // These test the function signatures and error handling
  // Actual API calls would need mocking

  it('listCollection throws for unknown collection', async () => {
    await expect(listCollection('fake-token', 'nonexistent'))
      .rejects.toThrow('Unknown collection');
  });

  it('getContent throws for unknown collection', async () => {
    await expect(getContent('fake-token', 'nonexistent', 'slug'))
      .rejects.toThrow('Unknown collection');
  });

  it('createContent throws for unknown collection', async () => {
    await expect(createContent('fake-token', 'nonexistent', 'slug', {}, ''))
      .rejects.toThrow('Unknown collection');
  });

  it('updateContent throws for unknown collection', async () => {
    await expect(updateContent('fake-token', 'nonexistent', 'slug', {}, '', 'sha'))
      .rejects.toThrow('Unknown collection');
  });

  it('deleteContent throws for unknown collection', async () => {
    await expect(deleteContent('fake-token', 'nonexistent', 'slug', 'sha'))
      .rejects.toThrow('Unknown collection');
  });
});
