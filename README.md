# Elsendo

A beautiful, minimalist note-taking app with real-time sync and sharing capabilities.

## Features

- **Multiple Notes**: Organize your thoughts across multiple notes with a clean sidebar
- **Real-time Sync**: All notes are automatically saved to Supabase
- **Note Sharing**: Generate read-only links to share your notes with others
- **Full-Screen Mode**: Focus on your writing with distraction-free full-screen mode
- **Rich Editing**: Support for headings, lists, bold, italic, underline, and links
- **Dark Mode**: Automatic dark mode based on system preferences

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

3. Configure environment variables in [.env.local](.env.local):
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
- `**text**` → Bold
- `Cmd/Ctrl + Shift + F` → Toggle full-screen mode
