import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler() {
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
