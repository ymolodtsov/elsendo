import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get the shared note
    const { data: sharedNote, error: shareError } = await supabase
      .from('shared_notes')
      .select('note_id')
      .eq('share_token', token)
      .eq('is_active', true)
      .single();

    if (shareError || !sharedNote) {
      return res.status(404).json({ error: 'Shared note not found' });
    }

    // Get the actual note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('title, content')
      .eq('id', sharedNote.note_id)
      .eq('is_deleted', false)
      .single();

    if (noteError || !note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Extract text preview from HTML content
    const stripHtml = (html: string) => {
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
    };

    const title = note.title || 'Shared Note';
    const description = stripHtml(note.content || '') || 'A note shared via Elsendo';
    const baseUrl = `https://${req.headers.host}`;
    const noteUrl = `${baseUrl}/shared/${token}`;
    const ogImageUrl = `${baseUrl}/api/og-image/${token}`;

    // Return HTML with OG metadata that redirects to the actual note
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Elsendo</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${noteUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:site_name" content="Elsendo">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${noteUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImageUrl}">

  <!-- Redirect to actual note -->
  <meta http-equiv="refresh" content="0;url=${noteUrl}">
  <script>window.location.href = "${noteUrl}";</script>
</head>
<body>
  <p>Redirecting to <a href="${noteUrl}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    console.error('OG metadata error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
