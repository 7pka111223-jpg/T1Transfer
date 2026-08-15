import { ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { CSSProperties } from 'react'

type MemberAppProps = {
  onSignIn: () => void
  onSignUp: () => void
}

export function MemberApp({ onSignIn, onSignUp }: MemberAppProps) {
  const mainStyle: CSSProperties = {
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    minHeight: '100dvh',
    height: '100dvh',
    WebkitHeight: '-webkit-fill-available'
  } as any

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-t1-black to-t1-dark-red/10 text-t1-cream overflow-hidden flex flex-col" style={mainStyle}>
      {/* Animated background layers */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-t1-red/15 via-transparent to-transparent animate-pulse-slow" style={{
        top: 'calc(-1 * env(safe-area-inset-top))',
        bottom: 'calc(-1 * env(safe-area-inset-bottom))',
        left: 'calc(-1 * env(safe-area-inset-left))',
        right: 'calc(-1 * env(safe-area-inset-right))'
      }} />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-t1-gold/10 via-transparent to-transparent" style={{
        top: 'calc(-1 * env(safe-area-inset-top))',
        bottom: 'calc(-1 * env(safe-area-inset-bottom))',
        left: 'calc(-1 * env(safe-area-inset-left))',
        right: 'calc(-1 * env(safe-area-inset-right))'
      }} />

      {/* Decorative corner accents */}
      <div className="fixed top-0 left-0 -z-10 w-32 h-32 bg-gradient-to-br from-t1-red/20 to-transparent blur-3xl" />
      <div className="fixed bottom-0 right-0 -z-10 w-40 h-40 bg-gradient-to-tl from-t1-gold/20 to-transparent blur-3xl" />

      <div className="relative max-w-md mx-auto px-6 py-8 flex flex-col flex-1">
        {/* Centered content */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-12">
          {/* Logo */}
          <div className="text-center space-y-4 animate-fade-in-up">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-t1-red/20 via-t1-gold/20 to-t1-red/20 blur-2xl opacity-50 animate-pulse-slow" />
              <div className="relative w-36 h-36 mx-auto rounded-full p-[6px] shadow-2xl" style={{background: 'linear-gradient(135deg, #ba181c 0%, #ba181c 50%, #f0d55c 100%)'}}>
                <div className="w-full h-full rounded-full bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center ring-1 ring-white/5 p-3">
                  <img src="/t1 logo/T1 LOGO DARK.png" alt="Triple One Logo" className="w-20 h-20 object-contain filter drop-shadow-2xl" />
                </div>
              </div>
            </div>

            {/* Brand name with enhanced gradient */}
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-cinzel font-black tracking-wider leading-none" style={{
                background: 'linear-gradient(135deg, #ba181c 0%, #dc143c 50%, #6b0f12 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 30px rgba(186, 24, 28, 0.3))'
              }}>
                TRIPLE ONE
              </h1>
              
              <p className="text-[10px] sm:text-[11px] font-bold tracking-widest uppercase text-t1-cream/90 leading-tight">
                ONE PLACE, ONE GOAL, ONE FAMILY
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-sm space-y-3 animate-fade-in-up animation-delay-400">
            <button 
              onClick={onSignIn}
              className="group relative w-full h-16 bg-gradient-to-r from-t1-red via-t1-dark-red to-t1-red bg-size-200 bg-pos-0 hover:bg-pos-100 transition-all duration-500 rounded-2xl font-cinzel font-bold text-base sm:text-lg text-white shadow-lg shadow-t1-red/30 hover:shadow-xl hover:shadow-t1-red/50 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-2">
                Sign In
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <button 
              onClick={onSignUp}
              className="w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 backdrop-blur-sm text-t1-cream font-medium rounded-2xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
            >
              Activate Account
            </button>
          </div>

          {/* Footer Text */}
          <div className="text-center animate-fade-in-up animation-delay-600">
            <p className="text-xs text-t1-cream/60">
              Book your classes, track your progress, achieve your goals
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}