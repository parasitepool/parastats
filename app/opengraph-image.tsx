import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Parasite Logo'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        {/* Logo */}
        <img
          src={new URL('/parasite-white.png', 'https://parasite.wtf').toString()}
          alt="Parasite Logo"
          style={{
            width: '400px',
            height: 'auto',
          }}
        />
        {/* <div
          style={{
            fontSize: 60,
            fontWeight: 'bold',
            color: 'white',
            marginTop: 40,
          }}
        >
          Parasite Pool
        </div> */}
      </div>
    ),
    {
      ...size,
    }
  )
} 