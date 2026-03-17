import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseMultipart(req: VercelRequest): Promise<{ buffer: Buffer; mimeType: string; ext: string } | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';

      if (contentType.startsWith('image/')) {
        // Direct binary upload with Content-Type header
        const mimeType = contentType.split(';')[0].trim();
        const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
        resolve({ buffer: body, mimeType, ext });
        return;
      }

      // Multipart form data
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) { resolve(null); return; }

      const bodyStr = body.toString('latin1');
      const parts = bodyStr.split(`--${boundary}`);

      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const headers = part.slice(0, headerEnd);
        if (!headers.includes('filename=')) continue;

        const mimeMatch = headers.match(/Content-Type:\s*(\S+)/i);
        if (!mimeMatch) continue;

        const mimeType = mimeMatch[1].trim();
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowed.includes(mimeType)) continue;

        const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
        const dataStart = headerEnd + 4;
        const dataEnd = part.lastIndexOf('\r\n');
        const fileData = Buffer.from(part.slice(dataStart, dataEnd), 'latin1');

        resolve({ buffer: fileData, mimeType, ext });
        return;
      }
      resolve(null);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify user auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const parsed = await parseMultipart(req);
  if (!parsed) {
    return res.status(400).json({ error: 'No valid image found' });
  }

  const { buffer, mimeType, ext } = parsed;

  // 10MB limit
  if (buffer.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image too large (max 10MB)' });
  }

  const filePath = `${user.id}/${nanoid()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('note-images')
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message });
  }

  const { data: urlData } = supabase.storage
    .from('note-images')
    .getPublicUrl(filePath);

  return res.status(200).json({ url: urlData.publicUrl });
}
