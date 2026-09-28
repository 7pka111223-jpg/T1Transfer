import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { supabase } from '../../lib/supabase'
import { formatGymClock, gymDateString } from '../../lib/gym'

// Admin-only: who checked in for their session, overrides for late arrivals,
// and each staff member's weekly session times. All rules live in the
// coach_* RPCs; this screen reads and edits through them.

type ReportRow = {
  admin_id: string
  full_name: string
  gym_date: string
  session_time: string | null
  status: 'present' | 'override' | 'missed' | 'open' | 'upcoming'
  checked_in_at: string | null
  distance_m: number | null
  note: string | null
  override_by_name: string | null
}

type StaffSchedule = {
  id: string
  full_name: string
  username: string
  role: 'admin' | 'coach'
  schedule: Record<string, string>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_STYLE: Record<ReportRow['status'], { label: string; className: string }> = {
  present: { label: 'Checked in', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  override: { label: 'Marked present', className: 'text-t1-gold bg-t1-gold/10 border-t1-gold/30' },
  missed: { label: 'Missed', className: 'text-red-400 bg-red-500/10 border-red-500/30' },
  open: { label: 'Check-in open', className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  upcoming: { label: 'Upcoming', className: 'text-muted-foreground bg-white/5 border-white/10' },
}

const formatDay = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })

const formatSessionTime = (hhmm: string | null) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export function CoachAttendance({ adminToken }: { adminToken?: string }) {
  // Week shown = the 7 gym days ending `weekOffset` weeks before today.
  const [weekOffset, setWeekOffset] = useState(0)
  const [report, setReport] = useState<ReportRow[] | null>(null)
  const [staff, setStaff] = useState<StaffSchedule[] | null>(null)
  const [error, setError] = useState('')
  const [overrideFor, setOverrideFor] = useState<string | null>(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [savingCell, setSavingCell] = useState<string | null>(null)

  const to = gymDateString(new Date(), -7 * weekOffset)
  const from = gymDateString(new Date(), -7 * weekOffset - 6)

  const loadReport = useCallback(async () => {
    const { data, error } = await supabase.rpc('coach_attendance_report', { p_token: adminToken, p_from: from, p_to: to })
    if (error || data?.error) {
      setError(data?.error === 'not_admin' ? 'Only admins can see coach attendance.' : 'Could not load attendance.')
      return
    }
    setReport(data)
  }, [adminToken, from, to])

  const loadStaff = useCallback(async () => {
    const { data, error } = await supabase.rpc('coach_schedule_list', { p_token: adminToken })
    if (!error && Array.isArray(data)) setStaff(data)
  }, [adminToken])

  useEffect(() => { loadReport() }, [loadReport])
  useEffect(() => { loadStaff() }, [loadStaff])

  const saveOverride = async (row: ReportRow) => {
    const { data, error } = await supabase.rpc('coach_attendance_override', {
      p_token: adminToken, p_admin_id: row.admin_id, p_date: row.gym_date, p_note: overrideNote,
    })
    if (error || data?.error) {
      alert(data?.error === 'note_required' ? 'Add a short note (e.g. why they were late).' : 'Could not mark present.')
      return
    }
    setOverrideFor(null)
    setOverrideNote('')
    loadReport()
  }

  const saveTime = async (person: StaffSchedule, weekday: number, value: string) => {
    const current = person.schedule[String(weekday)] ?? ''
    if (value === current) return
    const key = `${person.id}-${weekday}`
    setSavingCell(key)
    const { data, error } = await supabase.rpc('coach_schedule_set', {
      p_token: adminToken, p_admin_id: person.id, p_weekday: weekday, p_time: value || null,
    })
    setSavingCell(null)
    if (error || data?.error) {
      alert('Could not save the schedule.')
      return
    }
    await loadStaff()
    loadReport()
  }

  if (error) return <p className="text-t1-red text-sm">{error}</p>

  const days = report ? [...new Set(report.map(r => r.gym_date))] : []

  return (
    <div className="space-y-6">
      <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-cinzel font-semibold">Coach attendance</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-xl bg-t1-black border border-t1-red/20" aria-label="Previous week">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDay(from).split(', ')[1]} – {formatDay(to).split(', ')[1]}</span>
            <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} className="p-2 rounded-xl bg-t1-black border border-t1-red/20 disabled:opacity-40" aria-label="Next week">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!report && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        {report && report.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions scheduled in this week. Set session times below.</p>
        )}

        {days.map(day => (
          <div key={day} className="space-y-2">
            <p className="text-xs font-semibold text-t1-gold">{formatDay(day)}</p>
            {report!.filter(r => r.gym_date === day).map(row => {
              const key = `${row.admin_id}-${row.gym_date}`
              const style = STATUS_STYLE[row.status]
              const canOverride = row.status === 'missed' || row.status === 'open'
              return (
                <div key={key} className="rounded-xl bg-t1-black/40 border border-t1-red/10 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{row.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Session {formatSessionTime(row.session_time)}
                        {row.checked_in_at && ` · at ${formatGymClock(row.checked_in_at)}`}
                        {row.distance_m !== null && ` · ${row.distance_m} m away`}
                      </p>
                      {row.note && (
                        <p className="text-xs text-muted-foreground mt-1">
                          “{row.note}”{row.override_by_name && ` — ${row.override_by_name}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-1 ${style.className}`}>{style.label}</span>
                      {canOverride && overrideFor !== key && (
                        <Button size="sm" variant="outline" onClick={() => { setOverrideFor(key); setOverrideNote('') }}
                          className="h-8 text-xs bg-transparent border-t1-red/30 text-t1-cream rounded-lg">
                          Mark present
                        </Button>
                      )}
                    </div>
                  </div>
                  {overrideFor === key && (
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        value={overrideNote}
                        onChange={(e) => setOverrideNote(e.target.value)}
                        placeholder="Note, e.g. arrived 6:05, traffic"
                        className="h-9 bg-t1-black border-t1-red/30 text-t1-cream rounded-lg text-sm"
                      />
                      <Button size="sm" onClick={() => saveOverride(row)} disabled={!overrideNote.trim()} className="h-9 bg-gradient-t1 text-white rounded-lg" aria-label="Save">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setOverrideFor(null)} className="h-9 bg-transparent border-t1-red/30 text-t1-cream rounded-lg" aria-label="Cancel">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10 space-y-4">
        <div>
          <h3 className="font-cinzel font-semibold">Weekly session times</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Check-in opens 1 hour before the session and closes 10 minutes before it. Leave a day empty if they have no session.
          </p>
        </div>
        {!staff && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
        {staff?.map(person => (
          <div key={person.id} className="space-y-2">
            <p className="text-sm font-semibold">
              {person.full_name}
              <span className="ml-2 text-[11px] font-normal text-muted-foreground uppercase tracking-wide">{person.role}</span>
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {WEEKDAYS.map((label, weekday) => {
                const key = `${person.id}-${weekday}`
                return (
                  <label key={key} className="space-y-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      {label}
                      {savingCell === key && <Loader2 className="w-3 h-3 animate-spin" />}
                    </span>
                    <input
                      type="time"
                      defaultValue={person.schedule[String(weekday)] ?? ''}
                      key={`${key}-${person.schedule[String(weekday)] ?? ''}`}
                      onBlur={(e) => saveTime(person, weekday, e.target.value)}
                      className="w-full h-9 px-2 rounded-lg bg-t1-black border border-t1-red/20 text-t1-cream text-sm"
                    />
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
