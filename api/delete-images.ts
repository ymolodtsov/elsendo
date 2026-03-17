import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const { paths } = req.body;
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'No paths provided' });
  }

  // Validate all paths belong to this user
  const userPrefix = `${user.id}/`;
  const validPaths = paths.filter(
    (p: unknown) => typeof p === 'string' && p.startsWith(userPrefix)
  );

  if (validPaths.length === 0) {
    return res.status(200).json({ deleted: 0 });
  }

  const { error } = await supabase.storage
    .from('note-images')
    .remove(validPaths);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ deleted: validPaths.length });
}
