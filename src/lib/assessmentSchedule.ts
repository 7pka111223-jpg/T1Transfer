// Free-assessment slots a new lead can book, per branch and weekday.
// Days use JavaScript's numbering: 0 = Sunday ... 6 = Saturday (Friday closed).

export type AssessmentSlot = {
  time: string // "19:00", gym clock
  label: string // what the session is, e.g. "Beginners"
}

const DEFAULT_SLOTS: AssessmentSlot[] = [
  { time: '19:00', label: '' },
  { time: '20:00', label: '' },
  { time: '21:00', label: '' },
]

const FIRST_SETTLEMENT: Record<number, AssessmentSlot[]> = {
  6: [ // Saturday
    { time: '18:00', label: 'Ladies only' },
    { time: '19:00', label: 'Intermediate' },
    { time: '20:00', label: 'Beginners' },
    { time: '21:00', label: 'Advanced' },
  ],
  0: [ // Sunday
    { time: '19:00', label: 'Beginners' },
    { time: '20:00', label: 'Intermediate' },
    { time: '21:00', label: 'Advanced' },
  ],
  1: [ // Monday
    { time: '18:00', label: 'Ladies only' },
    { time: '19:00', label: 'Legs · All levels' },
    { time: '20:00', label: 'Mobility · All levels' },
  ],
  2: [ // Tuesday
    { time: '19:00', label: 'Beginners' },
    { time: '20:00', label: 'Intermediate' },
    { time: '21:00', label: 'Advanced' },
  ],
  3: [ // Wednesday
    { time: '18:00', label: 'Ladies only' },
    { time: '19:00', label: 'Intermediate' },
    { time: '20:00', label: 'Beginners' },
    { time: '21:00', label: 'Advanced' },
  ],
  4: [ // Thursday
    { time: '19:00', label: 'Legs' },
    { time: '20:00', label: 'T1 Lab session' },
  ],
}

const isFirstSettlement = (branchName: string | null | undefined) =>
  !!branchName && /settlement/i.test(branchName)

/** The slots offered at a branch on a given weekday (0 = Sunday). */
export function assessmentSlotsFor(branchName: string | null | undefined, weekday: number): AssessmentSlot[] {
  if (isFirstSettlement(branchName)) return FIRST_SETTLEMENT[weekday] ?? []
  return DEFAULT_SLOTS
}

/** The session label for a booked slot, or '' when the slot has none. */
export function assessmentSlotLabel(branchName: string | null | undefined, day: string | null, time: string | null): string {
  if (!day || !time) return ''
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  const hhmm = time.slice(0, 5)
  return assessmentSlotsFor(branchName, weekday).find(s => s.time === hhmm)?.label ?? ''
}
