# cms-admin Implementation Plan

## Overview

Build a private Astro integration package that adds visual drag-and-drop blog editing to any Astro site. Uses Supabase Auth for GitHub login, GitHub API for file operations, and GitHub Actions for server-side layout processing. AI features added in Phase 2 using Supabase Edge Functions with streaming.

## Architecture

```
Browser (cms-admin)
    ├── Supabase Auth (login)
    ├── DrawingCanvas.js (capture coordinates only)
    ├── DragHandler.js (capture positions)
    ├── ChatWidget.js (AI chat)
    └── ViewportToggle.js (responsive preview)
            │
            ↓ Raw coordinates (hidden logic in backend)
    Supabase Edge Functions
    ├── calculate-position (snap to grid, percentages)
    ├── save-layout (generate CSS, save to GitHub)
    └── ai-assist (streaming AI responses)
            │
            ↓ GitHub API
    GitHub Actions
    └── process-layout (batch layout processing)
```

## Phase 1: Project Scaffolding

### 1.1 Initialize Package
- [ ] Create package.json with Astro peer dependency
- [ ] Set up ES modules (type: "module")
- [ ] Create src/integration.js entry point
- [ ] Add .gitignore, README.md

### 1.2 Astro Integration Base
- [ ] Implement integration.js with Astro hooks
- [ ] `astro:config:setup` — inject admin route, add vite alias
- [ ] `astro:build:done` — copy workflow file
- [ ] Export integration function

## Phase 2: Authentication

### 2.1 Supabase Client
- [ ] Install @supabase/supabase-js
- [ ] Create src/frontend/lib/supabase.js
- [ ] Read SUPABASE_URL and SUPABASE_ANON_KEY from env
- [ ] Export configured client

### 2.2 Auth Component
- [ ] Create AuthButton.astro
- [ ] Login button → supabase.auth.signInWithOAuth({ provider: 'github' })
- [ ] Logout button → supabase.auth.signOut()
- [ ] Display user avatar/name when logged in
- [ ] Store session in localStorage via Supabase SDK

### 2.3 Token Management
- [ ] Get provider_token from session (GitHub access token)
- [ ] Check token expiry, refresh if needed
- [ ] Expose getToken() function for API calls

## Phase 3: Frontend — Edit UI

### 3.1 Edit Toolbar
- [ ] Create EditToolbar.astro
- [ ] Edit button — toggles edit mode
- [ ] Save button — sends positions to backend
- [ ] Cancel button — discards changes
- [ ] Status indicator (editing/viewing)

### 3.2 Drag Handler (Frontend Only)
- [ ] Create DragHandler.js
- [ ] Find all [data-editable] elements
- [ ] Make elements draggable
- [ ] Capture dragstart, drag, dragend events
- [ ] Store raw pixel positions in memory
- [ ] NO percentage calculation (done in backend)

### 3.3 Drawing Canvas (Frontend Only)
- [ ] Create DrawingCanvas.js
- [ ] Canvas overlay for drawing
- [ ] Capture stroke coordinates (raw pixels)
- [ ] Get endpoint coordinates
- [ ] Enable/disable drawing mode
- [ ] NO position calculation (done in backend)

### 3.4 Viewport Toggle
- [ ] Create ViewportToggle.astro
- [ ] Desktop (1200px), Tablet (768px), Mobile (375px) buttons
- [ ] Resize preview container
- [ ] Store positions per viewport
- [ ] Load saved positions when switching

### 3.5 Edit Mode Styles
- [ ] Create editor.css
- [ ] Dashed outline on editable elements
- [ ] Hover highlight
- [ ] Dragging opacity
- [ ] Grid background in edit mode
- [ ] Hide toolbar in view mode

### 3.6 Admin Page
- [ ] Create admin.astro
- [ ] Load blog post content
- [ ] Inject EditToolbar, DrawingCanvas, ViewportToggle
- [ ] Responsive preview container

## Phase 4: Supabase Edge Functions (Backend Logic)

### 4.1 Calculate Position Function
- [ ] Create supabase/functions/calculate-position/index.ts
- [ ] Input: { endpoint: { x, y }, viewport: { width, height }, element_id }
- [ ] Calculate: x_percent = (x / viewport.width) * 100
- [ ] Snap to grid: round to nearest 5%
- [ ] Output: { commands: [{ action: 'move', selector, x, y }] }
- [ ] Logic hidden from frontend

### 4.2 Save Layout Function
- [ ] Create supabase/functions/save-layout/index.ts
- [ ] Input: { slug, positions: { 1200: [...], 768: [...], 375: [...] } }
- [ ] Generate CSS with media queries (only where different)
- [ ] Save to MDX via GitHub API
- [ ] Output: { success: true }

### 4.3 AI Assist Function (Streaming)
- [ ] Create supabase/functions/ai-assist/index.ts
- [ ] Input: { query, pageState: { dom, viewport, drawing, selected } }
- [ ] Call OpenAI/Claude API with streaming enabled
- [ ] Stream response back to browser
- [ ] Parse commands from AI response
- [ ] Output: stream of { commands, response_text }

### 4.4 Secrets Management
- [ ] Set OPENAI_API_KEY in Supabase secrets
- [ ] Set GITHUB_TOKEN in Supabase secrets
- [ ] Never expose secrets to frontend

## Phase 5: Frontend — AI Chat Widget

### 5.1 Chat Widget
- [ ] Create ChatWidget.astro
- [ ] Chat input field
- [ ] Send button
- [ ] Response display area
- [ ] Loading indicator

### 5.2 Streaming Handler
- [ ] Stream AI response to chat display
- [ ] Parse commands from chunks
- [ ] Apply commands in real-time (live updates)
- [ ] Show thinking/typing indicator

### 5.3 Command Applier
- [ ] Create commands.js
- [ ] applyCommands(commands) function
- [ ] Handle 'move' action (position absolute, left, top)
- [ ] Handle 'style' action (apply CSS properties)
- [ ] Handle 'text' action (update text content)
- [ ] Handle 'add' action (insert HTML)

## Phase 6: GitHub API Integration

### 6.1 File Operations
- [ ] Create github-api.js
- [ ] readFile(repo, path) — GET /repos/{owner}/{repo}/contents/{path}
- [ ] writeFile(repo, path, content, message) — PUT same endpoint
- [ ] Handle base64 encoding/decoding
- [ ] Handle "file already exists" (need SHA for updates)

### 6.2 Save Layout (Browser → GitHub)
- [ ] Collect positions for all viewports
- [ ] Send to Supabase Edge Function (calculate + save)
- [ ] Edge Function generates CSS, writes to MDX via GitHub API
- [ ] Show success/error feedback

## Phase 7: GitHub Actions Workflow

### 7.1 Workflow File
- [ ] Create workflows/admin-layout.yml
- [ ] Trigger: push to data/layouts/*.json
- [ ] Also trigger: repository_dispatch event
- [ ] Job: checkout repo, run process-layout.js, commit changes

### 7.2 Permissions
- [ ] Create GitHub token with repo scope
- [ ] Store as secret in admin repo
- [ ] Token needs write access to site repo

## Phase 8: Responsive Layout

### 8.1 Workflow
- [ ] User positions elements on desktop (1200px) — percentages
- [ ] User toggles to mobile (375px)
- [ ] User repositions if needed
- [ ] Frontend sends both positions to backend
- [ ] Backend generates CSS with media queries (only where different)
- [ ] Backend saves to MDX

### 8.2 CSS Output
- [ ] Base styles (largest viewport)
- [ ] Media queries for smaller viewports (only if positions differ)
- [ ] Example:
  ```css
  [data-edit-id="hero"] { position: absolute; left: 50%; top: 10%; }
  @media (max-width: 768px) { [data-edit-id="hero"] { left: 10%; top: 5%; } }
  ```

## Phase 9: Polish & Security

### 9.1 Error Handling
- [ ] GitHub API rate limits
- [ ] Token expiry handling
- [ ] Network errors
- [ ] Permission errors

### 9.2 Security
- [ ] Frontend only captures raw coordinates (no calculation logic exposed)
- [ ] All calculations done in Supabase Edge Functions
- [ ] API keys stored in Supabase secrets (never in browser)
- [ ] Token stored only in localStorage (user's browser)
- [ ] Sanitize CSS output (prevent injection)

### 9.3 Documentation
- [ ] README with installation instructions
- [ ] Environment variable reference
- [ ] GitHub OAuth App setup guide
- [ ] Supabase setup guide

## File Dependencies

```
integration.js
  └── injects admin.astro route
       └── uses AuthButton.astro
       └── uses EditToolbar.astro
       └── loads DragHandler.js (captures raw pixels)
       └── loads DrawingCanvas.js (captures raw coordinates)
       └── loads ChatWidget.js (AI chat)
       └── loads ViewportToggle.js
       └── imports supabase.js (auth + Edge Function calls)
       └── imports commands.js (apply AI commands)

supabase/functions/
  ├── calculate-position/ (hidden: snap to grid, percentages)
  ├── save-layout/ (hidden: generate CSS, save to GitHub)
  └── ai-assist/ (hidden: streaming AI responses)

process-layout.js (standalone, runs in GitHub Actions)
  └── reads data/layouts/*.json
  └── reads src/content/blog/*.mdx
  └── writes updated MDX

admin-layout.yml
  └── runs process-layout.js
```
