import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// QAlaunch brand icon: blue circle ring (Q shape) with a green upward arrow
// inside and a small green square accent at the bottom right of the ring.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <svg
          width="32"
          height="32"
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
