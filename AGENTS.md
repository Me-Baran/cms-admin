# cms-admin

A private Astro integration package that adds visual drag-and-drop editing and AI assistance to any Astro static site. Install once, get admin UI, layout editing, AI chat, and GitHub-based content management.

## Quick Reference

```bash
# Install in Astro project
npm install git+https://github.com/yourname/cms-admin.git

# Development
npm run dev

# Build
npm run build
```

## Architecture

```
src/
├── integration.js           # Astro integration entry point
├── frontend/
│   ├── components/
│   │   ├── EditToolbar.astro    # Edit/Save/Cancel buttons
│   │   ├── DragHandler.js       # Drag-and-drop (captures raw pixels)
│   │   ├── DrawingCanvas.js     # Drawing overlay (captures raw coordinates)
│   │   ├── ChatWidget.astro     # AI chat interface
│   │   ├── ViewportToggle.astro # Desktop/Tablet/Mobile toggle
│   │   ├── AuthButton.astro     # Supabase GitHub login
│   │   └── commands.js          # Apply AI commands to page
│   ├── pages/
│   │   └── admin.astro          # Admin page (injected into site)
│   └── styles/
│       └── editor.css           # Edit mode styles
├── backend/
│   ├── edge-functions/
│   │   ├── calculate-position/  # Snap to grid, percentages (hidden)
│   │   ├── save-layout/         # Generate CSS, save to GitHub (hidden)
│   │   └── ai-assist/           # Streaming AI responses (hidden)
│   └── scripts/
│       └── process-layout.js    # GitHub Actions: coordinates → CSS
└── workflows/
    └── admin-layout.yml         # GitHub Actions workflow
```

## Key Patterns

- **Client-side auth** — Supabase Auth, no custom backend
- **Supabase Edge Functions** — Backend logic (hidden from frontend)
- **GitHub API** — Reads/writes files directly to site repo
- **GitHub Actions** — Processes coordinates server-side (batch)
- **Astro Integration API** — Hooks into build process, injects routes
- **Data attributes** — `data-editable`, `data-edit-id` mark draggable elements
- **Streaming AI** — Real-time AI responses via Supabase Edge Functions

## Authentication Flow

```
Browser → Supabase → GitHub OAuth → Supabase → Browser
                                    ↓
                          Returns provider_token
                                    ↓
                          Use token for GitHub API calls
```

## Layout Editing Flow (Without AI)

```
Author visits /admin
       ↓
Login via Supabase (GitHub OAuth)
       ↓
Enable edit mode → elements become draggable
       ↓
Drag elements → raw pixel positions captured (frontend)
       ↓
Save → send raw coordinates to Supabase Edge Function
       ↓
Edge Function: calculate percentages, snap to grid (hidden)
       ↓
Edge Function: generate CSS with media queries
       ↓
Edge Function: save to MDX via GitHub API
       ↓
Site rebuilds → layout permanent
```

## AI-Assisted Editing Flow

```
Author visits /admin
       ↓
Login via Supabase
       ↓
Clicks "Ask AI" → ChatWidget opens
       ↓
User draws on page / types query
       ↓
Frontend captures: DOM state + drawing coordinates + query
       ↓
Send to Supabase Edge Function (streaming)
       ↓
Edge Function calls AI API (OpenAI/Claude)
       ↓
Stream response back to browser
       ↓
Commands applied in real-time (move, style, text)
       ↓
User sees changes live
       ↓
Save → layout permanent
```

## Responsive Workflow

```
1. User positions elements on desktop (1200px) — percentages
2. User toggles to mobile (375px)
3. User repositions if needed
4. Frontend sends both positions to backend
5. Backend generates CSS with media queries (only where different)
6. Backend saves to MDX
```

## Security: Frontend vs Backend

| Layer | What It Does | Visible? |
|-------|--------------|----------|
| Frontend | Draw, capture raw coordinates | ✅ Yes |
| Edge Function | Calculate positions, generate CSS | ❌ Hidden |
| Edge Function | Call AI API (streaming) | ❌ Hidden |
| GitHub Actions | Process layouts (batch) | ❌ Hidden |

**Frontend is "dumb" — only captures data. All logic in backend.**

## Environment Variables

```env
# Frontend (safe to expose)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...

# Backend (Supabase secrets, never in browser)
OPENAI_API_KEY=sk-xxx
GITHUB_TOKEN=ghp_xxx
SITE_REPO=yourname/astro-website
```

## Work State

### Completed
- (none yet)

### Active
- Project scaffolding

### Planned
- [ ] Astro integration setup
- [ ] Supabase auth client
- [ ] Edit toolbar component
- [ ] Drag handler (raw pixel capture)
- [ ] Drawing canvas (raw coordinate capture)
- [ ] Viewport toggle (responsive preview)
- [ ] Supabase Edge Function: calculate-position
- [ ] Supabase Edge Function: save-layout
- [ ] Supabase Edge Function: ai-assist (streaming)
- [ ] Chat widget (AI interface)
- [ ] Command applier (apply AI commands)
- [ ] GitHub API file operations
- [ ] Layout processing script
- [ ] GitHub Actions workflow
- [ ] Admin page route injection

### Blocked
- (none)
