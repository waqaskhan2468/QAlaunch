import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

// QAlaunch brand icon for Apple devices. iOS does not honour transparency on
// touch icons, so we render on the brand-dark background (#09111F) — the same
// colour as the ring's inner circle, so the blue ring + green arrow float on it.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09111F',
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 48 48"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="24" cy="24" r="22" fill="#1847A8" />
          <circle cx="24" cy="24" r="15.5" fill="#09111F" />
          <rect x="28.5" y="30" width="6" height="4" fill="#22C55E" />
          <polygon
            points="24,10 32,20 28,20 28,28 20,28 20,20 16,20"
            fill="#22C55E"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
