import { useCallback, useEffect, useState } from 'react'
import { MapPin, Clock, Check, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/button'
import { supabase } from '../../lib/supabase'
import { formatGymClock } from '../../lib/gym'

// Staff check-in for today's session. The database decides everything
// (schedule, 60-to-10-minute window, 500 m radius, one per day); this card
// only asks for the device location and explains the answer.

type Today =
  | { scheduled: false }
  | {
      scheduled: true
      session_time: string
      session_at: string
      opens_at: string
      closes_at: string
      checked_in: boolean
      checked_in_at: string | null
      status: 'present' | 'override' | null
    }

type CheckInResult = {
  ok?: boolean
  error?: string
  opens_at?: string
  closes_at?: string
  distance_m?: number
  accuracy_m?: number
  checked_in_at?: string
}

const refusalMessage = (r: CheckInResult): string => {
  switch (r.error) {
    case 'not_scheduled': return "You don't have a session today, so there's nothing to check in for."
    case 'already_checked_in': return 'You already checked in today.'
    case 'too_early': return `Check-in opens at ${formatGymClock(r.opens_at!)} (1 hour before your session).`
    case 'too_late': return `Check-in closed at ${formatGymClock(r.closes_at!)} (10 minutes before your session). Ask an admin to mark you present.`
    case 'location_required': return 'We need your location to check you in.'
    case 'location_imprecise': return `Your location is too rough (±${r.accuracy_m} m). Turn on precise location and try again.`
    case 'too_far': return `You're ${r.distance_m} m from the gym. You need to be within 500 m to check in.`
    case 'not_signed_in': return 'Your session expired. Log out and log in again.'
    default: return 'Check-in failed. Please try again.'
  }
}

const locationErrorMessage = (err: GeolocationPositionError) => {
  if (err.code === err.PERMISSION_DENIED) return 'Location is blocked. Allow location for this site in your browser settings, then try again.'
  if (err.code === err.TIMEOUT) return "Couldn't get your location in time. Move somewhere with better signal and try again."
  return "Couldn't get your location. Check that location services are on and try again."
}

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error("This browser can't share your location."))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    })
  })

export function CoachCheckIn({ adminToken }: { adminToken?: string }) {
  const [today, setToday] = useState<Today | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!adminToken) return
    const { data, error } = await supabase.rpc('coach_today', { p_token: adminToken })
    if (!error && data && !data.error) setToday(data)
  }, [adminToken])

  useEffect(() => { load() }, [load])

  if (!today || !today.scheduled) return null

  const handleCheckIn = async () => {
    setBusy(true)
    setMessage(null)
    try {
      let position: GeolocationPosition
      try {
        position = await getPosition()
      } catch (err) {
        const text = err instanceof GeolocationPositionError ? locationErrorMessage(err) : (err as Error).message
        setMessage({ kind: 'error', text })
        return
      }

      const { data, error } = await supabase.rpc('coach_check_in', {
        p_token: adminToken,
        p_lat: position.coords.latitude,
        p_lng: position.coords.longitude,
        p_accuracy: position.coords.accuracy,
      })
      if (error || !data) throw error ?? new Error('No response')

      if (data.ok) {
        setMessage({ kind: 'success', text: `Checked in at ${formatGymClock(data.checked_in_at)} (${data.distance_m} m from the gym).` })
      } else {
        setMessage({ kind: 'error', text: refusalMessage(data) })
      }
      await load()
    } catch (err) {
      console.error('Coach check-in failed:', err)
      setMessage({ kind: 'error', text: 'Check-in failed. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const now = Date.now()
  const opens = new Date(today.opens_at).getTime()
  const closes = new Date(today.closes_at).getTime()
  const windowState = today.checked_in ? 'done' : now < opens ? 'early' : now > closes ? 'closed' : 'open'

  return (
    <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-cinzel font-semibold">My attendance</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Clock className="w-4 h-4 text-t1-gold" />
            Session today at {formatGymClock(today.session_at)} · check in {formatGymClock(today.opens_at)} – {formatGymClock(today.closes_at)}
          </p>
        </div>
        {windowState === 'done' && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
            <Check className="w-3.5 h-3.5" />
            {today.status === 'override' ? 'Marked present' : 'Checked in'}
          </span>
        )}
      </div>

      {windowState === 'done' && today.checked_in_at && (
        <p className="text-sm text-muted-foreground">Recorded at {formatGymClock(today.checked_in_at)}.</p>
      )}

      {windowState === 'open' && (
        <Button
          onClick={handleCheckIn}
          disabled={busy}
          className="w-full h-12 bg-gradient-t1 text-white rounded-xl font-cinzel flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
          {busy ? 'Getting your location…' : 'Check in now'}
        </Button>
      )}

      {windowState === 'early' && (
        <p className="text-sm text-muted-foreground">Check-in opens at {formatGymClock(today.opens_at)}. You'll need to be within 500 m of the gym.</p>
      )}

      {windowState === 'closed' && (
        <p className="text-sm text-t1-red flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Check-in closed at {formatGymClock(today.closes_at)}. Ask an admin to mark you present.
        </p>
      )}

      {message && (
        <p className={`text-sm ${message.kind === 'success' ? 'text-emerald-400' : 'text-t1-red'}`}>{message.text}</p>
      )}
    </div>
  )
}
