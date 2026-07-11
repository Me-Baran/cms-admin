# cms-admin Progress

## Status: Phase 1-2 Complete, Generic Package + Media Library

## Milestones

| Milestone | Status | Target |
|-----------|--------|--------|
| M1: Project Scaffolding | ✅ Complete | Phase 1 |
| M2: Authentication | ✅ Complete | Phase 1 |
| M3: Content Editor UI | ✅ Complete | Phase 1 |
| M4: GitHub API Integration | ✅ Complete | Phase 1 |
| M5: Site Settings Editor | ✅ Complete | Phase 2 |
| M6: Supabase Storage Upload | ✅ Complete | Phase 2 |
| M7: Tests & CI | ✅ Complete | Phase 1-2 |
| M8: Generic Package (any Astro project) | ✅ Complete | Refactor |
| M8.5: Media Library | ✅ Complete | Phase 2.5 |
| M9: Visual Layout Editing | ⬜ Not Started | Phase 3 |
| M10: AI Assist | ⬜ Not Started | Phase 4 |
| M11: Admin MCP Server | ⬜ Not Started | Phase 4 |

## Test Results

```
Test Files  5 passed (5)
Tests       72 passed (72)
Duration    ~600ms
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| schema.test.js | 10 | Dynamic COLLECTIONS from manifest, getDefaults, slugify |
| content.test.js | 27 | parseFrontmatter, serializeFrontmatter, roundtrip, CRUD errors |
| github.test.js | 10 | readFile, listFiles, writeFile, deleteFile (mocked) |
| settings.test.js | 12 | parseConfig, parseSiteConfig, serializeConfig, serializeSiteConfig, generic exports |
| media.test.js | 13 | loadMedia, saveMedia, addExternalUrl, updateMetadata, deleteMedia, scanImages, scanUsage |

## What Makes It Generic

### Auto-Discovery (no config needed)
The integration reads `src/content/` at build time:
- Scans subdirectories (blog/, services/, etc.)
- Reads the first `.md/.mdx` file's frontmatter
- Infers field types (boolean, number, date, tags, list, image, string)
- Generates a manifest as a Vite `define` constant

### Explicit Override (for custom behavior)
```js
cmsAdmin({
  collections: { blog: { label: 'Posts', folder: '...', fields: [...] } },
  settings: { file: 'src/config.ts', exportName: 'SITE' },
})
```

### How It Follows Astro Docs
- Uses `new URL('./frontend/pages/admin.astro', import.meta.url)` for `injectRoute`
- Exports `"./admin.astro"` in package.json for npm resolution
- Uses `config.root` with `fileURLToPath()` for cross-platform paths
- Uses `logger` for build-time messages
- Uses `vite.define` to pass manifest to client code

## File Inventory

```
cms-admin/
├── package.json                  # v0.2.0, exports ./admin.astro
├── vitest.config.js
├── AGENTS.md
├── PLAN.md
├── PROGRESS.md
├── .gitignore
├── .github/workflows/ci.yml
├── tests/
│   ├── schema.test.js            # Dynamic collection tests
│   ├── content.test.js           # Frontmatter parser tests
│   ├── github.test.js            # Mocked API tests
│   ├── settings.test.js          # Generic config parser tests
│   └── media.test.js             # Media library tests
└── src/
    ├── integration.js            # Astro integration (auto-discover + manifest)
    └── frontend/
        ├── lib/
        │   ├── schema.js         # Reads __CMS_ADMIN_MANIFEST__ at runtime
        │   ├── supabase.js       # Auth client
        │   ├── github.js         # GitHub API wrapper (+ listDirectory)
        │   ├── content.js        # Content CRUD + YAML parser
        │   ├── settings.js       # Generic config parser (any export name)
        │   ├── storage.js        # Supabase Storage upload
        │   └── media.js          # Media library CRUD + metadata
        ├── components/
        │   ├── AdminShell.astro  # Sidebar layout (+ Media nav)
        │   ├── AuthButton.astro  # Login/logout
        │   ├── CollectionList.astro
        │   └── ContentEditor.astro
        ├── pages/
        │   └── admin.astro       # Main admin (dynamic collections + settings + media library)
        └── styles/
            └── admin.css
```

## Integration Options

```js
// Minimal — works with any Astro project
cmsAdmin()

// With settings editor
cmsAdmin({ settings: { file: 'src/config.ts', exportName: 'SITE' } })

// With custom route
cmsAdmin({ route: '/manage' })

// With explicit collections (skip auto-discovery)
cmsAdmin({
  collections: {
    blog: { label: 'Posts', folder: 'src/content/blog', icon: ' ', fields: [...] },
  },
})
```

## Next Steps

### Phase 3: Visual Layout Editing
- Preview iframe showing the live site
- Reuse ui-preview-mcp patterns (drag-and-drop, drawing canvas)
- Position capture → CSS generation
- Responsive viewport toggle

### Phase 4: AI Assist + Admin MCP
- Supabase Edge Function for streaming AI responses
- Chat widget component in admin UI
- Admin MCP server exposing same operations as UI
- Tools: list_content, get_content, create_content, update_content, delete_content, upload_image, get_site_settings

### Multi-Language Support
- Content files with locale suffixes (blog/my-post.es.md)
- Admin UI language switcher
- Schema adds `locale` field
- Coordinate with astro-website's i18n routing (en, tr, fa)
