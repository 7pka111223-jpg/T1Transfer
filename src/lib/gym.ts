// Gym-wide constants and subscription status shared by the admin panel and the
// member app, so the two can never drift apart on thresholds or the contact line.

// The gym's single point of contact (see the TripleOneBars vault, Gym-Hub).
export const GYM_WHATSAPP = '20122263231'

// A subscription is nudged for renewal when it has fewer than this many
// sessions left, or expires within EXPIRING_SOON_DAYS.
export const LOW_SESSIONS_THRESHOLD = 4
export const EXPIRING_SOON_DAYS = 7

// Check-in windows. The venue QR is valid from 30 minutes before a session
// starts until 30 minutes after it ends; a booked class opens 10 minutes before
// it starts and closes at the end of the class.
export const QR_CHECK_IN_GRACE_MS = 30 * 60 * 1000
export const CLASS_CHECK_IN_OPENS_BEFORE_MS = 10 * 60 * 1000

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
