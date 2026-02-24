import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ReviewBot — AI code reviews that think like your team'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'monospace',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '48px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#00ff41',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#0a0a0a',
            }}
          >
            {'>_'}
          </div>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              letterSpacing: '0.15em',
              textTransform: 'uppercase' as const,
              color: '#e5e5e5',
            }}
          >
            ReviewBot
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 'bold',
            color: '#e5e5e5',
            lineHeight: 1.2,
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>Code reviews that think</span>
          <span style={{ color: '#00ff41' }}>like your team.</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '22px',
            color: '#666666',
            lineHeight: 1.6,
          }}
        >
          An AI reviewer that learns your architecture, your standards, your opinions.
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '80px',
            fontSize: '16px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
            color: '#444444',
          }}
        >
          reviewbot.sh
        </div>
      </div>
    ),
    { ...size },
  )
}
