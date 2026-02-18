import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'FBAR Direct — File Your FBAR Online';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#1a4480',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 'bold', marginBottom: 20, display: 'flex' }}>
          FBAR Direct
        </div>
        <div style={{ fontSize: 32, opacity: 0.9, marginBottom: 40, display: 'flex' }}>
          File Your FBAR in 10 Minutes. From $59.
        </div>
        <div style={{ display: 'flex', gap: 40, fontSize: 18, opacity: 0.7 }}>
          <span style={{ display: 'flex' }}>FinCEN-Registered</span>
          <span style={{ display: 'flex' }}>AES-256 Encrypted</span>
          <span style={{ display: 'flex' }}>Direct FinCEN Submission</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
