# Elsendo - Project Context

> This document provides comprehensive context about the Elsendo project for Claude Code sessions. Last updated: 2026-01-30

## What is Elsendo?

**Elsendo** is a minimalist, real-time note-taking application with cloud sync and sharing capabilities. It's designed as a distraction-free writing tool with a focus on simplicity and elegant UX.

### Core Features
- **Multiple Notes Management**: Create, view, edit, and organize notes with a clean sidebar
- **Real-Time Auto-Save**: Automatic debounced saving to Supabase (1-second delay)
- **Rich Text Editing**: Supports headings (H1/H2), bold, italic, underline, lists, and hyperlinks
- **Note Sharing**: Generate read-only share links with unique tokens
- **Full-Screen/Focus Mode**: Keyboard shortcut (Cmd/Ctrl+Shift+F) for distraction-free writing
- **Dark Mode Support**: Automatic dark mode based on system preferences
- **Data Migration**: Migrates notes from previous "Flow" app using localStorage
- **Export to Markdown**: Download notes as .md files with proper formatting
- **Soft Deletion**: Notes are marked as deleted, not permanently removed

---

## Tech Stack

### Frontend
- **React 18.2.0** - UI library with hooks
- **React Router DOM 7.12.0** - Client-side routing
- **TypeScript 5.2.2** - Type-safe development

### Rich Text Editor
- **TipTap 2.2.4** - Headless editor framework (built on ProseMirror)
  - Includes extensions: starter-kit, link, underline, placeholder

### Styling & UI
- **Tailwind CSS 3.4.1** - Utility-first CSS
- **@tailwindcss/typography** - Typography styles for prose content
- **Lucide React** - Icon library
- Stone color palette for elegant, minimal design

### Backend & Database
- **Supabase JS SDK 2.91.0** - PostgreSQL database with real-time capabilities
- **nanoid 5.1.6** - Generating share tokens (21 characters)
- **date-fns 4.1.0** - Date formatting

### Build & Development
- **Vite 5.1.5** - Build tool and dev server (port 8080)
- **@vitejs/plugin-react** - React/JSX transform

### Deployment
- **Vercel** - Serverless deployment platform

---

## Project Structure

```
elsendo/
├── App.tsx                          # Main app with routing logic
├── index.tsx                        # React DOM entry point
├── index.html                       # HTML template
├── index.css                        # Global styles + editor styles
├── components/
│   ├── Editor.tsx                   # TipTap editor wrapper with auto-save
│   └── Toolbar.tsx                  # Rich text formatting toolbar with modals
├── src/
│   ├── components/
│   │   ├── NotesPanel.tsx           # Floating sidebar with note list
│   │   └── ShareModal.tsx           # Share link generation modal
│   ├── hooks/
│   │   ├── useNotes.ts              # CRUD operations for notes
│   │   └── useAutoSave.ts           # Debounced auto-save logic
│   ├── lib/
│   │   └── supabase.ts              # Supabase client initialization
│   └── types/
│       └── index.ts                 # TypeScript interfaces
├── supabase-schema.sql              # Database schema definition
├── .claude/                         # Claude Code context files
│   └── PROJECT_CONTEXT.md           # This file
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── tailwind.config.js               # Tailwind theme customization
├── vite.config.ts                   # Vite dev server configuration
└── vercel.json                      # Vercel deployment config
```

---

## Architecture & Design Patterns

### Routing Architecture
Three main routes using React Router:
- `/` - Home (redirects to first note or shows empty state)
- `/note/:noteId` - Full editor view for editing
- `/shared/:token` - Read-only shared note view (no UI chrome)

### State Management
- **Hooks-based** (no Redux/Zustand)
- `useNotes()` - Centralized hook for CRUD operations and database queries
- `useAutoSave()` - Manages debounced save operations
- Local component state with `useState()` for UI interactions

### Data Persistence
**Supabase PostgreSQL backend** with:
- RLS (Row Level Security) policies for public access
- Soft deletes (is_deleted flag) instead of hard deletion
- UUID primary keys for notes
- Timestamps (created_at, updated_at) for sorting

### Editor Architecture
- **TipTap + ProseMirror** for rich text editing
- Custom link extension with markdown-style input rules: `[text](url)`
- Separate read-only mode for shared notes (isShared prop)
- Debounced auto-save: Content → Hook → Supabase (1-second delay)

### UI/UX Patterns
1. **Floating UI**: Notes panel and New Note button are position:fixed overlays
2. **Modal Dialogs**: Link insertion and share modal use fixed positioning with backdrop blur
3. **Keyboard Shortcuts**:
   - Cmd/Ctrl+Shift+F: Toggle notes panel
   - Escape: Close panels
   - Markdown shortcuts in editor (TipTap built-in)
4. **Visual Feedback**:
   - Save status indicator ("Saving..." → "Saved")
   - Smooth animations (fade-in, scale-in, slide-up)
   - Hover states on interactive elements
5. **Dark Mode**: System preference based using `darkMode: 'media'` in Tailwind

### Component Communication
- Props drilling from App.tsx to child components
- Callback functions passed down (onSelectNote, onDeleteNote, onNewNote)
- Shared state via hooks (useNotes, useAutoSave)

---

## Database Schema

### `notes` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
title           TEXT NULL
content         TEXT NOT NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
is_deleted      BOOLEAN DEFAULT FALSE
```
Index on `updated_at DESC` for sorting

### `shared_notes` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
note_id         UUID REFERENCES notes(id) ON DELETE CASCADE
share_token     TEXT UNIQUE NOT NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
is_active       BOOLEAN DEFAULT TRUE
```
Index on `share_token` for fast lookups

---

## Data Flow Examples

### Creating a Note
1. User clicks "New Note" button
2. `handleNewNote()` calls `createNote()` from `useNotes` hook
3. Hook performs SQL INSERT to Supabase `notes` table
4. Promise resolves with new note data
5. `navigate()` redirects to `/note/{newNoteId}`
6. EditorRoute component mounts Editor with noteId
7. Editor queries `getNote()` to fetch full content

### Editing a Note
1. User types in TipTap editor
2. `onUpdate` callback triggers, calls `save(content)`
3. `useAutoSave` hook debounces the request (1-second delay)
4. Auto-save performs `updateNote()` with content
5. Hook updates local Supabase cache
6. Save status indicator shows "Saving..." then "Saved"

### Sharing a Note
1. User clicks "Share" button in toolbar
2. `handleShare()` calls `createShareLink(noteId)`
3. `useNotes` generates random 21-char token via nanoid
4. Token is inserted into `shared_notes` table
5. Share URL constructed: `{origin}/shared/{token}`
6. ShareModal displays copyable link
7. Anyone can access `/shared/{token}` (read-only)

---

## Environment Variables

Required in `.env` file (or Vercel environment):
```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

**IMPORTANT**: Never commit actual credentials to the repository. Keep them in `.env.local` which is gitignored.

---

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server (port 8080)
npm run dev

# Build for production
npm run build

# Type check
npm run type-check

# Preview production build
npm run preview
```

---

## Key Files & Their Purpose

| File | Purpose | Lines |
|------|---------|-------|
| `App.tsx` | Main app, routing, UI orchestration | ~257 |
| `components/Editor.tsx` | TipTap editor with auto-save | ~152 |
| `components/Toolbar.tsx` | Rich text formatting toolbar | ~359 |
| `src/hooks/useNotes.ts` | CRUD operations & database queries | ~193 |
| `src/hooks/useAutoSave.ts` | Debounced save manager | ~58 |
| `src/lib/supabase.ts` | Supabase client initialization | ~12 |
| `src/types/index.ts` | TypeScript type definitions | ~27 |
| `src/components/NotesPanel.tsx` | Floating notes sidebar | ~117 |
| `src/components/ShareModal.tsx` | Share link modal | ~91 |
| `tailwind.config.js` | Theme customization (stone palette) | ~73 |
| `supabase-schema.sql` | Database schema definition | ~42 |

---

## Design System

### Color Palette (Stone)
The app uses Tailwind's stone color palette for an elegant, minimal aesthetic.

**Light Mode (Recent Update: 2026-01-30):**
- Background: `stone-50` (#fafaf9)
- Body text: `stone-800` (#292524) - INCREASED CONTRAST
- Headings: `stone-900` (#1c1917) - INCREASED CONTRAST
- Links: `stone-900` (#1c1917) - INCREASED CONTRAST
- Bullets/counters: `stone-600` (#57534e) - INCREASED CONTRAST
- Secondary text: `stone-400` (#a8a29e)

**Dark Mode:**
- Background: `stone-900` (#1c1917)
- Body text: `stone-300` (#d6d3d1)
- Headings: `stone-50` (#fafaf9)
- Links: `stone-200` (#e7e5e4)
- Bullets/counters: `stone-500` (#78716c)

### Typography
- Font family: `system-ui, sans-serif`
- Typography plugin (@tailwindcss/typography) for prose content
- Custom spacing for lists in editor (reduced margins)

### Animations
- `fade-in`: 0.3s ease-out
- `slide-up`: 0.4s ease-out
- `scale-in`: 0.2s ease-out

---

## Notable Design Decisions

1. **Custom Hooks for Separation of Concerns**
   - `useNotes()` - All database logic
   - `useAutoSave()` - Debounce + save state management

2. **TypeScript Interfaces for Type Safety**
   - `Note` - Database schema
   - `SharedNote` - Share link metadata
   - `NoteInsert/NoteUpdate` - Query-specific types

3. **Tailwind Utilities for Styling**
   - No CSS-in-JS or styled-components
   - Uses className with clsx/tailwind-merge for dynamic classes
   - Dark mode via `dark:` prefix convention

4. **React Router Patterns**
   - URL as source of truth for current note
   - useParams to extract dynamic segments
   - useNavigate for programmatic routing
   - <Navigate> for redirects

5. **Modal Management**
   - Modals rendered conditionally based on state
   - Backdrop-blur for visual separation
   - Click-outside detection for dismissal

6. **Soft Deletes Instead of Hard Deletes**
   - Notes marked with `is_deleted` flag
   - Allows for potential undelete feature
   - Prevents accidental data loss

---

## Common Tasks & How to Approach Them

### Adding a New Rich Text Feature
1. Install TipTap extension: `npm install @tiptap/extension-{name}`
2. Add to Editor.tsx extensions array
3. Add toolbar button in Toolbar.tsx
4. Add keyboard shortcut if needed
5. Update TypeScript types if necessary

### Modifying Theme Colors
1. Edit `tailwind.config.js` for typography colors
2. Edit `index.html` body classes for global text color
3. Edit `index.css` for scrollbar/placeholder colors
4. Search components for hardcoded color classes

### Adding a New Modal/Panel
1. Create component in `src/components/`
2. Add state in parent component (usually App.tsx)
3. Pass toggle handler and state as props
4. Use fixed positioning and backdrop-blur
5. Add keyboard shortcut (Escape to close)

### Database Schema Changes
1. Update `supabase-schema.sql`
2. Run SQL in Supabase dashboard
3. Update TypeScript types in `src/types/index.ts`
4. Update CRUD operations in `src/hooks/useNotes.ts`

---

## Known Issues & TODOs

Check the project for any `CURRENT_STATE.txt` or similar files for the latest status and known issues.

---

## Tips for Future Claude Code Sessions

- **Always read this file first** when starting a new session on this project
- The app uses **Supabase** for backend - check if credentials are set up
- The database schema is in `supabase-schema.sql` - may need to be run manually
- The app is **very minimal by design** - don't over-engineer features
- **Stone color palette** is used throughout - maintain consistency
- Auto-save is **debounced 1 second** - don't change without good reason
- The app migrates from an older "Flow" app - check localStorage migration code
- **Soft deletes** are used - never hard delete notes without user confirmation
- Dark mode is **system preference based** - don't add manual toggle without asking
- The editor uses **TipTap** - check TipTap docs for extension options
- All routes except `/shared/:token` require the full app UI chrome
