import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, Clock, Calendar, X, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { supabase } from '../lib/supabase'

type AttendanceCheckInProps = {
  memberId?: string
  memberPin?: string
  isLoggedIn: boolean
  onClose: () => void
  onSuccess: () => void
}

type CheckInResult = {
  success: boolean
  message: string
  sessionsRemaining?: number | null
  expiryDate?: string | null
  isSessionBased?: boolean
  warnings: string[]
}

export function AttendanceCheckIn({ memberId, isLoggedIn, onClose, onSuccess }: AttendanceCheckInProps) {
  const [step, setStep] = useState<'verify' | 'processing' | 'result'>(isLoggedIn ? 'processing' : 'verify')
  const [inputMemberId, setInputMemberId] = useState('')
  const [inputPin, setInputPin] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (isLoggedIn && memberId) {
      performCheckIn(memberId)
    }
  }, [isLoggedIn, memberId])

  const verifyAndCheckIn = async () => {
    if (!inputMemberId || !inputPin) {
      setError('Please enter both User ID and PIN')
      return
    }

    setVerifying(true)
    setError('')

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, pin, status')
      .eq('member_id', inputMemberId.toUpperCase())
      .single()

    if (memberError || !member) {
      setError('Invalid User ID')
      setVerifying(false)
      return
    }

    if (member.pin !== inputPin) {
      setError('Invalid PIN')
      setVerifying(false)
      return
    }

    if (member.status !== 'active') {
      setError('Account is not active')
      setVerifying(false)
      return
    }

    setStep('processing')
    await performCheckIn(member.id)
  }

  const performCheckIn = async (mId: string) => {
    const warnings: string[] = []
    
    try {
      // Get active subscription (personal or shared)
      const { data: subscription, error: subError } = await supabase
        .from('member_subscriptions')
        .select('*, package:subscription_packages(name, type, sessions_count)')
        .eq('member_id', mId)
        .eq('status', 'active')
        .single()

      let sharedSubscription: any = null
      if (subError || !subscription) {
        // Check for shared subscription
        const { data: sharedData, error: sharedError } = await supabase
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
          .eq('member_id', mId)
        
        if (sharedError || !sharedData || sharedData.length === 0) {
          setResult({
            success: false,
            message: 'No active subscription found',
            warnings: []
          })
          setStep('result')
          return
        }

        // Get active shared subscription - with defensive checks
        const activeShared = sharedData.find((d: any) => {
          if (!d?.shared_subscription) return false
          if (d.shared_subscription.status !== 'active') return false
          if (!d.shared_subscription.end_date) return false
          const endDate = new Date(d.shared_subscription.end_date)
          return endDate >= new Date() && d.shared_subscription.sessions_remaining !== null
        })

        if (!activeShared?.shared_subscription) {
          setResult({
            success: false,
            message: 'No active subscription found',
            warnings: []
          })
          setStep('result')
          return
        }

        sharedSubscription = activeShared.shared_subscription
      }

      // Check subscription validity
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const activeSub = subscription || sharedSubscription
      const endDate = activeSub.end_date ? new Date(activeSub.end_date) : null
      if (endDate) endDate.setHours(0, 0, 0, 0)

      if (endDate && today > endDate) {
        setResult({
          success: false,
          message: 'Your subscription has expired',
          expiryDate: activeSub.end_date,
          warnings: []
        })
        setStep('result')
        return
      }

      const isSessionBased = activeSub.package?.type === 'session'
      if (isSessionBased && (activeSub.sessions_remaining === 0 || activeSub.sessions_remaining === null)) {
        setResult({
          success: false,
          message: 'No sessions remaining',
          sessionsRemaining: 0,
          warnings: []
        })
        setStep('result')
        return
      }

      // Find bookings for classes happening now (within grace period)
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      
      const { data: bookings, error: bookingsError } = await supabase
        .from('class_bookings')
        .select('*, group_class:group_classes(*)')
        .eq('member_id', mId)
        .eq('class_date', todayStr)
        .eq('status', 'booked')

      if (bookingsError || !bookings || bookings.length === 0) {
        setResult({
          success: false,
          message: 'No bookings found for today',
          warnings: ['Make sure you have booked a class for today']
        })
        setStep('result')
        return
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
            setResult({
              success: false,
              message: 'Check-in window not open yet',
              warnings: [`Check-in opens ${minutesUntilOpen} minute${minutesUntilOpen !== 1 ? 's' : ''} before class starts`]
            })
          } else {
            setResult({
              success: false,
              message: 'Check-in window has closed',
              warnings: ['Check-in closes at class end time']
            })
          }
        } else {
          setResult({
            success: false,
            message: 'Not within check-in window',
            warnings: ['Check-in is available 10 minutes before class start until class end']
          })
        }
        setStep('result')
        return
      }

      // Prevent double check-in
      const { data: existingAttendance } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('member_id', mId)
        .eq('class_booking_id', validBooking.id)
        .single()

      if (existingAttendance) {
        setResult({
          success: false,
          message: 'Already checked in',
          warnings: ['You have already checked in to this class']
        })
        setStep('result')
        return
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

      // Record attendance (return id for downstream linking if available)
      const { data: insertedAttendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .insert({
          member_id: mId,
          check_in_time: nowIso,
          check_in_method: isLoggedIn ? 'app' : 'kiosk',
          class_booking_id: validBooking.id
        })
        .select('id')
        .single()

      if (attendanceError) throw attendanceError

      // Try to deduct via RPC (shared/personal source chosen in DB). Fallback to local decrement if RPC missing.
      let newSessionsRemaining = activeSub.sessions_remaining
      if (isSessionBased) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('deduct_session_for_attendance' as any, {
            p_member_id: mId,
            p_booking_id: validBooking.id,
            p_session_id: (validBooking as any)?.session_id || null,
            p_attendance_id: insertedAttendance?.id || null
          })
          if (rpcError) throw rpcError
          if (rpcData && typeof rpcData.sessions_remaining === 'number') {
            newSessionsRemaining = rpcData.sessions_remaining
          } else if (activeSub.sessions_remaining !== null) {
            // Defensive fallback if RPC returns no shape
            newSessionsRemaining = Math.max(0, activeSub.sessions_remaining - 1)
          }
        } catch (rpcErr) {
          // Fallback to personal decrement to preserve current behavior (only for personal subs)
          if (subscription && subscription.sessions_remaining !== null) {
            newSessionsRemaining = subscription.sessions_remaining - 1
            const { error: updateError } = await supabase
              .from('member_subscriptions')
              .update({ sessions_remaining: newSessionsRemaining })
              .eq('id', subscription.id)
            if (updateError) throw updateError
          }
        }
      }

      // Generate warnings
      if (isSessionBased && newSessionsRemaining !== null && newSessionsRemaining < 4 && newSessionsRemaining > 0) {
        warnings.push(`Running low! Only ${newSessionsRemaining} session${newSessionsRemaining !== 1 ? 's' : ''} remaining.`)
      }

      if (endDate) {
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
          warnings.push(`Subscription expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}.`)
        }
      }

      setResult({
        success: true,
        message: 'Enjoy your session!',
        sessionsRemaining: newSessionsRemaining,
        expiryDate: activeSub.end_date,
        isSessionBased,
        warnings
      })
      setStep('result')
    } catch (err) {
      console.error('Check-in error:', err)
      setResult({
        success: false,
        message: 'Failed to process check-in',
        warnings: ['Please try again or contact staff']
      })
      setStep('result')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-t1-black border border-t1-red/30 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-t1-red/20 to-t1-dark-red/20 p-4 flex items-center justify-between">
          <h2 className="font-cinzel font-bold text-lg">Check-In</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'verify' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-t1-red/20 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-t1-red" />
                </div>
                <h3 className="font-cinzel font-semibold text-lg mb-2">Verify Identity</h3>
                <p className="text-sm text-muted-foreground">Enter your User ID and PIN to check in</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">User ID</label>
                  <Input
                    value={inputMemberId}
                    onChange={(e) => setInputMemberId(e.target.value.toUpperCase())}
                    placeholder="e.g. T1-0001"
                    className="bg-white/5 border-t1-red/20 h-12"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">PIN</label>
                  <Input
                    type="password"
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value)}
                    placeholder="Enter your 4-digit PIN"
                    maxLength={4}
                    className="bg-white/5 border-t1-red/20 h-12"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  onClick={verifyAndCheckIn}
                  disabled={verifying}
                  className="w-full h-12 bg-gradient-t1 text-white font-cinzel"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Check In'
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 mx-auto text-t1-red animate-spin mb-4" />
              <h3 className="font-cinzel font-semibold text-lg">Processing Check-In...</h3>
              <p className="text-sm text-muted-foreground mt-2">Please wait</p>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-6">
              <div className="text-center">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  result.success ? 'bg-emerald-500/20' : 'bg-red-500/20'
                }`}>
                  {result.success ? (
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-10 h-10 text-red-400" />
                  )}
                </div>
                <h3 className={`font-cinzel font-bold text-2xl mb-2 ${
                  result.success ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {result.success ? 'Enjoy Your Session!' : 'Check-In Failed'}
                </h3>
                <p className="text-muted-foreground">{result.message}</p>
              </div>

              {result.success && (
                <div className="bg-secondary rounded-xl p-4 space-y-3">
                  {result.isSessionBased && result.sessionsRemaining !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Sessions Remaining</span>
                      <span className={`font-cinzel font-bold text-xl ${
                        result.sessionsRemaining < 4 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {result.sessionsRemaining}
                      </span>
                    </div>
                  )}
                  {result.expiryDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Valid Until</span>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-t1-red" />
                        {new Date(result.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {result.warnings.length > 0 && (
                <div className="space-y-2">
                  {result.warnings.map((warning, idx) => (
                    <div key={idx} className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-400">{warning}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => {
                  if (result.success) {
                    onSuccess()
                  }
                  onClose()
                }}
                className={`w-full h-12 font-cinzel ${
                  result.success 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                    : 'bg-gradient-t1 text-white'
                }`}
              >
                {result.success ? 'Done' : 'Close'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
