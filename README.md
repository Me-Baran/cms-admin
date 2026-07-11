# Astro Visual CMS

A drag-and-drop visual CMS for Astro. Edit content visually, manage collections, and deploy — all from your browser.

## Features

- Visual drag-and-drop page editing
- Content collection management (blog, services, dentists, FAQ, testimonials)
- Site settings editor
- GitHub-based — content lives in your repo as Markdown
- Supabase auth for secure admin access
- Auto-detects repo and branch from git remote
- i18n support (English, Turkish, Farsi)

## Quick Start

```bash
# Install in your Astro project
npm install git+https://github.com/Me-Baran/cms-admin.git

# Add to astro.config.mjs
import cmsAdmin from 'cms-admin';
export default defineConfig({
  integrations: [cmsAdmin()]
});

# Set environment variables
PUBLIC_SUPABASE_URL=your-project-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run dev server
npm run dev
```

Visit `/admin` to access the CMS.

## Setup

### GitHub OAuth

1. Create a GitHub OAuth App at github.com/settings/developers
2. Add the Client ID and Client Secret to your Supabase project under Authentication → Providers → GitHub

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |

## Configuration

```js
cmsAdmin({
  route: '/admin',           // Admin route (default: /admin)
  repo: 'owner/repo',       // Auto-detected from git if omitted
  branch: 'main',           // Auto-detected from git if omitted
  collections: {},           // Override auto-detected collections
  settings: {                // Site settings editor
    file: 'src/config.ts',
    exportName: 'SITE'
  }
})
```

## How It Works

1. **Auth**: Users sign in via GitHub OAuth through Supabase
2. **Read**: Admin reads content from your GitHub repo via API
3. **Write**: Changes create commits directly to your repo
4. **Deploy**: Pushes trigger your CI/CD pipeline (GitHub Actions, Vercel, etc.)

## License

Astro Visual CMS is licensed under a dual licensing model.

### Community License (Free)

Free for personal websites, learning, open-source, and non-commercial projects. Attribution required.

See [LICENSE](LICENSE) for full terms.

### Commercial License

Required for client projects, agencies, companies, SaaS products, and commercial use.

See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for details.

### Attribution

If you use Astro Visual CMS under the Community License, please include:

```
Powered by Astro Visual CMS
https://github.com/Me-Baran/cms-admin
```

## Contributing

Contributions are welcome! By submitting contributions, you agree that your contributions may be distributed under the same license as the Software.
