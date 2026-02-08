import { ImageResponse } from '@vercel/og';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(request: Request) {
  const { pathname } = new URL(request.url);
  const token = pathname.split('/').pop();

  if (!token) {
    return new Response('Missing token', { status: 400 });
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
      return generateDefaultImage();
    }

    // Get the actual note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('title, content')
      .eq('id', sharedNote.note_id)
      .eq('is_deleted', false)
      .single();

    if (noteError || !note) {
      return generateDefaultImage();
    }

    // Extract text preview
    const stripHtml = (html: string) => {
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const title = note.title || 'Shared Note';
    const preview = stripHtml(note.content || '').slice(0, 150);

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            backgroundColor: '#fafaf9',
            padding: '60px 80px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#44403c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px',
              }}
            >
              <span style={{ color: '#fafaf9', fontSize: '24px', fontWeight: 'bold' }}>E</span>
            </div>
            <span style={{ color: '#78716c', fontSize: '24px' }}>Elsendo</span>
          </div>
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#1c1917',
              marginBottom: '20px',
              lineHeight: 1.2,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </h1>
          {preview && (
            <p
              style={{
                fontSize: '28px',
                color: '#57534e',
                lineHeight: 1.5,
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              {preview}...
            </p>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG image error:', error);
    return generateDefaultImage();
  }
}

function generateDefaultImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafaf9',
        }}
      >
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            backgroundColor: '#44403c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
          }}
        >
          <span style={{ color: '#fafaf9', fontSize: '60px', fontWeight: 'bold' }}>E</span>
        </div>
        <h1
          style={{
            fontSize: '64px',
            fontWeight: 'bold',
            color: '#1c1917',
          }}
        >
          Elsendo
        </h1>
        <p
          style={{
            fontSize: '28px',
            color: '#78716c',
            marginTop: '16px',
          }}
        >
          A minimalist note-taking app
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
