// Gym-wide constants and subscription status shared by the admin panel and the
// member app, so the two can never drift apart on thresholds or the contact line.

// The gym's single point of contact (see the TripleOneBars vault, Gym-Hub).
export const GYM_WHATSAPP = '20122263231'

// A subscription is nudged for renewal when it has fewer than this many
// sessions left, or expires within EXPIRING_SOON_DAYS.
export const LOW_SESSIONS_THRESHOLD = 4
export const EXPIRING_SOON_DAYS = 7

// Venue QR check-in hours, in gym time: every day except Friday, from 17:00
// until 22:00, whatever the member's level or bookings. The database
// (qr_check_in_open) is the authority; the app checks first only to explain.
export const GYM_TIME_ZONE = 'Africa/Cairo'
export const QR_CHECK_IN_OPENS_HOUR = 17
export const QR_CHECK_IN_CLOSES_HOUR = 22
export const QR_CHECK_IN_CLOSED_WEEKDAY = 5 // Friday (0 = Sunday)

// Check-ins of any kind per gym day: 1, or 2 on Mondays. The database
// (daily_check_in_limit) enforces it; this only words the refusal.
export const dailyCheckInLimitMessage = (limit: number) =>
  limit > 1
    ? `You've already checked in ${limit} times today. That's the daily limit — see you tomorrow.`
    : "You've already checked in today. Only one check-in is allowed per day — see you tomorrow."

// True when a Supabase error is the database refusing a check-in over the cap.
export const isDailyCheckInLimitError = (error: { message?: string } | null | undefined) =>
  Boolean(error?.message?.includes('daily_limit_reached'))

// A booked class opens 10 minutes before it starts and closes at its end.
export const CLASS_CHECK_IN_OPENS_BEFORE_MS = 10 * 60 * 1000

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const formatHour = (hour: number) => `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`

// Weekday (0 = Sunday) and hour of `at` on the gym's clock, whatever the
// device's own time zone is.
const gymClock = (at: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: GYM_TIME_ZONE,
    weekday: 'long',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at)
  const weekday = WEEKDAYS.indexOf(parts.find(p => p.type === 'weekday')?.value ?? '')
  const hour = Number(parts.find(p => p.type === 'hour')?.value)
  return { weekday, hour }
}

// Null while QR check-in is open, otherwise a message saying when it opens.
export const getQrCheckInClosedMessage = (at: Date = new Date()): string | null => {
  const { weekday, hour } = gymClock(at)
  const opens = formatHour(QR_CHECK_IN_OPENS_HOUR)
  const closes = formatHour(QR_CHECK_IN_CLOSES_HOUR)
  const nextOpenDay = (from: number) => {
    const day = (from + 1) % 7
    return day === QR_CHECK_IN_CLOSED_WEEKDAY ? (day + 1) % 7 : day
  }

  if (weekday === QR_CHECK_IN_CLOSED_WEEKDAY) {
    return `Check-in is closed on ${WEEKDAYS[weekday]}s. It opens ${WEEKDAYS[nextOpenDay(weekday)]} at ${opens}.`
  }
  if (hour < QR_CHECK_IN_OPENS_HOUR) {
    return `Check-in opens at ${opens} today (open ${opens} – ${closes}).`
  }
  if (hour >= QR_CHECK_IN_CLOSES_HOUR) {
    const next = nextOpenDay(weekday)
    const when = next === (weekday + 1) % 7 ? 'tomorrow' : WEEKDAYS[next]
    return `Check-in closed at ${closes}. It opens ${when} at ${opens}.`
  }
  return null
}

export type SubscriptionLike = {
  sessions_remaining: number | null
  end_date: string | null
  status?: string | null
  package?: { type?: string | null } | null
}

export type SubscriptionStatus = {
  isValid: boolean
  isExpired: boolean
  isExhausted: boolean
  needsRenewal: boolean
  renewalReason: string | null
  daysUntilExpiry: number | null
}

const startOfDay = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export const getSubscriptionStatus = (
  subscription: SubscriptionLike | null | undefined
): SubscriptionStatus => {
  if (!subscription) {
    return { isValid: false, isExpired: false, isExhausted: false, needsRenewal: false, renewalReason: null, daysUntilExpiry: null }
  }

  const today = startOfDay(new Date())
  const endDate = subscription.end_date ? startOfDay(new Date(subscription.end_date)) : null
  const isSessionBased = subscription.package?.type === 'session'

  const isExpired = endDate ? today > endDate : false
  const isExhausted = isSessionBased && (subscription.sessions_remaining === null || subscription.sessions_remaining <= 0)
  const isValid = !isExpired && !isExhausted && subscription.status === 'active'

  let daysUntilExpiry: number | null = null
  if (endDate) {
    daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  let needsRenewal = false
  let renewalReason: string | null = null

  if (
    isSessionBased &&
    subscription.sessions_remaining !== null &&
    subscription.sessions_remaining > 0 &&
    subscription.sessions_remaining < LOW_SESSIONS_THRESHOLD
  ) {
    needsRenewal = true
    renewalReason = `Only ${subscription.sessions_remaining} sessions remaining`
  } else if (daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= EXPIRING_SOON_DAYS) {
    needsRenewal = true
    renewalReason = `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`
  }

  return { isValid, isExpired, isExhausted, needsRenewal, renewalReason, daysUntilExpiry }
}
