import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, X, Loader2, Download } from 'lucide-react'
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
  location: string | null
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

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// One CSV with two tables: every successful check-in in the period, then
// per-person totals (scheduled / attended / missed days).
const buildAttendanceCsv = (rows: ReportRow[], roles: Record<string, string>, from: string, to: string) => {
  const lines: unknown[][] = [
    [`Coach attendance ${from} to ${to}`],
    [],
    ['Check-ins'],
    ['Date', 'Weekday', 'Staff', 'Role', 'Session time', 'Checked in at', 'Location', 'Recorded by', 'Distance from branch (m)', 'Note'],
  ]
  const attended = rows
    .filter(r => r.status === 'present' || r.status === 'override')
    .sort((a, b) => a.gym_date.localeCompare(b.gym_date) || a.full_name.localeCompare(b.full_name))
  for (const r of attended) {
    lines.push([
      r.gym_date,
      WEEKDAY_NAMES[new Date(`${r.gym_date}T12:00:00Z`).getUTCDay()],
      r.full_name,
      roles[r.admin_id] ?? '',
      formatSessionTime(r.session_time),
      r.checked_in_at ? formatGymClock(r.checked_in_at) : '',
      r.location ?? '',
      r.status === 'present' ? 'Self (location check-in)' : `Marked present by ${r.override_by_name ?? 'an admin'}`,
      r.distance_m ?? '',
      r.note ?? '',
    ])
  }
  if (attended.length === 0) lines.push(['No check-ins in this period'])

  lines.push([], ['Totals'], ['Staff', 'Role', 'Scheduled days', 'Attended days', 'Missed days'])
  const totals = new Map<string, { name: string; scheduled: number; attended: number; missed: number }>()
  for (const r of rows) {
    const t = totals.get(r.admin_id) ?? { name: r.full_name, scheduled: 0, attended: 0, missed: 0 }
    t.scheduled += 1
    if (r.status === 'present' || r.status === 'override') t.attended += 1
    if (r.status === 'missed') t.missed += 1
    totals.set(r.admin_id, t)
  }
  for (const [id, t] of [...totals].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    lines.push([t.name, roles[id] ?? '', t.scheduled, t.attended, t.missed])
  }

  return lines.map(line => line.map(csvCell).join(',')).join('\r\n')
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
  const [exportFrom, setExportFrom] = useState(() => `${gymDateString().slice(0, 8)}01`)
  const [exportTo, setExportTo] = useState(() => gymDateString())
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  // An N/A day being given a time (shows the time picker instead of "N/A").
  const [assigningCell, setAssigningCell] = useState<string | null>(null)

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

  const exportCsv = async () => {
    setExportMessage('')
    if (!exportFrom || !exportTo || exportTo < exportFrom) {
      setExportMessage('Pick a From date on or before the To date.')
      return
    }
    setExporting(true)
    try {
      const { data, error } = await supabase.rpc('coach_attendance_report', { p_token: adminToken, p_from: exportFrom, p_to: exportTo })
      if (error || !Array.isArray(data)) {
        setExportMessage(data?.error === 'invalid_range' ? 'The period can be at most one year.' : 'Could not export attendance.')
        return
      }
      const roles = Object.fromEntries((staff ?? []).map(p => [p.id, p.role]))
      const csv = buildAttendanceCsv(data, roles, exportFrom, exportTo)
      // BOM so Excel reads the file as UTF-8
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `coach_attendance_${exportFrom}_to_${exportTo}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      const checkIns = data.filter((r: ReportRow) => r.status === 'present' || r.status === 'override').length
      setExportMessage(`Exported ${checkIns} check-in${checkIns === 1 ? '' : 's'}.`)
    } finally {
      setExporting(false)
    }
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
                        {row.location && ` · ${row.location}`}
                        {row.distance_m !== null && ` (${row.distance_m} m away)`}
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
          <h3 className="font-cinzel font-semibold">Export attendance</h3>
          <p className="text-xs text-muted-foreground mt-1">
            CSV with every successful check-in in the period (who, when, recorded by) and each person's attended days.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">From</span>
            <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)}
              className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">To</span>
            <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)}
              className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl" />
          </label>
        </div>
        <Button onClick={exportCsv} disabled={exporting}
          className="w-full h-11 bg-gradient-t1 text-white rounded-xl flex items-center justify-center gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
        {exportMessage && <p className="text-xs text-muted-foreground">{exportMessage}</p>}
      </div>

      <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10 space-y-4">
        <div>
          <h3 className="font-cinzel font-semibold">Weekly session times</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Check-in opens 1 hour before the session and closes 5 minutes before it. N/A means no session that day: no check-in and nothing marked missed.
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
                const time = person.schedule[String(weekday)]
                const assigned = Boolean(time) || assigningCell === key
                return (
                  <div key={key} className="space-y-1">
                    <span className="text-[11px] text-muted-foreground flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        {label}
                        {savingCell === key && <Loader2 className="w-3 h-3 animate-spin" />}
                      </span>
                      {time && (
                        <button
                          onClick={() => saveTime(person, weekday, '')}
                          disabled={savingCell === key}
                          className="text-muted-foreground hover:text-t1-red"
                          aria-label={`Set ${label} to not assigned`}
                          title="Set to N/A"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </span>
                    {assigned ? (
                      <input
                        type="time"
                        autoFocus={!time}
                        defaultValue={time ?? ''}
                        key={`${key}-${time ?? ''}`}
                        onBlur={async (e) => {
                          const value = e.target.value
                          if (value) await saveTime(person, weekday, value)
                          setAssigningCell(null)
                        }}
                        className="w-full h-9 px-2 rounded-lg bg-t1-black border border-t1-red/20 text-t1-cream text-sm"
                      />
                    ) : (
                      <button
                        onClick={() => setAssigningCell(key)}
                        className="w-full h-9 rounded-lg border border-dashed border-white/15 text-muted-foreground text-xs hover:border-t1-red/40 hover:text-t1-cream"
                        title="Not assigned. Tap to set a session time."
                      >
                        N/A
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
