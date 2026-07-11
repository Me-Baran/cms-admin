import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta.env
import.meta.env.PUBLIC_SITE_REPO = 'test-org/test-repo';

describe('media.js operations (mocked)', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    import.meta.env.PUBLIC_SITE_REPO = 'test-org/test-repo';
  });

  it('loadMedia parses _media.json correctly', async () => {
    const { loadMedia } = await import('../src/frontend/lib/media.js');

    const mediaData = {
      images: {
        'images/uploads/test.webp': {
          alt: 'Test image',
          title: 'Test',
          caption: '',
          seo: { ogTitle: '', ogDescription: '' },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa(JSON.stringify(mediaData)),
        sha: 'media-sha-1',
      }),
    });

    const result = await loadMedia('test-token');
    expect(result.images).toBeDefined();
    expect(result.images['images/uploads/test.webp'].alt).toBe('Test image');
    expect(result.sha).toBe('media-sha-1');
  });

  it('loadMedia returns empty structure when file not found', async () => {
    const { loadMedia } = await import('../src/frontend/lib/media.js');

    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
    });

    const result = await loadMedia('test-token');
    expect(result.images).toEqual({});
    expect(result.sha).toBeNull();
  });

  it('loadMedia handles malformed JSON gracefully', async () => {
    const { loadMedia } = await import('../src/frontend/lib/media.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa('not valid json{{'),
        sha: 'bad-sha',
      }),
    });

    const result = await loadMedia('test-token');
    expect(result.images).toEqual({});
    expect(result.sha).toBe('bad-sha');
  });

  it('saveMedia writes JSON to GitHub', async () => {
    const { saveMedia } = await import('../src/frontend/lib/media.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'new-media-sha' } }),
    });

    const mediaData = { images: { 'test.webp': { alt: 'Test' } } };
    const sha = await saveMedia('test-token', mediaData, 'old-sha');

    expect(sha).toBe('new-media-sha');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('contents/public/images/_media.json'),
      expect.objectContaining({ method: 'PUT' })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sha).toBe('old-sha');
    const written = JSON.parse(atob(body.content));
    expect(written.images['test.webp'].alt).toBe('Test');
  });

  it('saveMedia creates file when sha is null', async () => {
    const { saveMedia } = await import('../src/frontend/lib/media.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'created-sha' } }),
    });

    await saveMedia('test-token', { images: {} }, null);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sha).toBeUndefined();
    expect(body.message).toBe('Create media metadata');
  });

  it('addExternalUrl adds external entry', async () => {
    const { addExternalUrl } = await import('../src/frontend/lib/media.js');

    // loadMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa(JSON.stringify({ images: {} })),
        sha: 'sha-1',
      }),
    });

    // saveMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'sha-2' } }),
    });

    const result = await addExternalUrl('test-token', 'https://images.unsplash.com/photo-123', {
      alt: 'Stock photo',
      title: 'Unsplash Photo',
    });

    expect(result.path).toBe('https://images.unsplash.com/photo-123');
    expect(result.entry.external).toBe(true);
    expect(result.entry.alt).toBe('Stock photo');

    // Verify the saved data includes the external entry
    const saveBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const written = JSON.parse(atob(saveBody.content));
    expect(written.images['https://images.unsplash.com/photo-123'].external).toBe(true);
  });

  it('updateMetadata updates specific fields', async () => {
    const { updateMetadata } = await import('../src/frontend/lib/media.js');

    const existingData = {
      images: {
        'images/uploads/test.webp': {
          alt: 'Old alt',
          title: 'Old title',
          caption: '',
          seo: { ogTitle: '', ogDescription: '' },
        },
      },
    };

    // loadMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa(JSON.stringify(existingData)),
        sha: 'sha-1',
      }),
    });

    // saveMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'sha-2' } }),
    });

    const result = await updateMetadata('test-token', 'images/uploads/test.webp', {
      alt: 'New alt text',
      seo: { ogTitle: 'OG Title' },
    });

    expect(result.mediaSha).toBe('sha-2');

    // Verify the saved data
    const saveBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const written = JSON.parse(atob(saveBody.content));
    expect(written.images['images/uploads/test.webp'].alt).toBe('New alt text');
    expect(written.images['images/uploads/test.webp'].title).toBe('Old title'); // unchanged
    expect(written.images['images/uploads/test.webp'].seo.ogTitle).toBe('OG Title');
  });

  it('updateMetadata creates entry if path does not exist', async () => {
    const { updateMetadata } = await import('../src/frontend/lib/media.js');

    // loadMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa(JSON.stringify({ images: {} })),
        sha: 'sha-1',
      }),
    });

    // saveMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'sha-2' } }),
    });

    await updateMetadata('test-token', 'images/new.webp', { alt: 'New image' });

    const saveBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const written = JSON.parse(atob(saveBody.content));
    expect(written.images['images/new.webp'].alt).toBe('New image');
  });

  it('deleteMedia removes entry from metadata', async () => {
    const { deleteMedia } = await import('../src/frontend/lib/media.js');

    const existingData = {
      images: {
        'images/uploads/to-delete.webp': { alt: 'Delete me' },
        'images/uploads/keep.webp': { alt: 'Keep me' },
      },
    };

    // loadMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa(JSON.stringify(existingData)),
        sha: 'sha-1',
      }),
    });

    // saveMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'sha-2' } }),
    });

    // deleteFile call (image file)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await deleteMedia(
      'test-token',
      'images/uploads/to-delete.webp',
      'media-sha',
      'file-sha-1'
    );

    expect(result.mediaSha).toBe('sha-2');

    // Verify the entry was removed
    const saveBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const written = JSON.parse(atob(saveBody.content));
    expect(written.images['images/uploads/to-delete.webp']).toBeUndefined();
    expect(written.images['images/uploads/keep.webp']).toBeDefined();
  });

  it('deleteMedia skips file deletion for external URLs', async () => {
    const { deleteMedia } = await import('../src/frontend/lib/media.js');

    const existingData = {
      images: {
        'https://example.com/photo.jpg': { alt: 'External', external: true },
      },
    };

    // loadMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa(JSON.stringify(existingData)),
        sha: 'sha-1',
      }),
    });

    // saveMedia call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'sha-2' } }),
    });

    await deleteMedia('test-token', 'https://example.com/photo.jpg', 'media-sha', null);

    // Only 2 calls (loadMedia + saveMedia), no deleteFile
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('media.js scanImages (mocked)', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    import.meta.env.PUBLIC_SITE_REPO = 'test-org/test-repo';
  });

  it('scanImages filters image files from tree API', async () => {
    const { scanImages } = await import('../src/frontend/lib/media.js');

    // Tree API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: 'uploads/photo-1.webp', sha: 's1', type: 'blob', size: 1000 },
          { path: 'uploads/photo-2.jpg', sha: 's2', type: 'blob', size: 2000 },
          { path: '_media.json', sha: 's3', type: 'blob', size: 500 },
          { path: 'uploads', sha: 's4', type: 'tree' },
          { path: 'readme.txt', sha: 's5', type: 'blob', size: 100 },
        ],
      }),
    });

    const result = await scanImages('test-token');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('photo-1.webp');
    expect(result[0].url).toBe('/images/uploads/photo-1.webp');
    expect(result[1].name).toBe('photo-2.jpg');
    // _media.json should be filtered out
    expect(result.every(f => f.name !== '_media.json')).toBe(true);
  });

  it('scanImages returns empty array on 404', async () => {
    const { scanImages } = await import('../src/frontend/lib/media.js');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    // Fallback to contents API also returns 404
    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
    });

    const result = await scanImages('test-token');
    expect(result).toEqual([]);
  });
});

describe('media.js scanUsage (mocked)', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    import.meta.env.PUBLIC_SITE_REPO = 'test-org/test-repo';
  });

  it('scanUsage extracts image paths from frontmatter', async () => {
    const { scanUsage } = await import('../src/frontend/lib/media.js');

    // tree API call (falls through)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    // listFiles (contents API fallback) for blog collection
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { name: 'post-1.md', path: 'src/content/blog/post-1.md', sha: 's1', type: 'file' },
      ],
    });

    // readFile for post-1.md
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa('---\ntitle: Post 1\nfeaturedImage: /images/hero.webp\n---\nBody'),
        sha: 's1',
      }),
    });

    const collections = {
      blog: {
        label: 'Blog',
        folder: 'src/content/blog',
        fields: [
          { name: 'title', label: 'Title', type: 'string' },
          { name: 'featuredImage', label: 'Image', type: 'image' },
        ],
      },
    };

    const result = await scanUsage('test-token', collections);
    expect(result['/images/hero.webp']).toBeDefined();
    expect(result['/images/hero.webp']).toHaveLength(1);
    expect(result['/images/hero.webp'][0].collection).toBe('blog');
    expect(result['/images/hero.webp'][0].slug).toBe('post-1');
  });
});
