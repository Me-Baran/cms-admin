# cms-admin Progress

## Status: Planning

## Milestones

| Milestone | Status | Target |
|-----------|--------|--------|
| M1: Project Scaffolding | ⬜ Not Started | — |
| M2: Authentication | ⬜ Not Started | — |
| M3: Frontend Edit UI | ⬜ Not Started | — |
| M4: GitHub API Integration | ⬜ Not Started | — |
| M5: Layout Processing | ⬜ Not Started | — |
| M6: GitHub Actions Workflow | ⬜ Not Started | — |
| M7: Responsive Layout | ⬜ Not Started | — |
| M8: Polish & Security | ⬜ Not Started | — |

## Detailed Progress

### M1: Project Scaffolding
- [ ] package.json created
- [ ] integration.js entry point
- [ ] .gitignore
- [ ] README.md

### M2: Authentication
- [ ] Supabase client setup
- [ ] AuthButton component
- [ ] Login/logout flow
- [ ] Token retrieval

### M3: Frontend Edit UI
- [ ] EditToolbar component
- [ ] DragHandler with position capture
- [ ] SnapGuides (grid snap, alignment)
- [ ] Edit mode styles
- [ ] Admin page

### M4: GitHub API Integration
- [ ] readFile function
- [ ] writeFile function
- [ ] Save layout to data/layouts/
- [ ] Trigger repository_dispatch

### M5: Layout Processing
- [ ] process-layout.js script
- [ ] CSS calculation from coordinates
- [ ] MDX <style> block injection
- [ ] Cleanup processed JSON

### M6: GitHub Actions Workflow
- [ ] admin-layout.yml
- [ ] Trigger on data/layouts/ push
- [ ] Trigger on repository_dispatch
- [ ] Commit processed changes

### M7: Responsive Layout
- [ ] Viewport toggle (mobile/tablet/desktop)
- [ ] Per-breakpoint position capture
- [ ] Media query CSS generation

### M8: Polish & Security
- [ ] Error handling
- [ ] Token security
- [ ] CSS sanitization
- [ ] Documentation

## Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth provider | Supabase Auth | No backend needed, supports GitHub |
| OAuth flow | Standard (not Device) | Better UX, Supabase handles it |
| Layout storage | GitHub API → data/layouts/ | No custom backend |
| CSS processing | GitHub Actions | Server-side, hidden from users |
| Package format | Astro integration | Clean install, auto-inject routes |

## Dependencies

| Package | Purpose |
|---------|---------|
| @supabase/supabase-js | Auth + session management |
| gray-matter | Parse MDX frontmatter |
| astro (peer) | Integration API |

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| SUPABASE_URL | .env (Astro) | Supabase project URL |
| SUPABASE_ANON_KEY | .env (Astro) | Supabase public key |
| SITE_REPO | GitHub secret | Target repo for commits |
| ADMIN_TOKEN | GitHub secret | Token with repo write access |
