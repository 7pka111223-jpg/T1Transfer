// Landing-page effects from ReactDrops (https://reactdrops.dev), set to the
// Triple One colours. LandingPage loads this module lazily, so its WebGL code
// stays out of the login, dashboard and check-in screens.
import type { ReactNode } from 'react'
import { LiquidGlassLogo } from './liquid-glass-logo/liquid-glass-logo'
import { TopographicFlow } from './topographic-flow/topographic-flow'
import { ChromaticButton } from './chromatic-button/chromatic-button'

const RED = '#ba181c'
const DARK_RED = '#7b161b'
const BLACK = '#0a0a0a'

// The animation fits the glass plate to min(width / 1.9, height / 1.5), so it
// needs a wide box to keep the logo large.
export function BrandLogo({ height }: { height: number }) {
  return (
    <LiquidGlassLogo
      logo="/brand/t1-mark-dark.png"
      ending="logo"
      theme="dark"
      logoColor="original"
      tileColor={BLACK}
      background="transparent"
      logoSize={height / 1.5}
      logoScale={0.9}
      style={{ width: '100%', height }}
      aria-label="Triple One"
    />
  )
}

export function BrandBackground() {
  return (
    <TopographicFlow
      preset="midnight"
      backgroundColor={BLACK}
      lineColor={DARK_RED}
      accentColor={RED}
      lineStyle="mixed"
      opacity={0.55}
      scale={320}
      density={6}
      speed={0.6}
      hover={0}
    />
  )
}

export function BookButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <ChromaticButton
      onClick={onClick}
      colorMode="gradient-2"
      color={RED}
      color2={DARK_RED}
      speed={0.5}
      intensity={1.2}
      grain={0.04}
      borderRadius={25}
      entrance="none"
      hoverEffect="brighten"
      className="font-cinzel font-bold text-base sm:text-lg text-white"
      style={{ width: '100%', height: 64 }}
    >
      {children}
    </ChromaticButton>
  )
}
