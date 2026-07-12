import { describe, it, expect, vi, beforeEach } from 'vitest';
import { headers, getSiteRepo, encodeBase64Utf8, decodeBase64Utf8, bytesToBase64 } from '../src/frontend/lib/github.js';

describe('base64 encoding', () => {
  it('round-trips ASCII', () => {
    expect(decodeBase64Utf8(encodeBase64Utf8('Hello World'))).toBe('Hello World');
  });

  it('round-trips Turkish and Persian (non-Latin1) text', () => {
    const s = 'Estetik Diş Hekimliği — دندانپزشکی زیبایی';
    expect(decodeBase64Utf8(encodeBase64Utf8(s))).toBe(s);
  });

  it('encodeBase64Utf8 does not throw on non-Latin1 (regression for btoa)', () => {
    expect(() => encodeBase64Utf8('Diş')).not.toThrow();
  });

  it('decodes GitHub-style base64 with embedded newlines', () => {
    const raw = encodeBase64Utf8('line content');
    const withNewlines = raw.replace(/(.{4})/g, '$1\n');
    expect(decodeBase64Utf8(withNewlines)).toBe('line content');
  });

  it('bytesToBase64 handles large arrays without stack overflow', () => {
    const big = new Uint8Array(200000).fill(65);
    const b64 = bytesToBase64(big);
    expect(atob(b64).length).toBe(200000);
  });
});

// Mock import.meta.env
const originalEnv = { ...import.meta.env };

describe('github.js utilities', () => {
  beforeEach(() => {
    // Reset env
    import.meta.env.PUBLIC_SITE_REPO = 'test-org/test-repo';
  });

  it('getSiteRepo returns configured repo', () => {
    import.meta.env.PUBLIC_SITE_REPO = 'myorg/myrepo';
    expect(getSiteRepo()).toBe('myorg/myrepo');
  });

  it('getSiteRepo returns empty string when not set', () => {
    import.meta.env.PUBLIC_SITE_REPO = '';
    expect(getSiteRepo()).toBe('');
  });
});

// Integration-style tests that mock fetch
describe('GitHub API operations (mocked)', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    import.meta.env.PUBLIC_SITE_REPO = 'test-org/test-repo';
  });

  it('readFile returns content and sha on success', async () => {
    const { readFile } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa('---\ntitle: Test\n---\nBody'),
        sha: 'abc123',
      }),
    });

    const result = await readFile('test-token', 'src/content/blog/test.md');
    expect(result).toBeDefined();
    expect(result.sha).toBe('abc123');
    expect(result.content).toContain('title: Test');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('repos/test-org/test-repo/contents/src/content/blog/test.md'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('readFile returns null on 404', async () => {
    const { readFile } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
    });

    const result = await readFile('test-token', 'src/content/blog/nonexistent.md');
    expect(result).toBeNull();
  });

  it('readFile throws on non-404 error', async () => {
    const { readFile } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      status: 403,
      ok: false,
      json: async () => ({ message: 'Rate limit exceeded' }),
    });

    await expect(readFile('test-token', 'src/content/blog/test.md'))
      .rejects.toThrow('GitHub read failed: 403');
  });

  it('listFiles returns array of files', async () => {
    const { listFiles } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { name: 'post1.md', path: 'src/content/blog/post1.md', sha: 'sha1', type: 'file' },
        { name: 'post2.md', path: 'src/content/blog/post2.md', sha: 'sha2', type: 'file' },
      ],
    });

    const result = await listFiles('test-token', 'src/content/blog');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('post1.md');
  });

  it('listFiles returns empty array on 404', async () => {
    const { listFiles } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      status: 404,
      ok: false,
    });

    const result = await listFiles('test-token', 'nonexistent/path');
    expect(result).toEqual([]);
  });

  it('writeFile sends PUT with base64 content', async () => {
    const { writeFile } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'new-sha' } }),
    });

    await writeFile('test-token', 'src/content/blog/test.md', 'file content', 'Create test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('repos/test-org/test-repo/contents/src/content/blog/test.md'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.any(String),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message).toBe('Create test');
    expect(atob(body.content)).toBe('file content');
    expect(body.sha).toBeUndefined();
  });

  it('writeFile includes sha for updates', async () => {
    const { writeFile } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: { sha: 'updated-sha' } }),
    });

    await writeFile('test-token', 'test.md', 'content', 'Update', 'old-sha');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sha).toBe('old-sha');
  });

  it('deleteFile sends DELETE request', async () => {
    const { deleteFile } = await import('../src/frontend/lib/github.js');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await deleteFile('test-token', 'test.md', 'Delete test', 'abc123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sha).toBe('abc123');
    expect(body.message).toBe('Delete test');
  });
});
