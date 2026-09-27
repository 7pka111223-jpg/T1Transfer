import { useState, useEffect, lazy, Suspense } from 'react'
import { LandingPage } from './components/LandingPage'
import { MemberLogin, MemberData } from './components/MemberLogin'
import { AccountActivation } from './components/AccountActivation'
import { AdminLogin, AdminData } from './components/AdminLogin'
import { MemberApp } from './components/MemberApp'
import { supabase } from './lib/supabase'

// The big screens load on demand so the landing page and login stay light.
const AssessmentBooking = lazy(() => import('./components/AssessmentBooking').then(m => ({ default: m.AssessmentBooking })))
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const MemberDashboard = lazy(() => import('./components/MemberDashboard').then(m => ({ default: m.MemberDashboard })))

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

  // Re-validate restored sessions against the database on boot. Each snapshot
  // carries the session token issued at login; a missing, revoked or unknown
  // token (or a member back in 'pending') clears that side and falls back to
  // landing. Snapshots from before server-side PINs have no token, so those
  // users sign in once more. Transport failures leave the snapshot untouched
  // for retry.
  useEffect(() => {
    let cancelled = false
    const readToken = (key: string): string | null => {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const token = (JSON.parse(raw) as { session_token?: unknown }).session_token
        return typeof token === 'string' && token.length > 0 ? token : null
      } catch {
        return null
      }
    }
    const validate = async (key: string, rpc: 'member_session' | 'admin_session', clear: () => void) => {
      if (!localStorage.getItem(key)) return
      const token = readToken(key)
      if (!token) {
        localStorage.removeItem(key)
        if (!cancelled) clear()
        return
      }
      try {
        const { data, error } = await supabase.rpc(rpc, { p_token: token })
        if (error) return // Transport/server failure: keep the snapshot for retry.
        if (!data) {
          localStorage.removeItem(key)
          if (!cancelled) clear()
        }
      } catch {
        // Transport failure: keep the snapshot for retry on next open.
      }
    }
    const validateSessions = async () => {
      await validate('t1_member', 'member_session', () => setCurrentMember(null))
      await validate('t1_admin', 'admin_session', () => setCurrentAdmin(null))
      // The QR check-in flow owns the view while its payload is pending.
      if (cancelled || pendingCheckIn) return
      const m = localStorage.getItem('t1_member')
      const a = localStorage.getItem('t1_admin')
      if (!m && !a) {
        localStorage.removeItem('t1_view')
        setCurrentView('landing')
      } else if (!m) {
        setCurrentView('admin-dashboard')
      } else if (!a) {
        setCurrentView('member-dashboard')
      }
    }
    validateSessions()
    return () => { cancelled = true }
  }, [])

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
    // Revoke the server-side sessions; the local sign-out doesn't wait on it.
    for (const token of [currentMember?.session_token, currentAdmin?.session_token]) {
      if (token) supabase.rpc('end_session', { p_token: token }).then(undefined, () => {})
    }
    setCurrentMember(null)
    setCurrentAdmin(null)
    setCurrentView('landing')
    localStorage.removeItem('t1_member')
    localStorage.removeItem('t1_admin')
    localStorage.removeItem('t1_view')
  }

  const renderView = () => {
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
          <div className={isPwa ? 'pwa-no-select' : ''}>
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

  return (
    <Suspense fallback={<div className="min-h-screen bg-t1-black" />}>
      {renderView()}
    </Suspense>
  )
}
