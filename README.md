# Elsendo

A beautiful, minimalist note-taking app with real-time sync, offline support, and sharing capabilities.

## Features

- **Multiple Notes**: Organize your thoughts across multiple notes with a clean sidebar
- **Real-time Sync**: All notes are automatically saved to Supabase
- **Offline Mode**: Edits are saved locally when offline and synced automatically on reconnect, with conflict resolution if the same note was edited on another device
- **Note Sharing**: Generate read-only links to share your notes — you control when to share and can revoke access at any time
- **Image Upload**: Embed images in your notes via toolbar button (stored in Supabase Storage)
- **Rich Editing**: Support for headings, lists, task lists, bold, italic, underline, links, and images
- **Copy as Markdown**: Copy selected text or the entire document as Markdown to clipboard
- **Dark Mode**: Automatic dark mode based on system preferences
- **PWA**: Installable as a Progressive Web App with offline-ready service worker

## Setup

**Prerequisites:** Node.js and a Supabase account

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the SQL schema from the implementation plan in your Supabase SQL editor
   - Copy your project URL and anon key

3. Configure environment variables in `.env.local`:
   ```bash
   VITE_SUPABASE_URL=your-project-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

## Keyboard Shortcuts

- `#` + Space → Heading 1
- `##` + Space → Heading 2
- `*` or `-` + Space → Bullet list
- `[]` + Space → Task list
- `**text**` → Bold
- `Cmd/Ctrl + K` → Insert/edit link
- `Cmd/Ctrl + Shift + F` → Toggle full-screen mode
- `Escape` → Close modals
