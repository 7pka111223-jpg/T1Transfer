import { Instagram, MapPin, Phone, Clock, Dumbbell, Users, Trophy, Shield } from 'lucide-react'
import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react'

// The ReactDrops effects live in one lazily loaded chunk. Until it arrives (or
// if it fails to load), the plain logo, background and button below are shown.
const drops = () => import('./drops/LandingDrops')
const BrandLogo = lazy(() => drops().then(m => ({ default: m.BrandLogo })))
const BrandBackground = lazy(() => drops().then(m => ({ default: m.BrandBackground })))
const BookButton = lazy(() => drops().then(m => ({ default: m.BookButton })))

type LandingPageProps = {
  onBookAssessment: () => void
  onMemberLogin: () => void
  onAdminLogin: () => void
}

export function LandingPage({ onBookAssessment, onMemberLogin, onAdminLogin }: LandingPageProps) {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleInstagramClick = () => {
    window.open('https://instagram.com/tripleonebars', '_blank')
  }

  const handleMemberAppClick = () => {
    // Check if running in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone ||
                  document.referrer.includes('android-app://')
    
    if (!isPWA) {
      alert('Please open the Triple One app in PWA mode (Add to Home Screen) to access this feature.')
    } else {
      onMemberLogin()
    }
  }

  const handleCoachingClick = () => {
    window.open('https://coach.tripleonebars.com/?lang=en', '_blank')
  }

  return (
    <div className="min-h-screen bg-t1-black text-t1-cream overflow-x-hidden relative" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Moving contour lines in the brand reds, behind everything */}
      <div className="fixed inset-0" aria-hidden="true">
        <Suspense fallback={null}>
          <BrandBackground />
        </Suspense>
      </div>
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t1-red/15 via-black/40 to-black/80" />

      <div className="relative max-w-md mx-auto px-6 py-12 flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 sm:space-y-12">
          <div className={`text-center space-y-6 sm:space-y-8 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Logo: a glass droplet that settles into the Triple One mark */}
            <div className="w-full h-[260px] -mb-12 flex items-center justify-center">
              <Suspense fallback={<StaticLogo />}>
                <BrandLogo height={260} />
              </Suspense>
            </div>

            {/* TRIPLE ONE Title - HUGE with gradient */}
            <div className="space-y-4">
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
            
            <p className="text-sm sm:text-base text-zinc-400 max-w-xs mx-auto leading-relaxed font-light px-4">
              Master your body. Redefine your limits.
            </p>
          </div>

          {/* Feature Cards */}
          <div className={`grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-sm transition-all duration-1000 delay-300 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="text-center p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-t1-red/10 to-transparent backdrop-blur-md border border-t1-red/30 hover:border-t1-red/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-t1-red/20 group">
              <Dumbbell className="w-6 h-6 sm:w-7 sm:h-7 mx-auto text-t1-red mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs sm:text-sm text-zinc-400 group-hover:text-t1-cream transition-colors font-medium">Community</span>
            </div>
            <div className="text-center p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-t1-gold/10 to-transparent backdrop-blur-md border border-t1-gold/30 hover:border-t1-gold/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-t1-gold/20 group">
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 mx-auto text-t1-gold mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs sm:text-sm text-zinc-400 group-hover:text-t1-cream transition-colors font-medium">Excellence</span>
            </div>
            <div className="text-center p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-t1-dark-red/10 to-transparent backdrop-blur-md border border-t1-dark-red/30 hover:border-t1-dark-red/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-t1-dark-red/20 group">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 mx-auto text-t1-dark-red mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs sm:text-sm text-zinc-400 group-hover:text-t1-cream transition-colors font-medium">Results</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className={`w-full space-y-4 max-w-sm transition-all duration-1000 delay-500 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <Suspense fallback={<PlainBookButton onClick={onBookAssessment}>{bookLabel}</PlainBookButton>}>
              <BookButton onClick={onBookAssessment}>{bookLabel}</BookButton>
            </Suspense>

            {/* Member App Button - only visible if NOT in PWA mode */}
            <button 
              onClick={handleMemberAppClick}
              className="w-full h-14 sm:h-16 bg-zinc-900/50 backdrop-blur-md border border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-t1-cream font-medium text-sm sm:text-base rounded-2xl transition-all duration-300 hover:bg-zinc-800/50"
            >
              Member App
            </button>

            {/* Coaching Button */}
            <button 
              onClick={handleCoachingClick}
              className="w-full h-14 sm:h-16 bg-gradient-to-r from-t1-gold/15 to-t1-gold/5 backdrop-blur-md border border-t1-gold/40 hover:border-t1-gold/60 text-t1-gold hover:text-t1-cream font-medium text-sm sm:text-base rounded-2xl transition-all duration-300 hover:bg-t1-gold/10"
            >
              Online Coaching
            </button>
          </div>

          {/* Instagram Link */}
          <div className={`flex items-center gap-6 text-zinc-400 text-sm sm:text-base transition-all duration-1000 delay-700 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <button 
              onClick={handleInstagramClick}
              className="flex items-center gap-2 hover:text-t1-red transition-colors group"
            >
              <Instagram className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">@tripleonebars</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={`mt-8 space-y-4 text-center text-xs sm:text-sm text-zinc-500 transition-all duration-1000 delay-900 transform ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>6PM - 10PM</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>New Cairo, Egypt</span>
            </div>
            <div className="flex items-center gap-1.5 hover:text-zinc-400 transition-colors">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Contact Us</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={onAdminLogin}
              className="flex items-center gap-1.5 text-zinc-600 hover:text-t1-red transition-colors group"
            >
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
              <span>Admin Login</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

const bookLabel: ReactNode = (
  <span className="flex items-center justify-center gap-2 tracking-wide">
    Book Free Assessment
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </span>
)

function StaticLogo() {
  return <img src="/brand/t1-mark-dark.png" alt="Triple One" className="h-32 object-contain" />
}

function PlainBookButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-16 rounded-2xl bg-gradient-to-r from-t1-red via-t1-dark-red to-t1-red font-cinzel font-bold text-base sm:text-lg text-white shadow-2xl shadow-t1-red/50"
    >
      {children}
    </button>
  )
}
