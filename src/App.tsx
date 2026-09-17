import { useState, useEffect, useLayoutEffect } from 'react'
import { LandingPage } from './components/LandingPage'
import { AssessmentBooking } from './components/AssessmentBooking'
import { MemberLogin, MemberData } from './components/MemberLogin'
import { AccountActivation } from './components/AccountActivation'
import { AdminLogin, AdminData } from './components/AdminLogin'
import { AdminDashboard } from './components/AdminDashboard'
import { MemberDashboard } from './components/MemberDashboard'
import { MemberApp } from './components/MemberApp'

type View = 
  | 'landing'
  | 'assessment'
  | 'login'
  | 'activate'
  | 'admin-login'
  | 'admin-dashboard'
  | 'member-dashboard'
  | 'member-app'

// Static per-branch check-in code carried by the gym's QR deep link:
//   /?branch=<branch-uuid>
const readCheckInPayload = (): string | null => {
  if (typeof window === 'undefined') return null
  const branch = new URLSearchParams(window.location.search).get('branch')
  return branch ? branch.trim() : null
}

export default function App() {
  const computeIsPwa = () => {
    if (typeof window === 'undefined') return false
    const mq = window.matchMedia || (() => ({ matches: false }))
    const displayModeStandalone = mq('(display-mode: standalone)').matches
    const displayModeFullscreen = mq('(display-mode: fullscreen)').matches
    const displayModeMinimal = mq('(display-mode: minimal-ui)').matches
    const iosStandalone = (window.navigator as any)?.standalone === true
    return displayModeStandalone || displayModeFullscreen || displayModeMinimal || iosStandalone
  }

  const [currentMember, setCurrentMember] = useState<MemberData | null>(() => {
    const saved = localStorage.getItem('t1_member')
    return saved ? JSON.parse(saved) : null
  })
  const [currentAdmin, setCurrentAdmin] = useState<AdminData | null>(() => {
    const saved = localStorage.getItem('t1_admin')
    return saved ? JSON.parse(saved) : null
  })
  const [isPwa, setIsPwa] = useState<boolean>(() => computeIsPwa())

  // Payload from the gym's QR code deep link
  const [pendingCheckIn, setPendingCheckIn] = useState<string | null>(() => readCheckInPayload())

  const [currentView, setCurrentView] = useState<View>(() => {
    // For non-logged-in users, always start at landing page
    const hasLoggedInUser = localStorage.getItem('t1_member') || localStorage.getItem('t1_admin')
    if (!hasLoggedInUser) {
      return 'landing'
    }
    
    const saved = localStorage.getItem('t1_view')
    return (saved as View) || 'landing'
  })

  useEffect(() => {
    setIsPwa(computeIsPwa())
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = () => setIsPwa(computeIsPwa())
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname

      // Deep link from the gym's QR code
      const payload = readCheckInPayload()
      if (payload) {
        setPendingCheckIn(payload)
        window.history.replaceState({}, '', window.location.pathname)
        setCurrentView(localStorage.getItem('t1_member') ? 'member-dashboard' : 'login')
        return
      }

      const saved = localStorage.getItem('t1_view') as View | null
      const hasLoggedInUser = localStorage.getItem('t1_member') || localStorage.getItem('t1_admin')
      
      // Only override view if URL has a special path
      if (path === '/' || path === '') {
        // For non-logged-in users, always go to landing page
        if (!hasLoggedInUser) {
          setCurrentView('landing')
        } else if (saved && saved !== 'landing') {
          // For logged-in users, restore their previous view (but not landing)
          setCurrentView(saved)
        } else {
          setCurrentView('landing')
        }
      }
    }
    
    // Handle initial load
    handlePathChange()
    
    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', handlePathChange)
    return () => window.removeEventListener('popstate', handlePathChange)
  }, [])

  useEffect(() => {
    localStorage.setItem('t1_view', currentView)
  }, [currentView])

  useEffect(() => {
    if (!isPwa && currentView === 'login' && !pendingCheckIn) {
      setCurrentView('landing')
    }
  }, [isPwa, currentView, pendingCheckIn])

  useEffect(() => {
    if ((currentView === 'member-dashboard' || currentView === 'admin-dashboard' || currentView === 'landing') && isPwa) {
      document.body.classList.add('pwa-scrollable')
    } else {
      document.body.classList.remove('pwa-scrollable')
    }
  }, [currentView, isPwa])

  useEffect(() => {
    if (currentMember) {
      localStorage.setItem('t1_member', JSON.stringify(currentMember))
    } else {
      localStorage.removeItem('t1_member')
    }
  }, [currentMember])

  useEffect(() => {
    if (currentAdmin) {
      localStorage.setItem('t1_admin', JSON.stringify(currentAdmin))
    } else {
      localStorage.removeItem('t1_admin')
    }
  }, [currentAdmin])

  const handleMemberLogin = (member: MemberData) => {
    setCurrentMember(member)
    setCurrentView('member-dashboard')
  }

  const handleAdminLogin = (admin: AdminData) => {
    setCurrentAdmin(admin)
    setCurrentView('admin-dashboard')
  }

  const requirePwa = () => {
    if (computeIsPwa()) return true
    alert('Please open the Triple One app in PWA mode (Add to Home Screen) to access this feature.')
    return false
  }

  const handleLogout = () => {
    setCurrentMember(null)
    setCurrentAdmin(null)
    setCurrentView('landing')
    localStorage.removeItem('t1_member')
    localStorage.removeItem('t1_admin')
    localStorage.removeItem('t1_view')
  }

  switch (currentView) {
    case 'landing':
      return isPwa ? (
        <div className={isPwa && currentView !== 'landing' ? 'pwa-no-select' : ''}>
          <MemberApp
            onSignIn={() => setCurrentView('login')}
            onSignUp={() => setCurrentView('activate')}
          />
        </div>
      ) : (
        <div className={isPwa && currentView !== 'landing' ? 'pwa-no-select' : ''}>
          <LandingPage
            onBookAssessment={() => setCurrentView('assessment')}
            onMemberLogin={() => setCurrentView('login')}
            onAdminLogin={() => setCurrentView('admin-login')}
          />
        </div>
      )
    
    case 'assessment':
      return (
        <div className={isPwa && currentView === 'assessment' ? 'pwa-no-select' : ''}>
          <AssessmentBooking
            onBack={() => setCurrentView('landing')}
            onSuccess={() => setCurrentView('landing')}
          />
        </div>
      )
    
    case 'login':
      return (
        <div className={isPwa && currentView === 'login' ? 'pwa-no-select' : ''}>
          <MemberLogin
            onBack={() => setCurrentView('landing')}
            onLogin={handleMemberLogin}
            onActivate={() => setCurrentView('activate')}
          />
        </div>
      )
    
    case 'member-app':
      return (
        <div className={isPwa && currentView !== 'member-app' ? 'pwa-no-select' : ''}>
          <MemberApp
            onSignIn={() => setCurrentView('login')}
            onSignUp={() => setCurrentView('activate')}
          />
        </div>
      )
    
    case 'activate':
      return (
        <div className={isPwa && currentView !== 'activate' ? 'pwa-no-select' : ''}>
          <AccountActivation
            onBack={() => setCurrentView('landing')}
            onSuccess={() => setCurrentView('login')}
          />
        </div>
      )
    
    case 'admin-login':
      return (
        <div className={isPwa && currentView !== 'admin-login' ? 'pwa-no-select' : ''}>
          <AdminLogin
            onBack={() => setCurrentView('landing')}
            onLogin={handleAdminLogin}
          />
        </div>
      )
    
    case 'admin-dashboard':
      return currentAdmin ? (
        <AdminDashboard
          admin={currentAdmin}
          onLogout={handleLogout}
        />
      ) : (
        <LandingPage
          onBookAssessment={() => setCurrentView('assessment')}
          onMemberLogin={() => setCurrentView('login')}
          onAdminLogin={() => setCurrentView('admin-login')}
        />
      )
    
    case 'member-dashboard':
      return currentMember ? (
        <MemberDashboard
          member={currentMember}
          onLogout={handleLogout}
          checkInPayload={pendingCheckIn}
          onCheckInHandled={() => setPendingCheckIn(null)}
        />
      ) : (
        <div className={isPwa && currentView !== 'admin-dashboard' ? 'pwa-no-select' : ''}>
          <LandingPage
            onBookAssessment={() => setCurrentView('assessment')}
            onMemberLogin={() => setCurrentView('login')}
            onAdminLogin={() => setCurrentView('admin-login')}
          />
        </div>
      )
    
    default:
      return (
        <div className={isPwa && currentView !== 'admin-dashboard' ? 'pwa-no-select' : ''}>
          <LandingPage
            onBookAssessment={() => setCurrentView('assessment')}
            onMemberLogin={() => setCurrentView('login')}
            onAdminLogin={() => setCurrentView('admin-login')}
          />
        </div>
      )
  }
}