import { Instagram, MapPin, Phone, Clock, Dumbbell, Users, Trophy, Shield } from 'lucide-react'
import { Button } from './ui/button'
import { useState, useEffect } from 'react'

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-t1-cream overflow-hidden relative" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Premium blurred dark background with animated gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-t1-red/20 via-transparent to-transparent animate-pulse-slow" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-t1-gold/10 via-transparent to-transparent animate-pulse-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute inset-0 backdrop-blur-3xl bg-black/30" />
      
      {/* Animated grid pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ba181c%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M30%2030h30v30H30zM0%200h30v30H0z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-40 animate-grid-move" />
      
      <div className="relative max-w-md mx-auto px-6 py-12 flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 sm:space-y-12">
          <div className={`text-center space-y-6 sm:space-y-8 transition-all duration-1000 transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Logo Circle with Image */}
            <div className="relative animate-float">
              <div className="w-40 h-40 sm:w-48 sm:h-48 mx-auto rounded-full bg-gradient-to-br from-t1-red via-t1-dark-red to-t1-gold p-1.5 shadow-2xl shadow-t1-red/50 ring-4 ring-t1-red/20 animate-glow">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center overflow-hidden backdrop-blur-xl">
                  <img 
                    src="/t1 logo/T1 LOGO DARK.png" 
                    alt="Triple One Logo" 
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl"
                  />
                </div>
              </div>
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
            {/* Premium Book Free Assessment Button */}
            <button 
              onClick={onBookAssessment}
              className="group relative w-full h-16 sm:h-18 bg-gradient-to-r from-t1-red via-t1-dark-red to-t1-red rounded-2xl font-cinzel font-bold text-base sm:text-lg text-white overflow-hidden shadow-2xl shadow-t1-red/50 hover:shadow-t1-red/70 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {/* Reflective shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              
              {/* Inner glow */}
              <div className="absolute inset-0.5 bg-gradient-to-r from-t1-red via-t1-dark-red to-t1-red rounded-2xl blur-sm opacity-50" />
              
              {/* Button content */}
              <div className="relative flex items-center justify-center gap-2 h-full px-6">
                <span className="drop-shadow-lg tracking-wide">Book Free Assessment</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              
              {/* Bottom shadow for depth */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4/5 h-2 bg-t1-red/50 blur-lg" />
            </button>

            {/* Member App Button - only visible if NOT in PWA mode */}
            <button 
              onClick={handleMemberAppClick}
              className="w-full h-14 sm:h-16 bg-zinc-900/50 backdrop-blur-md border border-zinc-700/50 hover:border-zinc-600 text-zinc-300 hover:text-t1-cream font-medium text-sm sm:text-base rounded-2xl transition-all duration-300 hover:bg-zinc-800/50"
            >
              Member App
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

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(186, 24, 28, 0.5), 0 0 40px rgba(186, 24, 28, 0.3); }
          50% { box-shadow: 0 0 30px rgba(186, 24, 28, 0.7), 0 0 60px rgba(186, 24, 28, 0.5); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes grid-move {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
        .animate-gradient-shift {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .animate-grid-move {
          animation: grid-move 20s linear infinite;
        }
      `}</style>
    </div>
  )
}