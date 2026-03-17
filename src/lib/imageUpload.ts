import { supabase } from './supabase';

export async function uploadImage(file: File): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Upload failed');
  }

  const { url } = await response.json();
  return url;
}
