import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const config = {
  api: {
    bodyParser: false,
  },
};

function readBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_SIZE + 1024 * 100) {
        // Allow slight overhead for multipart headers
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function extractFileFromMultipart(body: Buffer, boundary: string): { buffer: Buffer; mimeType: string } | null {
  // Find boundary positions in the raw buffer
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const positions: number[] = [];
  let searchFrom = 0;

  while (true) {
    const idx = body.indexOf(boundaryBuf, searchFrom);
    if (idx === -1) break;
    positions.push(idx);
    searchFrom = idx + boundaryBuf.length;
  }

  for (let i = 0; i < positions.length - 1; i++) {
    const partStart = positions[i] + boundaryBuf.length + 2; // skip boundary + \r\n
    const partEnd = positions[i + 1] - 2; // before \r\n before next boundary

    // Find the header/body separator (\r\n\r\n)
    const separator = Buffer.from('\r\n\r\n');
    const sepIdx = body.indexOf(separator, partStart);
    if (sepIdx === -1 || sepIdx >= partEnd) continue;

    const headerStr = body.slice(partStart, sepIdx).toString('utf-8');
    if (!headerStr.includes('filename=')) continue;

    const mimeMatch = headerStr.match(/Content-Type:\s*([^\s;]+)/i);
    if (!mimeMatch) continue;

    const mimeType = mimeMatch[1].toLowerCase();
    if (!ALLOWED_TYPES[mimeType]) continue;

    const fileData = body.slice(sepIdx + 4, partEnd);
    return { buffer: fileData, mimeType };
  }

  return null;
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

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch {
    return res.status(413).json({ error: 'Image too large (max 10MB)' });
  }

  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();

  let fileBuffer: Buffer;
  let mimeType: string;

  if (ALLOWED_TYPES[contentType]) {
    // Direct binary upload
    fileBuffer = body;
    mimeType = contentType;
  } else {
    // Multipart form data
    const boundary = (req.headers['content-type'] || '').match(/boundary=(.+)/)?.[1];
    if (!boundary) {
      return res.status(400).json({ error: 'No valid image found' });
    }

    const extracted = extractFileFromMultipart(body, boundary);
    if (!extracted) {
      return res.status(400).json({ error: 'No valid image found' });
    }
    fileBuffer = extracted.buffer;
    mimeType = extracted.mimeType;
  }

  if (fileBuffer.length > MAX_SIZE) {
    return res.status(413).json({ error: 'Image too large (max 10MB)' });
  }

  const ext = ALLOWED_TYPES[mimeType];
  const filePath = `${user.id}/${nanoid()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('note-images')
    .upload(filePath, fileBuffer, {
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
