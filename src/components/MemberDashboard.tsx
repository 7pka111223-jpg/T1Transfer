  // Helper to get the next Thursday from today
  function getNextThursday() {
    const now = new Date()
    const day = now.getDay()
    // Thursday is 4 (0=Sunday)
    let daysUntilThursday = 4 - day
    if (daysUntilThursday < 0) daysUntilThursday += 7
    // If today is Friday or later, show next week's Thursday
    if (day === 5 || day === 6) daysUntilThursday += 7
    const thursday = new Date(now)
    thursday.setDate(now.getDate() + daysUntilThursday)
    thursday.setHours(23, 59, 59, 999)
    return thursday
  }

  // Helper to check if it's after Friday midnight (Saturday 00:00)
  function isAfterFridayMidnight() {
    const now = new Date()
    return now.getDay() === 6 && now.getHours() >= 0
  }

import { useState, useEffect, useLayoutEffect } from 'react'
import { User, Calendar, Dumbbell, TrendingUp, LogOut, Bell, QrCode, ChevronRight, Award, Clock, AlertTriangle, Check, X, Users, Zap, Gift } from 'lucide-react'
import { Button } from './ui/button'
import { supabase } from '../lib/supabase'
import { MemberData } from './MemberLogin'
import { WorkoutTracking } from './WorkoutTracking'

type MemberDashboardProps = {
  member: MemberData
  onLogout: () => void
}

type Subscription = {
  id: string
  sessions_remaining: number | null
  start_date: string
  end_date: string | null
  status: string
  package: {
    name: string
    type: string
    sessions_count: number | null
    duration_days: number | null
  }
}

type BodyMetric = {
  weight: number
  body_fat_percentage: number
  muscle_mass: number
  recorded_at: string
}

type SubscriptionStatus = {
  isValid: boolean
  isExpired: boolean
  isExhausted: boolean
  needsRenewal: boolean
  renewalReason: string | null
  daysUntilExpiry: number | null
}

type GroupClass = {
  id: string
  name: string
  description: string | null
  member_level: string
  max_capacity: number | null
  day_of_week: number
  start_time: string
  end_time: string
  branch_id: string | null
}

type ClassBooking = {
  id: string
  class_id: string
  class_date: string
  status: string
  checked_in_at: string | null
  session_id?: string | null
  group_class: GroupClass
}

const getSubscriptionStatus = (subscription: Subscription | null): SubscriptionStatus => {
  if (!subscription) {
    return { isValid: false, isExpired: false, isExhausted: false, needsRenewal: false, renewalReason: null, daysUntilExpiry: null }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const endDate = subscription.end_date ? new Date(subscription.end_date) : null
  if (endDate) endDate.setHours(0, 0, 0, 0)
  
  const isExpired = endDate ? today > endDate : false
  const isExhausted = subscription.package.type === 'session' && (subscription.sessions_remaining === 0 || subscription.sessions_remaining === null)
  const isValid = !isExpired && !isExhausted && subscription.status === 'active'
  
  let daysUntilExpiry: number | null = null
  if (endDate) {
    daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  let needsRenewal = false
  let renewalReason: string | null = null
  
  if (subscription.package.type === 'session' && subscription.sessions_remaining !== null && subscription.sessions_remaining < 4 && subscription.sessions_remaining > 0) {
    needsRenewal = true
    renewalReason = `Only ${subscription.sessions_remaining} sessions remaining`
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
    needsRenewal = true
    renewalReason = `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`
  }
  
  return { isValid, isExpired, isExhausted, needsRenewal, renewalReason, daysUntilExpiry }
}

export function MemberDashboard({ member, onLogout }: MemberDashboardProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'classes' | 'progress' | 'profile'>('home')
  const [liveMember, setLiveMember] = useState<MemberData | null>(null)
  const [isLoadingMember, setIsLoadingMember] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [sharedSubscription, setSharedSubscription] = useState<any>(null)
  const [branchName, setBranchName] = useState<string | null>(null)
  const [latestMetrics, setLatestMetrics] = useState<BodyMetric | null>(null)
  const [attendanceCount, setAttendanceCount] = useState(0)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isValid: false, isExpired: false, isExhausted: false, needsRenewal: false, renewalReason: null, daysUntilExpiry: null
  })
  
  const [groupClasses, setGroupClasses] = useState<GroupClass[]>([])
  const [myBookings, setMyBookings] = useState<ClassBooking[]>([])
  const [cancelledSessions, setCancelledSessions] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [bookingLoading, setBookingLoading] = useState<string | null>(null)
  const [classCheckInLoading, setClassCheckInLoading] = useState<string | null>(null)
  const [animatedProgress, setAnimatedProgress] = useState(100)
  
  const [showAttendModal, setShowAttendModal] = useState(false)
  const [checkInState, setCheckInState] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [checkInResult, setCheckInResult] = useState<{
    sessionsRemaining: number | null
    expiryDate: string | null
    isSessionBased: boolean
    warning: string | null
  } | null>(null)
  const [showPastBookings, setShowPastBookings] = useState(false)
  const [lastTabBeforePastBookings, setLastTabBeforePastBookings] = useState<'home' | 'classes' | 'progress' | 'profile'>('home')

  const resetScroll = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  useEffect(() => {
    loadData()
  }, [member.id])

  useLayoutEffect(() => {
    resetScroll()
    requestAnimationFrame(() => resetScroll())
  }, [])

  useLayoutEffect(() => {
    resetScroll()
    requestAnimationFrame(() => resetScroll())
  }, [activeTab])

  useEffect(() => {
    setSubscriptionStatus(getSubscriptionStatus(subscription))
  }, [subscription])

  // Refresh member data when profile tab is opened
  useEffect(() => {
    if (activeTab === 'profile') {
      refreshMemberData(false) // Don't show loading screen
    }
  }, [activeTab])

  // Refresh member data on component mount to ensure latest data
  useEffect(() => {
    refreshMemberData(true) // Show loading screen on initial load
  }, [member.id]) // Re-fetch if member ID changes

  const refreshMemberData = async (showLoading = true) => {
    if (showLoading) {
      setIsLoadingMember(true)
    }
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', member.id)
        .single()
      
      if (!error && data) {
        // Completely replace old state with fresh database data
        setLiveMember(data)
      } else {
        // If fetch fails, use prop as fallback
        setLiveMember(member)
      }
    } catch (err) {
      console.error('Failed to refresh member data:', err)
      // On error, use prop data as fallback
      setLiveMember(member)
    } finally {
      setIsLoadingMember(false)
    }
  }

  const loadData = async () => {
    const historyStart = new Date()
    historyStart.setDate(historyStart.getDate() - 30)
    const historyStartStr = historyStart.toISOString().split('T')[0]
    
    const [subRes, sharedSubRes, metricsRes, attendanceRes, classesRes, bookingsRes, cancelledSessionsRes] = await Promise.all([
      supabase
        .from('member_subscriptions')
        .select('*, package:subscription_packages(name, type, sessions_count, duration_days)')
        .eq('member_id', member.id)
        .eq('status', 'active')
        .single(),
      (async () => {
        const { data, error } = await supabase
          .from('shared_subscription_members' as any)
          .select(`
            shared_subscription_id,
            shared_subscription:shared_subscriptions(
              id,
              sessions_total,
              sessions_remaining,
              start_date,
              end_date,
              status,
              package:subscription_packages(name, type, sessions_count, duration_days)
            )
          `)
          .eq('member_id', member.id)
        
        if (error || !data || data.length === 0) return { data: null, error }
        
        // Filter for active subscriptions with valid sessions_remaining, then sort by end_date
        const filtered = data.filter((d: any) => 
          d?.shared_subscription &&
          d.shared_subscription.status === 'active' &&
          d.shared_subscription.sessions_remaining !== null &&
          d.shared_subscription.end_date
        )
        
        if (filtered.length === 0) return { data: null, error }
        
        const sorted = filtered.sort((a: any, b: any) => {
          const aDate = new Date(a.shared_subscription?.end_date || 0)
          const bDate = new Date(b.shared_subscription?.end_date || 0)
          return bDate.getTime() - aDate.getTime()
        })
        
        return { data: sorted[0], error: null }
      })(),
      supabase
        .from('body_metrics')
        .select('weight, body_fat_percentage, muscle_mass, recorded_at')
        .eq('member_id', member.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('attendance_records')
        .select('id', { count: 'exact' })
        .eq('member_id', member.id),
        (async () => {
          let query = supabase
            .from('group_classes')
            .select('*')
            .eq('is_active', true)
          if (member.branch_id) {
            query = query.eq('branch_id', member.branch_id)
          }
          // Filter by member level - Ladies only get Ladies classes, others get their level or All classes
          if (member.level === 'Ladies') {
            query = query.eq('member_level', 'Ladies')
          } else {
            query = query.or(`member_level.eq.${member.level},member_level.eq.All`)
          }
          return query
        })(),
      supabase
        .from('class_bookings')
        .select('*, group_class:group_classes(*)')
        .eq('member_id', member.id)
        .gte('class_date', historyStartStr)
        .order('class_date', { ascending: true }),
      supabase
        .from('class_sessions')
        .select('group_class_id, session_date')
        .eq('status', 'cancelled')
        .gte('session_date', historyStartStr)
    ])

    if (subRes.data) setSubscription(subRes.data)
    if (sharedSubRes.data && sharedSubRes.data.shared_subscription) {
      const sharedSub = sharedSubRes.data.shared_subscription
      setSharedSubscription({
        id: sharedSub.id,
        sessions_remaining: sharedSub.sessions_remaining,
        start_date: sharedSub.start_date,
        end_date: sharedSub.end_date,
        status: sharedSub.status,
        package: sharedSub.package,
        sessions_total: sharedSub.sessions_total
      })
    }
    if (member.branch_id) {
      const { data: branchData } = await supabase
        .from('branches')
        .select('name')
        .eq('id', member.branch_id)
        .single()
      setBranchName(branchData?.name || null)
    } else {
      setBranchName(null)
    }
    if (metricsRes.data) setLatestMetrics(metricsRes.data)
    if (attendanceRes.count) setAttendanceCount(attendanceRes.count)
    if (classesRes.data) setGroupClasses(classesRes.data)
    if (bookingsRes.data) setMyBookings(bookingsRes.data)
    
    if (cancelledSessionsRes.data) {
      const cancelledKeys = new Set(cancelledSessionsRes.data.map(s => `${s.group_class_id}-${s.session_date}`))
      setCancelledSessions(cancelledKeys)
    }
    
  }

  // Animate progress bar from 100% to actual percentage when subscription loads
  useEffect(() => {
    if ((subscription || sharedSubscription) && animatedProgress === 100) {
      const activeSub = subscription || sharedSubscription
      const isSessionBased = activeSub.package?.type === 'session'
      const daysRemaining = activeSub.end_date
        ? Math.max(0, Math.ceil((new Date(activeSub.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : 0
      const totalDays = activeSub.package?.duration_days || 30
      const sessionsRemaining = activeSub.sessions_remaining ?? 0
      const totalSessions = sharedSubscription && activeSub.sessions_total
        ? activeSub.sessions_total
        : (activeSub.package?.sessions_count || 10)

      const targetPercent = isSessionBased
        ? (sessionsRemaining / totalSessions) * 100
        : Math.max(0, (daysRemaining / totalDays) * 100)

      // Only animate if we haven't already animated to the target
      if (Math.abs(animatedProgress - targetPercent) > 1) {
        // Smooth animation using requestAnimationFrame
        const duration = 3000 // 3 seconds for smoother effect
        const startTime = Date.now()
        const startProgress = 100

        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)

          // Easing function for smooth animation (ease-out cubic)
          const easedProgress = 1 - Math.pow(1 - progress, 3)
          const currentProgress = startProgress - (startProgress - targetPercent) * easedProgress

          setAnimatedProgress(currentProgress)

          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            setAnimatedProgress(targetPercent)
          }
        }

        requestAnimationFrame(animate)
      }
    }
  }, [subscription, sharedSubscription])

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'Warrior': return 'badge-warrior'
      case 'Spartan': return 'badge-spartan'
      case 'Legend': return 'badge-legend'
      case 'Ladies': return 'badge-ladies'
      default: return 'bg-zinc-600'
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Warrior': return 'from-[#cd7f32] to-[#8b4513]'
      case 'Spartan': return 'from-[#c0c0c0] to-[#808080]'
      case 'Legend': return 'from-t1-gold to-[#b8860b]'
      case 'Ladies': return 'from-[#ff9ecd] to-[#ff6f9c]'
      default: return 'from-zinc-500 to-zinc-600'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'Warrior': return '⚔️'
      case 'Spartan': return '🛡️'
      case 'Legend': return '👑'
      case 'Ladies': return '🌸'
      default: return '💪'
    }
  }

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[day]
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const getNextDateForDay = (dayOfWeek: number, startTime?: string, endTime?: string) => {
    const today = new Date()
    const todayDay = today.getDay()
    let daysUntil = dayOfWeek - todayDay
    
    // If daysUntil is 0, it means the class is today - check if it has already ended
    if (daysUntil === 0 && endTime) {
      const [hours, minutes] = endTime.split(':')
      const classEnd = new Date(today)
      classEnd.setHours(parseInt(hours), parseInt(minutes), 0)
      
      // If the class has already ended, skip to next week
      if (today >= classEnd) {
        daysUntil = 7
      }
    } else if (daysUntil < 0) {
      daysUntil += 7
    }
    
    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysUntil)
    const dateString = nextDate.toISOString().split('T')[0]
    return dateString
  }

  const isClassBooked = (classId: string, date: string) => {
    return myBookings.some(b => b.class_id === classId && b.class_date === date && b.status !== 'cancelled')
  }

  const getBookingForClass = (classId: string, date: string) => {
    return myBookings.find(b => b.class_id === classId && b.class_date === date && b.status !== 'cancelled')
  }

  const futureBookings = myBookings.filter(b => {
    const bookingDate = b.class_date
    const today = new Date().toISOString().split('T')[0]
    return bookingDate >= today && b.status !== 'cancelled'
  })

  const pastBookings = myBookings.filter(b => {
    const bookingDate = b.class_date
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
    return bookingDate < today && bookingDate >= thirtyDaysAgoStr && b.status !== 'cancelled'
  }).sort((a, b) => new Date(b.class_date).getTime() - new Date(a.class_date).getTime())

  const getCheckInWindow = (booking: ClassBooking) => {
    const start = booking.group_class?.start_time ? new Date(`${booking.class_date}T${booking.group_class.start_time}`) : null
    const end = booking.group_class?.end_time ? new Date(`${booking.class_date}T${booking.group_class.end_time}`) : null
    if (!start || !end) return { isOpen: false, opensAt: null as Date | null, closesAt: null as Date | null }
    const opensAt = new Date(start.getTime() - 10 * 60 * 1000)
    const closesAt = end
    const now = new Date()
    return { isOpen: now >= opensAt && now <= closesAt, opensAt, closesAt }
  }

  const isSessionCancelled = (classId: string, date: string) => {
    const key = `${classId}-${date}`
    return cancelledSessions.has(key)
  }

  const handleBookClass = async (groupClass: GroupClass) => {
    const classDate = getNextDateForDay(groupClass.day_of_week)
    setBookingLoading(groupClass.id)
    
    try {
      // Check if this class session is cancelled
      const { data: sessionData, error: sessionError } = await supabase
        .from('class_sessions')
        .select('status')
        .eq('group_class_id', groupClass.id)
        .eq('session_date', classDate)
        .maybeSingle()

      if (sessionError) throw sessionError

      if (sessionData?.status === 'cancelled') {
        alert('This class has been cancelled.')
        return
      }

      const { data: existing, error: existingError } = await supabase
        .from('class_bookings')
        .select('id, status, class_date, class_id, group_class:group_classes(*)')
        .eq('class_id', groupClass.id)
        .eq('member_id', member.id)
        .eq('class_date', classDate)
        .maybeSingle()

      if (existingError) throw existingError

      if (existing) {
        if (existing.status === 'cancelled') {
          const { data: updated, error: updateError } = await supabase
            .from('class_bookings')
            .update({ status: 'booked', checked_in_at: null })
            .eq('id', existing.id)
            .select('*, group_class:group_classes(*)')
            .single()

          if (updateError) throw updateError
          setMyBookings(prev => prev.map(b => b.id === existing.id ? updated : b))
        }
        // If already booked/attended, just sync without duplicating
        await loadData()
        return
      }

      const { data, error } = await supabase
        .from('class_bookings')
        .insert({
          class_id: groupClass.id,
          member_id: member.id,
          class_date: classDate,
          status: 'booked'
        })
        .select('*, group_class:group_classes(*)')
        .single()
      
      if (error) throw error
      setMyBookings(prev => [...prev, data])
    } catch (err: any) {
      // Silently reload all bookings to sync UI with database state
      await loadData()
    } finally {
      setBookingLoading(null)
    }
  }

  const handleCancelBooking = async (booking: ClassBooking) => {
    setBookingLoading(booking.id)
    
    try {
      const { error } = await supabase
        .from('class_bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id)
      
      if (error) throw error
      setMyBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'cancelled' } : b))
    } catch (err) {
      console.error('Failed to cancel booking:', err)
    } finally {
      setBookingLoading(null)
    }
  }

  const handleAttend = async () => {
    setCheckInState('checking')
    setCheckInError(null)
    setCheckInResult(null)
    
    try {
      if (!subscription && !sharedSubscription) {
        throw new Error('No active subscription found')
      }
      
      const activeSub = subscription || sharedSubscription
      const endDate = activeSub.end_date ? new Date(activeSub.end_date) : null
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (endDate && today > endDate) {
        throw new Error('Your subscription has expired')
      }
      
      const isSessionBased = activeSub.package?.type === 'session'
      if (isSessionBased && (activeSub.sessions_remaining === null || activeSub.sessions_remaining <= 0)) {
        throw new Error('No sessions remaining')
      }

      // Find bookings for classes happening now (within grace period)
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      
      const { data: bookings, error: bookingsError } = await supabase
        .from('class_bookings')
        .select('*, group_class:group_classes(*)')
        .eq('member_id', member.id)
        .eq('class_date', todayStr)
        .eq('status', 'booked')

      if (bookingsError || !bookings || bookings.length === 0) {
        throw new Error('No bookings found for today. Make sure you have booked a class.')
      }

      // Check time windows for each booking (10 min before to class end)
      const validBooking = bookings.find(booking => {
        if (!booking.group_class?.start_time || !booking.group_class?.end_time) return false
        
        const classStart = new Date(`${booking.class_date}T${booking.group_class.start_time}`)
        const classEnd = new Date(`${booking.class_date}T${booking.group_class.end_time}`)
        const graceStart = new Date(classStart.getTime() - 10 * 60 * 1000) // 10 min before
        const graceEnd = classEnd // Class end time
        
        return now >= graceStart && now <= graceEnd
      })

      if (!validBooking) {
        // Find next booking
        const nextBooking = bookings.sort((a, b) => {
          const aStart = new Date(`${a.class_date}T${a.group_class?.start_time}`)
          const bStart = new Date(`${b.class_date}T${b.group_class?.start_time}`)
          return aStart.getTime() - bStart.getTime()
        })[0]

        if (nextBooking?.group_class?.start_time) {
          const classStart = new Date(`${nextBooking.class_date}T${nextBooking.group_class.start_time}`)
          const graceStart = new Date(classStart.getTime() - 10 * 60 * 1000)
          
          if (now < graceStart) {
            const minutesUntilOpen = Math.ceil((graceStart.getTime() - now.getTime()) / (1000 * 60))
            throw new Error(`Check-in opens ${minutesUntilOpen} minute${minutesUntilOpen !== 1 ? 's' : ''} before class starts`)
          } else {
            throw new Error('Check-in window has closed (closes at class end time)')
          }
        } else {
          throw new Error('Check-in is available 10 minutes before class start until class end')
        }
      }

      // Prevent double check-in
      const { data: existingAttendance } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('member_id', member.id)
        .eq('class_booking_id', validBooking.id)
        .single()

      if (existingAttendance) {
        throw new Error('Already checked in to this class')
      }

      const nowIso = now.toISOString()

      // Update booking status
      const { error: bookingError } = await supabase
        .from('class_bookings')
        .update({ 
          status: 'attended', 
          checked_in_at: nowIso 
        })
        .eq('id', validBooking.id)

      if (bookingError) throw bookingError

      // Record attendance
      const { data: insertedAttendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .insert({
          member_id: member.id,
          check_in_time: nowIso,
          check_in_method: 'app',
          class_booking_id: validBooking.id,
          session_id: (validBooking as any)?.session_id || null
        })
        .select('id')
        .single()
      
      if (attendanceError) throw attendanceError
      
      let newSessionsRemaining = activeSub.sessions_remaining
      if (isSessionBased) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('deduct_session_for_attendance' as any, {
            p_member_id: member.id,
            p_booking_id: validBooking.id,
            p_session_id: (validBooking as any)?.session_id || null,
            p_attendance_id: insertedAttendance?.id || null
          })
          if (rpcError) throw rpcError
          if (rpcData && typeof rpcData.sessions_remaining === 'number') {
            newSessionsRemaining = rpcData.sessions_remaining
          } else if (activeSub.sessions_remaining !== null) {
            newSessionsRemaining = Math.max(0, activeSub.sessions_remaining - 1)
          }
        } catch (rpcErr) {
          if (sharedSubscription && activeSub.sessions_remaining !== null) {
            newSessionsRemaining = Math.max(0, activeSub.sessions_remaining - 1)
            const { error: sharedUpdateError } = await supabase
              .from('shared_subscriptions' as any)
              .update({ sessions_remaining: newSessionsRemaining })
              .eq('id', sharedSubscription.id)
            if (sharedUpdateError) throw sharedUpdateError

            const { error: deductionError } = await supabase
              .from('session_deductions' as any)
              .insert({
                member_id: member.id,
                source_type: 'shared',
                source_id: sharedSubscription.id,
                booking_id: validBooking.id,
                attendance_id: insertedAttendance?.id || null,
                session_id: (validBooking as any)?.session_id || null,
                action: 'deduct',
                created_at: nowIso
              })
            if (deductionError) throw deductionError
          } else if (subscription && subscription.sessions_remaining !== null) {
            newSessionsRemaining = subscription.sessions_remaining - 1
            const { error: updateError } = await supabase
              .from('member_subscriptions')
              .update({ sessions_remaining: newSessionsRemaining })
              .eq('id', subscription.id)
            if (updateError) throw updateError
          }
        }

        if (sharedSubscription) {
          setSharedSubscription(prev => prev ? { ...prev, sessions_remaining: newSessionsRemaining } : null)
        } else if (subscription) {
          setSubscription(prev => prev ? { ...prev, sessions_remaining: newSessionsRemaining } : null)
        }
      }
      
      let warning: string | null = null
      if (isSessionBased && newSessionsRemaining !== null && newSessionsRemaining < 4 && newSessionsRemaining > 0) {
        warning = `Running low on sessions (${newSessionsRemaining} left). Consider renewing soon!`
      } else if (endDate) {
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
          warning = `Your subscription expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. Consider renewing soon!`
        }
      }
      
      setCheckInResult({
        sessionsRemaining: newSessionsRemaining,
        expiryDate: activeSub.end_date,
        isSessionBased,
        warning
      })
      setCheckInState('success')
      setAttendanceCount(prev => prev + 1)
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : 'Check-in failed')
      setCheckInState('error')
    }
  }

  const handleClassCheckIn = async (booking: ClassBooking) => {
    setClassCheckInLoading(booking.id)
    try {
      if (!subscription && !sharedSubscription) {
        throw new Error('No active subscription found')
      }

      const activeSub = subscription || sharedSubscription
      const endDate = activeSub.end_date ? new Date(activeSub.end_date) : null
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (endDate && today > endDate) {
        throw new Error('Your subscription has expired')
      }

      const isSessionBased = activeSub.package?.type === 'session'
      if (isSessionBased && (activeSub.sessions_remaining === null || activeSub.sessions_remaining <= 0)) {
        throw new Error('No sessions remaining')
      }

      const windowState = getCheckInWindow(booking)
      if (!windowState.isOpen) {
        const openText = windowState.opensAt ? windowState.opensAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'soon'
        const closeText = windowState.closesAt ? windowState.closesAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
        throw new Error(`Check-in opens at ${openText}${closeText ? ` and closes at ${closeText}` : ''}`)
      }

      const nowIso = new Date().toISOString()
      const { error: bookingError } = await supabase
        .from('class_bookings')
        .update({ status: 'attended', checked_in_at: nowIso })
        .eq('id', booking.id)

      if (bookingError) throw bookingError

      const { data: insertedAttendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .insert({
          member_id: member.id,
          check_in_method: 'class',
          class_booking_id: booking.id,
          session_id: booking.session_id || null
        })
        .select('id')
        .single()
      if (attendanceError) throw attendanceError

      let newSessionsRemaining = activeSub.sessions_remaining
      if (isSessionBased) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('deduct_session_for_attendance' as any, {
            p_member_id: member.id,
            p_booking_id: booking.id,
            p_session_id: (booking as any)?.session_id || null,
            p_attendance_id: insertedAttendance?.id || null
          })
          if (rpcError) throw rpcError
          if (rpcData && typeof rpcData.sessions_remaining === 'number') {
            newSessionsRemaining = rpcData.sessions_remaining
          } else if (activeSub.sessions_remaining !== null) {
            newSessionsRemaining = Math.max(0, activeSub.sessions_remaining - 1)
          }
        } catch (rpcErr) {
          if (sharedSubscription && activeSub.sessions_remaining !== null) {
            newSessionsRemaining = Math.max(0, activeSub.sessions_remaining - 1)
            const { error: sharedUpdateError } = await supabase
              .from('shared_subscriptions' as any)
              .update({ sessions_remaining: newSessionsRemaining })
              .eq('id', sharedSubscription.id)
            if (sharedUpdateError) throw sharedUpdateError

            const { error: deductionError } = await supabase
              .from('session_deductions' as any)
              .insert({
                member_id: member.id,
                source_type: 'shared',
                source_id: sharedSubscription.id,
                booking_id: booking.id,
                attendance_id: insertedAttendance?.id || null,
                session_id: (booking as any)?.session_id || null,
                action: 'deduct',
                created_at: nowIso
              })
            if (deductionError) throw deductionError
          } else if (subscription && subscription.sessions_remaining !== null) {
            newSessionsRemaining = subscription.sessions_remaining - 1
            const { error: updateError } = await supabase
              .from('member_subscriptions')
              .update({ sessions_remaining: newSessionsRemaining })
              .eq('id', subscription.id)
            if (updateError) throw updateError
          }
        }

        if (sharedSubscription) {
          setSharedSubscription(prev => prev ? { ...prev, sessions_remaining: newSessionsRemaining } : null)
        } else if (subscription) {
          setSubscription(prev => prev ? { ...prev, sessions_remaining: newSessionsRemaining } : null)
        }
      }

      setMyBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'attended', checked_in_at: nowIso } : b))
      setAttendanceCount(prev => prev + 1)
      alert('Attendance recorded. Enjoy your class!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check-in failed'
      alert(message)
    } finally {
      setClassCheckInLoading(null)
    }
  }

  const closeAttendModal = () => {
    setShowAttendModal(false)
    setCheckInState('idle')
    setCheckInError(null)
    setCheckInResult(null)
  }

  // Show loading state while fetching fresh data
  if (isLoadingMember || !liveMember) {
    return (
      <div className="min-h-screen bg-t1-black text-t1-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full border-4 border-t1-red border-t-transparent animate-spin mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-t1-black text-t1-cream overflow-y-auto pb-24">
      {activeTab !== 'profile' && (
        <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-md mx-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Avatar & Member Info */}
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br ${getLevelColor(liveMember.level)} flex items-center justify-center text-xl sm:text-2xl shadow-lg shadow-t1-red/25 border border-white/10`}>
                  {liveMember.profile_image_url ? (
                    <img src={liveMember.profile_image_url} alt="" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    getLevelIcon(liveMember.level)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-cinzel font-bold text-lg sm:text-xl leading-tight truncate">{liveMember.full_name}</h2>
                  <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm text-zinc-400 mt-1">
                    <span>{liveMember.member_id}</span>
                  </div>
                </div>
              </div>
              
              {/* Right: Action Buttons */}
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <button className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all shadow-sm">
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-t1-cream" />
                </button>
                <button 
                  onClick={() => setShowAttendModal(true)}
                  className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-t1-red/85 to-t1-dark-red/90 border border-red-500/30 text-white shadow-md shadow-t1-red/30 hover:shadow-t1-red/50 transition-all active:scale-95"
                  title="Check In"
                >
                  <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAttendModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-t1-black border border-t1-red/30 rounded-2xl w-full max-w-sm overflow-hidden">
            {checkInState === 'idle' && (
              <>
                <div className="p-6 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-t1-red to-t1-dark-red flex items-center justify-center mb-4">
                    <Check className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-cinzel font-bold mb-2">Ready to Check In?</h3>
                  <p className="text-muted-foreground text-sm">
                    Tap below to record your attendance
                  </p>
                </div>
                <div className="p-6 pt-0 space-y-3">
                  <Button
                    onClick={handleAttend}
                    className="w-full h-12 bg-gradient-to-r from-t1-red to-t1-dark-red text-white rounded-xl font-cinzel"
                  >
                    Check In Now
                  </Button>
                  <Button
                    onClick={closeAttendModal}
                    variant="outline"
                    className="w-full h-12 bg-transparent border-t1-red/30 text-t1-cream rounded-xl font-cinzel"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}

            {checkInState === 'checking' && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto rounded-full border-4 border-t1-red border-t-transparent animate-spin mb-4" />
                <p className="text-muted-foreground">Checking in...</p>
              </div>
            )}

            {checkInState === 'success' && checkInResult && (
              <>
                <div className="p-6 text-center bg-gradient-to-b from-emerald-500/20 to-transparent">
                  <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4">
                    <Check className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-cinzel font-bold mb-2 text-emerald-400">Enjoy Your Session!</h3>
                  <p className="text-muted-foreground text-sm">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                
                <div className="p-6 space-y-4">
                  {checkInResult.isSessionBased && checkInResult.sessionsRemaining !== null && (
                    <div className="bg-secondary rounded-xl p-4 flex items-center justify-between">
                      <span className="text-muted-foreground">Sessions Remaining</span>
                      <span className="text-2xl font-cinzel font-bold">{checkInResult.sessionsRemaining}</span>
                    </div>
                  )}
                  
                  {checkInResult.expiryDate && (
                    <div className="bg-secondary rounded-xl p-4 flex items-center justify-between">
                      <span className="text-muted-foreground">Valid Until</span>
                      <span className="font-cinzel font-semibold">
                        {new Date(checkInResult.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  
                  {checkInResult.warning && (
                    <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-400">{checkInResult.warning}</p>
                    </div>
                  )}
                </div>
                
                <div className="p-6 pt-0">
                  <Button
                    onClick={closeAttendModal}
                    className="w-full h-12 bg-gradient-to-r from-t1-red to-t1-dark-red text-white rounded-xl font-cinzel"
                  >
                    Done
                  </Button>
                </div>
              </>
            )}

            {checkInState === 'error' && (
              <>
                <div className="p-6 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full bg-red-500 flex items-center justify-center mb-4">
                    <X className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-cinzel font-bold mb-2 text-red-400">Check-In Failed</h3>
                  <p className="text-muted-foreground text-sm">{checkInError}</p>
                </div>
                <div className="p-6 pt-0 space-y-3">
                  <Button
                    onClick={() => setCheckInState('idle')}
                    className="w-full h-12 bg-gradient-to-r from-t1-red to-t1-dark-red text-white rounded-xl font-cinzel"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={closeAttendModal}
                    variant="outline"
                    className="w-full h-12 bg-transparent border-t1-red/30 text-t1-cream rounded-xl font-cinzel"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'home' && subscriptionStatus.needsRenewal && subscription && (
        <div className="max-w-md mx-auto px-6 pt-4">
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-cinzel font-semibold text-sm text-amber-400">Renewal Reminder</p>
                <p className="text-xs text-muted-foreground">{subscriptionStatus.renewalReason}</p>
              </div>
            </div>
            <Button 
              onClick={() => {
                const phoneNumber = '201222633231'
                const message = 'Hi, I would like to renew my subscription.'
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
                window.open(whatsappUrl, '_self')
              }}
              className="bg-amber-500 text-black rounded-lg text-xs h-8 px-3 font-cinzel hover:bg-amber-400"
            >
              Renew
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'home' && (subscriptionStatus.isExpired || subscriptionStatus.isExhausted) && subscription && (
        <div className="max-w-md mx-auto px-6 pt-4">
          <div className="bg-gradient-to-r from-red-500/20 to-red-700/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-cinzel font-semibold text-sm text-red-400">Subscription Inactive</p>
                <p className="text-xs text-muted-foreground">
                  {subscriptionStatus.isExpired ? 'Your subscription has expired' : 'No sessions remaining'}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => {
                const phoneNumber = '201222633231'
                const message = 'Hi, I would like to renew my subscription.'
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
                window.open(whatsappUrl, '_self')
              }}
              className="bg-t1-red text-white rounded-lg text-xs h-8 px-3 font-cinzel hover:bg-red-600"
            >
              Renew Now
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-6 py-6 space-y-6">
        {activeTab === 'home' && (
          <>
            {subscription || sharedSubscription ? (
              <>
                {(() => {
                  const activeSub = subscription || sharedSubscription
                  const isShared = !!sharedSubscription
                  const isSessionBased = activeSub.package?.type === 'session'
                  const daysRemaining = activeSub.end_date
                    ? Math.max(0, Math.ceil((new Date(activeSub.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
                    : 0
                  const totalDays = activeSub.package?.duration_days || 30
                  const sessionsRemaining = activeSub.sessions_remaining ?? 0
                  const totalSessions = isShared && activeSub.sessions_total 
                    ? activeSub.sessions_total 
                    : (activeSub.package?.sessions_count || 10)
                  
                  const isExpired = activeSub.end_date ? new Date(activeSub.end_date) < new Date() : false
                  const percentRemaining = isSessionBased
                    ? (sessionsRemaining / totalSessions) * 100
                    : Math.max(0, (daysRemaining / totalDays) * 100)
                  
                  return (
                    <div className={`relative backdrop-blur-sm rounded-2xl p-10 shadow-lg overflow-hidden transition-colors ${
                      isExpired 
                        ? 'bg-red-950/40 border border-red-900/50' 
                        : 'bg-zinc-900/60 border border-zinc-800/50'
                    }`}>
                      {/* Cropped Icon Background */}
                      <div className="absolute -top-12 -right-12 opacity-40">
                        {isShared ? (
                          <Users className="w-56 h-56 text-zinc-700" />
                        ) : (
                          <Award className="w-56 h-56 text-zinc-700" />
                        )}
                      </div>
                      
                      <div className="relative z-10 flex items-center justify-between mb-6">
                        <span className="text-sm font-semibold text-t1-cream">
                          {isShared ? 'Shared Pool' : 'Your Subscription'}
                        </span>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          isExpired ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>{isExpired ? 'EXPIRED' : 'ACTIVE'}</span>
                      </div>
                      
                      <div className="relative z-10 space-y-4">
                        <div>
                          <h3 className="font-cinzel font-black text-5xl leading-snug text-t1-gold block pt-2 pb-1">{activeSub.package?.name || (isSessionBased ? 'Session Package' : 'Unlimited Plan')}</h3>
                          <p className="text-base font-semibold text-zinc-400 mt-4">
                            {isSessionBased ? `${sessionsRemaining} sessions left` : `${daysRemaining} days left`}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/50">
                            <div
                              className="h-full bg-gradient-to-r from-t1-red to-t1-gold"
                              style={{ width: `${Math.max(0, animatedProgress)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-zinc-400">
                            <span>{Math.round(animatedProgress)}%</span>
                            <span>{isSessionBased ? `${totalSessions} sessions total` : `${totalDays} days total`}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm pt-1">
                          <Clock className="w-4 h-4 text-zinc-500" />
                          <span className="text-zinc-400">
                            Expires: {new Date(activeSub.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="bg-secondary rounded-2xl p-5 border border-t1-red/20 text-center">
                <p className="text-muted-foreground mb-3">No active subscription</p>
                <Button className="bg-gradient-t1 text-white rounded-xl font-cinzel">
                  View Packages
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setLastTabBeforePastBookings(activeTab)
                  setActiveTab('classes')
                  setShowPastBookings(true)
                }}
                className="bg-zinc-900/60 rounded-2xl p-5 border border-zinc-800/50 shadow-lg text-left transition-colors hover:border-t1-red/40 focus:outline-none focus:ring-2 focus:ring-t1-red/40"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-t1-red" />
                  <span className="text-xs text-muted-foreground">Check-ins</span>
                </div>
                <p className="text-2xl font-cinzel font-bold">{attendanceCount}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </button>
              <div className="bg-zinc-900/60 rounded-2xl p-5 border border-zinc-800/50 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-t1-gold" />
                  <span className="text-xs text-muted-foreground">Rank</span>
                </div>
                <p className="text-2xl font-cinzel font-bold">{member.level}</p>
                <p className="text-xs text-muted-foreground">Keep grinding!</p>
              </div>
            </div>

            {latestMetrics && (
              <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-cinzel font-semibold">Latest Metrics</h3>
                  <button className="text-xs text-t1-red flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-cinzel font-bold">{latestMetrics.weight}</p>
                    <p className="text-xs text-muted-foreground">Weight (kg)</p>
                  </div>
                  <div>
                    <p className="text-2xl font-cinzel font-bold">{latestMetrics.body_fat_percentage}%</p>
                    <p className="text-xs text-muted-foreground">Body Fat</p>
                  </div>
                  <div>
                    <p className="text-2xl font-cinzel font-bold">{latestMetrics.muscle_mass}</p>
                    <p className="text-xs text-muted-foreground">Muscle (kg)</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="font-cinzel font-semibold">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setActiveTab('classes')}
                  className="p-4 rounded-2xl bg-gradient-to-br from-t1-red/20 to-t1-dark-red/20 border border-t1-red/30 text-left hover:from-t1-red/30 hover:to-t1-dark-red/30 transition-all"
                >
                  <Calendar className="w-6 h-6 text-t1-red mb-2" />
                  <p className="font-cinzel font-semibold text-sm">Book Class</p>
                  <p className="text-xs text-muted-foreground">Schedule training</p>
                </button>
                <button 
                  onClick={() => setActiveTab('progress')}
                  className="p-4 rounded-2xl bg-gradient-to-br from-t1-gold/20 to-[#b8860b]/20 border border-t1-gold/30 text-left hover:from-t1-gold/30 hover:to-[#b8860b]/30 transition-all"
                >
                  <TrendingUp className="w-6 h-6 text-t1-gold mb-2" />
                  <p className="font-cinzel font-semibold text-sm">Track Progress</p>
                  <p className="text-xs text-muted-foreground">View your journey</p>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'classes' && !showPastBookings && (
          <section className="flex flex-col gap-8 md:gap-10 max-w-2xl mx-auto px-2 sm:px-0 min-h-[calc(100vh-200px)]">
            <header className="sticky top-[88px] sm:top-[96px] z-30 bg-t1-black/95 backdrop-blur-xl border-b border-t1-red/20 pb-4 pt-4">
              <h2 className="text-2xl sm:text-3xl font-cinzel font-black text-gradient-t1 tracking-tight drop-shadow">Group Classes</h2>
              <p className="text-t1-gold text-sm font-semibold">Classes for {member.level} level</p>
            </header>

            {futureBookings.length > 0 && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-cinzel font-semibold text-base text-t1-gold">My Bookings</h3>
                  {pastBookings.length > 0 && (
                    <button
                      onClick={() => {
                        setLastTabBeforePastBookings(activeTab)
                        setShowPastBookings(true)
                      }}
                      className="text-xs text-t1-cream/70 hover:text-t1-cream underline transition-colors"
                    >
                      View Past Bookings ({pastBookings.length})
                    </button>
                  )}
                </div>
                <div className="grid gap-3">
                  {futureBookings.map(booking => {
                    const isUpcoming = booking.class_date >= new Date().toISOString().split('T')[0]
                    const windowState = getCheckInWindow(booking)
                    const statusBadge = booking.status === 'attended'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : booking.status === 'cancelled'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'

                    return (
                      <div key={booking.id} className="bg-gradient-to-br from-emerald-900/40 to-emerald-700/10 border border-emerald-700/30 shadow-lg rounded-2xl p-5 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-cinzel font-semibold text-lg text-t1-cream">{booking.group_class?.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(booking.class_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-emerald-400">
                              {formatTime(booking.group_class?.start_time)} - {formatTime(booking.group_class?.end_time)}
                            </p>
                            {booking.checked_in_at && (
                              <p className="text-xs text-muted-foreground mt-1">Attended at {new Date(booking.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 justify-center h-full min-h-[64px]">
                            {/* Only show status badge for attended or cancelled, not for 'booked' */}
                            {booking.status !== 'booked' && (
                              <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${statusBadge}`}>
                                {booking.status}
                              </span>
                            )}
                            {booking.status === 'booked' && (
                              <Button
                                onClick={() => handleCancelBooking(booking)}
                                disabled={bookingLoading === booking.id}
                                variant="outline"
                                className="h-8 px-3 text-xs bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg"
                              >
                                {bookingLoading === booking.id ? 'Cancelling...' : 'Cancel'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-4">
              <h3 className="font-cinzel font-semibold text-base text-t1-cream">Available Classes</h3>
              {(() => {
                const filteredClasses = groupClasses
                  .map(gc => ({
                    ...gc,
                    nextDate: getNextDateForDay(gc.day_of_week, gc.start_time, gc.end_time)
                  }))
                  .filter(gc => {
                    const nextDateObj = new Date(gc.nextDate)
                    const thursday = getNextThursday()
                    if (isAfterFridayMidnight()) return true
                    return nextDateObj <= thursday
                  })
                  .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())

                return filteredClasses.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {filteredClasses.map(gc => {
                      const nextDate = gc.nextDate
                      const booked = isClassBooked(gc.id, nextDate)
                      const isCancelled = isSessionCancelled(gc.id, nextDate)
                      // BOOKING WINDOW TEMPORARILY DISABLED - See BOOKING_WINDOW_LOGIC.md for restoration instructions
                      const isBookable = true
                      return (
                        <div key={gc.id} className="relative bg-gradient-to-br from-t1-black/80 to-t1-red/10 border border-t1-red/20 shadow-xl rounded-2xl p-5 flex flex-col gap-2 hover:scale-[1.01] transition-transform">
                          <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5 text-t1-gold" />
                            <h4 className="font-cinzel font-bold text-lg text-t1-cream drop-shadow">{gc.name}</h4>
                            {isCancelled && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                                Cancelled
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{gc.description}</p>
                          <div className="flex items-center gap-3 text-xs mb-1">
                            <span className="text-t1-gold font-semibold">{getDayName(gc.day_of_week)}s</span>
                            <span className="text-muted-foreground">
                              {formatTime(gc.start_time)} - {formatTime(gc.end_time)}
                            </span>
                          </div>
                          <p className="text-xs text-t1-cream mb-2">
                            Next: {new Date(nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-2 mt-auto">
                            {booked ? (
                              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold shadow">Booked</span>
                            ) : (
                              <Button
                                onClick={() => handleBookClass(gc)}
                                disabled={bookingLoading === gc.id || isCancelled}
                                className={`h-8 px-4 text-xs rounded-lg font-cinzel font-bold shadow ${
                                  isCancelled 
                                    ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed' 
                                    : 'bg-t1-red hover:bg-t1-dark-red text-white'
                                }`}
                              >
                                {bookingLoading === gc.id ? 'Booking...' : isCancelled ? 'Cancelled' : 'Book'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-t1-black/80 to-t1-red/10 rounded-2xl p-8 border border-t1-red/20 text-center flex flex-col items-center gap-2 shadow-lg">
                    <Calendar className="w-14 h-14 mx-auto text-t1-gold mb-2" />
                    <p className="text-t1-cream font-cinzel font-semibold">No more classes this week</p>
                    <p className="text-xs text-muted-foreground mt-1">Check back Friday for next week's schedule</p>
                  </div>
                )
              })()}
            </section>

            <footer className="pt-2 text-xs text-muted-foreground text-center">
              Note: Sessions are only deducted when you check in using the Attend button
            </footer>
          </section>
        )}

        {activeTab === 'classes' && showPastBookings && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowPastBookings(false)
                  setActiveTab(lastTabBeforePastBookings)
                }}
                className="p-2 rounded-lg bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div>
                <h2 className="text-xl font-cinzel font-bold">Past Bookings</h2>
                <p className="text-muted-foreground text-sm">Last 30 days</p>
              </div>
            </div>
            
            {pastBookings.length > 0 ? (
              <div className="space-y-3">
                {pastBookings.map(booking => {
                  const isAttended = booking.status === 'attended'
                  const statusBadge = isAttended
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                  const statusLabel = isAttended ? 'Attended' : 'Missed'

                  return (
                    <div key={booking.id} className={`rounded-xl p-4 border ${isAttended ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-cinzel font-semibold">{booking.group_class?.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(booking.class_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                          </p>
                          <p className={`text-xs mt-1 ${isAttended ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {formatTime(booking.group_class?.start_time)} - {formatTime(booking.group_class?.end_time)}
                          </p>
                          {booking.checked_in_at && (
                            <p className="text-xs text-muted-foreground mt-1">Checked in at {new Date(booking.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          )}
                        </div>
                        <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${statusBadge} whitespace-nowrap`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-secondary rounded-2xl p-6 border border-t1-red/10 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No past bookings</p>
                <p className="text-xs text-muted-foreground mt-1">Your past bookings will appear here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <section className="flex flex-col gap-8 max-w-2xl mx-auto px-2 sm:px-0">
            <header className="flex flex-col gap-1 border-b border-t1-red/20 pb-4">
              <h2 className="text-2xl sm:text-3xl font-cinzel font-black text-gradient-t1 tracking-tight drop-shadow">Progress & PRs</h2>
              <p className="text-t1-gold text-sm font-semibold">Track your journey and personal records</p>
            </header>
            <div className="mt-2">
              <WorkoutTracking memberId={member.id} />
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <div
            className="flex flex-col min-h-[calc(100vh-200px)] max-w-md mx-auto px-4 sm:px-6 space-y-4"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div className="text-center py-4 sm:py-6 flex-shrink-0">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full bg-gradient-to-br ${getLevelColor(liveMember.level)} flex items-center justify-center text-3xl sm:text-4xl mb-3 sm:mb-4`}>
                {getLevelIcon(liveMember.level)}
              </div>
              <h2 className="text-lg sm:text-xl font-cinzel font-bold">{liveMember.full_name}</h2>
              <p className="text-muted-foreground text-sm">{liveMember.member_id}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${getLevelBadgeClass(liveMember.level)}`}>
                {liveMember.level} Level
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto">
              <div className="bg-secondary rounded-2xl p-4 sm:p-5 border border-t1-red/10 space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Member ID</span>
                  <span className="text-sm font-medium">{liveMember.member_id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Phone</span>
                  <span className="text-sm font-medium">{liveMember.phone}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Email</span>
                  <span className="text-sm font-medium">{liveMember.email || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Branch</span>
                  <span className="text-sm font-medium">{branchName || 'Not assigned'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Date of Birth</span>
                  <span className="text-sm font-medium">{liveMember.date_of_birth ? new Date(liveMember.date_of_birth).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Gender</span>
                  <span className="text-sm font-medium capitalize">{liveMember.gender || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Status</span>
                  <span className="text-sm font-medium text-emerald-400 capitalize">{liveMember.status}</span>
                </div>
              </div>

              {liveMember.medical_notes && (
                <div className="bg-secondary rounded-2xl p-4 sm:p-5 border border-t1-red/10">
                  <h3 className="font-cinzel font-semibold text-sm mb-2 flex items-center gap-2">
                    <span className="text-amber-400">⚕️</span>
                    Medical Notes
                  </h3>
                  <p className="text-muted-foreground text-sm">{liveMember.medical_notes}</p>
                </div>
              )}

              {liveMember.emergency_contact && (() => {
                try {
                  const ec = JSON.parse(liveMember.emergency_contact)
                  return (
                    <div className="bg-secondary rounded-2xl p-4 sm:p-5 border border-t1-red/10">
                      <h3 className="font-cinzel font-semibold text-sm mb-3 flex items-center gap-2">
                        <span className="text-t1-red">📞</span>
                        Emergency Contact
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Name</span>
                          <span className="font-medium">{ec.name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-medium">{ec.phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Relationship</span>
                          <span className="font-medium">{ec.relationship || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )
                } catch {
                  return null
                }
              })()}

              {liveMember.loyalty_points !== null && liveMember.loyalty_points !== undefined && (
                <div className="bg-gradient-to-r from-t1-gold/20 to-t1-red/20 rounded-2xl p-4 sm:p-5 border border-t1-gold/30">
                  <h3 className="font-cinzel font-semibold text-sm mb-3 flex items-center gap-2">
                    <span className="text-t1-gold">⭐</span>
                    Loyalty Points
                  </h3>
                  <div className="text-3xl font-cinzel font-bold text-t1-gold">{liveMember.loyalty_points}</div>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 pt-4">
              <Button 
                onClick={onLogout}
                variant="outline"
                className="w-full h-12 bg-t1-red/10 border-t1-red/30 hover:bg-t1-red/20 text-t1-red rounded-xl font-cinzel"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-t1-black/95 backdrop-blur border-t border-t1-red/20 z-50 safe-area-inset-bottom">
        <div className="max-w-md mx-auto px-2 sm:px-6 py-2 sm:py-3">
          <div className="flex justify-around items-center">
            {[
              { id: 'home', icon: Dumbbell, label: 'Home' },
              { id: 'classes', icon: Calendar, label: 'Classes' },
              { id: 'progress', icon: TrendingUp, label: 'Progress' },
              { id: 'profile', icon: User, label: 'Profile' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`flex flex-col items-center gap-1 px-2 sm:px-4 py-2 rounded-xl transition-all min-w-[56px] ${
                  activeTab === item.id 
                    ? 'text-t1-red' 
                    : 'text-muted-foreground hover:text-t1-cream'
                }`}
              >
                <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}