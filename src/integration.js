/**
 * Astro Integration — cms-admin
 *
 * A generic admin for any Astro project with content collections.
 *
 * Usage in astro.config.mjs:
 *   import cmsAdmin from 'cms-admin';
 *   export default defineConfig({ integrations: [cmsAdmin()] });
 *
 * Options:
 *   route: string — admin route path (default: '/admin')
 *   collections: object — override auto-detected collections
 *   settings: { file, fields } — site settings editor config
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

export default function cmsAdmin(options = {}) {
  const adminRoute = options.route || '/admin';

  return {
    name: 'cms-admin',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectRoute, config, logger }) => {
        // Inject admin route using URL pattern (works for npm packages)
        injectRoute({
          pattern: adminRoute,
          entrypoint: new URL('./frontend/pages/admin.astro', import.meta.url),
        });

        // Discover collections from the site's content directory
        const siteRoot = typeof config.root === 'string'
          ? config.root
          : fileURLToPath(config.root);
        const collections = options.collections || discoverCollections(siteRoot, logger);

        // Auto-detect repo and branch from git remote
        const gitInfo = detectGitInfo(siteRoot, logger);
        const repo = options.repo || gitInfo.repo || '';
        const branch = options.branch || gitInfo.branch || 'main';

        // Write manifest for the admin page to read at runtime
        const manifest = {
          collections,
          settings: options.settings || discoverSettings(siteRoot, logger),
        };

        // Pass manifest + git info via Vite define (available at build time)
        updateConfig({
          vite: {
            define: {
              __CMS_ADMIN_MANIFEST__: JSON.stringify(manifest),
              __CMS_ADMIN_REPO__: JSON.stringify(repo),
              __CMS_ADMIN_BRANCH__: JSON.stringify(branch),
            },
            resolve: {
              alias: {
                '@cms': new URL('./frontend', import.meta.url).pathname,
              },
            },
          },
        });

        logger.info(`Admin route: ${adminRoute}`);
        logger.info(`Collections: ${Object.keys(collections).join(', ')}`);
        logger.info(`Git repo: ${repo} @ ${branch}`);
      },
    },
  };
}

/**
 * Auto-discover content collections from src/content/ directories.
 * Reads folder names and inspects the first .md/.mdx file to infer fields.
 */
function discoverCollections(siteRoot, logger) {
  const contentDir = join(siteRoot, 'src', 'content');
  if (!existsSync(contentDir)) {
    logger.warn('No src/content/ directory found. No collections auto-detected.');
    return {};
  }

  const collections = {};

  try {
    const entries = readdirSync(contentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      const folderPath = join(contentDir, name);
      const files = readdirSync(folderPath).filter(f =>
        f.endsWith('.md') || f.endsWith('.mdx')
      );

      if (files.length === 0) continue;

      // Infer fields from the first file's frontmatter
      const fields = inferFields(folderPath, files);

      collections[name] = {
        label: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' '),
        folder: `src/content/${name}`,
        icon: getCollectionIcon(name),
        fields,
      };
    }
  } catch (e) {
    logger.warn('Failed to auto-discover collections: ' + e.message);
  }

  return collections;
}

/**
 * Infer field definitions from a content file's frontmatter.
 */
function inferFields(folderPath, files) {
  const filePath = join(folderPath, files[0]);
  try {
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return getDefaultFields();

    const yaml = match[1];
    const fields = [];
    const lines = yaml.split('\n');

    for (const line of lines) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim();

      if (key === 'body') continue;

      const field = { name: key, label: capitalize(key), type: inferType(key, val) };
      if (['title', 'name', 'question'].includes(key)) field.required = true;
      fields.push(field);
    }

    // Always add body field
    fields.push({ name: 'body', label: 'Body', type: 'markdown' });

    return fields;
  } catch {
    return getDefaultFields();
  }
}

function inferType(key, value) {
  if (['draft', 'featured'].includes(key)) return 'boolean';
  if (['order', 'rating'].includes(key)) return 'number';
  if (['pubDate', 'updatedDate', 'date'].includes(key)) return 'date';
  if (['tags', 'categories'].includes(key)) return 'tags';
  if (['relatedServices', 'relatedBlogs', 'education', 'treatments'].includes(key)) return 'list';
  if (['featuredImage', 'photo', 'image'].includes(key)) return 'image';
  if (key === 'description' || key === 'biography' || key === 'text') return 'text';
  return 'string';
}

function getDefaultFields() {
  return [
    { name: 'title', label: 'Title', type: 'string', required: true },
    { name: 'body', label: 'Body', type: 'markdown' },
  ];
}

function getCollectionIcon(name) {
  const icons = {
    blog: ' ', posts: ' ', articles: ' ',
    services: ' ', dentists: ' ', doctors: ' ',
    faq: ' ', questions: ' ', testimonials: ' ',
    projects: ' ', portfolio: ' ', products: ' ',
    pages: ' ', authors: ' ', team: ' ',
  };
  return icons[name.toLowerCase()] || ' ';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
}

/**
 * Discover site settings config.
 * Returns null if no recognizable config file is found.
 */
function discoverSettings(siteRoot, logger) {
  const configPath = join(siteRoot, 'src', 'config.ts');
  if (existsSync(configPath)) {
    return {
      file: 'src/config.ts',
      // Fields will be parsed at runtime from the file
    };
  }
  return null;
}

/**
 * Auto-detect git repo and branch from the project's git remote.
 * Returns { repo: 'owner/name', branch: 'main' } or empty values.
 */
function detectGitInfo(siteRoot, logger) {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: siteRoot,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    // Parse owner/repo from HTTPS or SSH URL
    // https://github.com/Me-Baran/astro-website.git → Me-Baran/astro-website
    // git@github.com:Me-Baran/astro-website.git → Me-Baran/astro-website
    let repo = '';
    const httpsMatch = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      repo = `${httpsMatch[1]}/${httpsMatch[2]}`;
    }

    const branch = execSync('git branch --show-current', {
      cwd: siteRoot,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim() || 'main';

    return { repo, branch };
  } catch (e) {
    logger.warn('Could not detect git info: ' + e.message);
    return { repo: '', branch: 'main' };
  }
}
