import { useState, useEffect } from 'react'
import { Calendar, Clock, Users, ChevronLeft, ChevronRight, X, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'
import { supabase } from '../lib/supabase'

type GroupSessionBookingProps = {
  memberId: string
  memberLevel: string
  memberBranch: string | null
  onClose: () => void
}

type GroupClass = {
  id: string
  name: string
  description: string | null
  coach_id: string | null
  member_level: string
  max_capacity: number | null
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  coach?: { full_name: string } | null
}

type ClassBooking = {
  id: string
  class_id: string
  member_id: string
  class_date: string
  status: string
  checked_in_at: string | null
  group_class?: GroupClass
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function GroupSessionBooking({ memberId, memberLevel, memberBranch }: GroupSessionBookingProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [weekOffset, setWeekOffset] = useState(0)
  const [classes, setClasses] = useState<GroupClass[]>([])
  const [myBookings, setMyBookings] = useState<ClassBooking[]>([])
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({})
  const [cancelledSessions, setCancelledSessions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [view, setView] = useState<'schedule' | 'my-bookings'>('schedule')

  useEffect(() => {
    loadData()
  }, [memberId, memberBranch, weekOffset])

  const loadData = async () => {
    setLoading(true)
    const startOfWeek = getWeekDates()[0]
    const endOfWeek = getWeekDates()[6]

    const [classesRes, bookingsRes, allBookingsRes, cancelledSessionsRes] = await Promise.all([
      (async () => {
        let query = supabase
          .from('group_classes')
          .select('*, coach:coaches(full_name)')
          .eq('is_active', true)
          .in('member_level', [memberLevel, 'All'])
        if (memberBranch) {
          query = query.eq('branch_id', memberBranch)
        }
        return query
      })(),
      supabase
        .from('class_bookings')
        .select('*, group_class:group_classes(*)')
        .eq('member_id', memberId)
        .gte('class_date', startOfWeek.toISOString().split('T')[0])
        .neq('status', 'cancelled'),
      supabase
        .from('class_bookings')
        .select('class_id, class_date')
        .gte('class_date', startOfWeek.toISOString().split('T')[0])
        .lte('class_date', endOfWeek.toISOString().split('T')[0])
        .neq('status', 'cancelled'),
      supabase
        .from('class_sessions')
        .select('group_class_id, session_date')
        .eq('status', 'cancelled')
        .gte('session_date', startOfWeek.toISOString().split('T')[0])
        .lte('session_date', endOfWeek.toISOString().split('T')[0])
    ])

    if (classesRes.data) setClasses(classesRes.data)
    if (bookingsRes.data) setMyBookings(bookingsRes.data)

    if (allBookingsRes.data) {
      const counts: Record<string, number> = {}
      allBookingsRes.data.forEach((b: { class_id: string; class_date: string }) => {
        const key = `${b.class_id}-${b.class_date}`
        counts[key] = (counts[key] || 0) + 1
      })
      setBookingCounts(counts)
    }

    if (cancelledSessionsRes.data) {
      const cancelledKeys = new Set(cancelledSessionsRes.data.map(s => `${s.group_class_id}-${s.session_date}`))
      setCancelledSessions(cancelledKeys)
    }

    setLoading(false)
  }

  const getWeekDates = () => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (weekOffset * 7))
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }

  const getClassesForDate = (date: Date) => {
    const dayOfWeek = date.getDay()
    return classes.filter(c => c.day_of_week === dayOfWeek)
  }

  const isDatePast = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const hasBooking = (classId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return myBookings.some(b => b.class_id === classId && b.class_date === dateStr && b.status !== 'cancelled')
  }

  const getBookingForClass = (classId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return myBookings.find(b => b.class_id === classId && b.class_date === dateStr && b.status !== 'cancelled')
  }

  const getSpotsTaken = (classId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const key = `${classId}-${dateStr}`
    return bookingCounts[key] || 0
  }

  const isSessionCancelled = (classId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const key = `${classId}-${dateStr}`
    return cancelledSessions.has(key)
  }

  const buildClassDateTime = (date: Date, time: string) => {
    const [hours, minutes, seconds = '00'] = time.split(':')
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      parseInt(hours, 10),
      parseInt(minutes, 10),
      parseInt(seconds, 10)
    )
  }

  // Booking closes 1 hour before class start (local time)
  const isBookingWindowClosed = (groupClass: GroupClass, date: Date) => {
    const classStart = buildClassDateTime(date, groupClass.start_time)
    const cutoff = new Date(classStart.getTime() - 60 * 60 * 1000)
    return new Date() >= cutoff
  }

  const bookClass = async (groupClass: GroupClass, date: Date) => {
    if (isDatePast(date) || hasBooking(groupClass.id, date)) return

    if (isSessionCancelled(groupClass.id, date)) {
      alert('This class has been cancelled.')
      return
    }

    if (isBookingWindowClosed(groupClass, date)) {
      alert('Booking window closed: classes must be booked at least 1 hour before start time.')
      return
    }
    
    const dateStr = date.toISOString().split('T')[0]
    const spotsTaken = getSpotsTaken(groupClass.id, date)
    
    if (groupClass.max_capacity && spotsTaken >= groupClass.max_capacity) {
      return
    }

    setProcessing(groupClass.id)

    const { data, error } = await supabase
      .from('class_bookings')
      .insert({
        class_id: groupClass.id,
        member_id: memberId,
        class_date: dateStr,
        status: 'booked'
      })
      .select('*, group_class:group_classes(*)')
      .single()

    if (!error && data) {
      setMyBookings([...myBookings, data])
      const key = `${groupClass.id}-${dateStr}`
      setBookingCounts({ ...bookingCounts, [key]: (bookingCounts[key] || 0) + 1 })
    }

    setProcessing(null)
  }

  const cancelBooking = async (booking: ClassBooking) => {
    setProcessing(booking.id)

    const { error } = await supabase
      .from('class_bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)

    if (!error) {
      setMyBookings(myBookings.filter(b => b.id !== booking.id))
      const key = `${booking.class_id}-${booking.class_date}`
      setBookingCounts({ ...bookingCounts, [key]: Math.max(0, (bookingCounts[key] || 1) - 1) })
    }

    setProcessing(null)
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  const weekDates = getWeekDates()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel font-bold text-xl">Group Sessions</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('schedule')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'schedule' ? 'bg-t1-red text-white' : 'bg-white/5 text-muted-foreground'
            }`}
          >
            Schedule
          </button>
          <button
            onClick={() => setView('my-bookings')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === 'my-bookings' ? 'bg-t1-red text-white' : 'bg-white/5 text-muted-foreground'
            }`}
          >
            My Bookings
          </button>
        </div>
      </div>

      {view === 'schedule' && (
        <>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              disabled={weekOffset === 0}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-cinzel font-semibold">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 3}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {weekDates.map((date, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                disabled={isDatePast(date)}
                className={`flex-shrink-0 w-14 py-3 rounded-xl text-center transition-all ${
                  selectedDate.toDateString() === date.toDateString()
                    ? 'bg-t1-red text-white'
                    : isDatePast(date)
                      ? 'bg-white/5 text-muted-foreground/50'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <p className="text-xs">{DAYS[date.getDay()].slice(0, 3)}</p>
                <p className="text-lg font-bold">{date.getDate()}</p>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-t1-red" />
            </div>
          ) : (
            <div className="space-y-3">
              {getClassesForDate(selectedDate).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No classes scheduled for this day</p>
                </div>
              ) : (
                getClassesForDate(selectedDate).map(groupClass => {
                  const booked = hasBooking(groupClass.id, selectedDate)
                  const spotsTaken = getSpotsTaken(groupClass.id, selectedDate)
                  const isFull = groupClass.max_capacity ? spotsTaken >= groupClass.max_capacity : false
                  const isPast = isDatePast(selectedDate)
                  const isClosed = isBookingWindowClosed(groupClass, selectedDate)

                  return (
                    <div
                      key={groupClass.id}
                      className={`bg-secondary rounded-xl p-4 border ${
                        booked ? 'border-emerald-500/30' : 'border-t1-red/10'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-cinzel font-semibold">{groupClass.name}</h3>
                            {booked && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Booked
                              </span>
                            )}
                            {isSessionCancelled(groupClass.id, selectedDate) && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex items-center gap-1">
                                <X className="w-3 h-3" /> Cancelled
                              </span>
                            )}
                          </div>
                          {groupClass.description && (
                            <p className="text-sm text-muted-foreground mb-2">{groupClass.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(groupClass.start_time)} - {formatTime(groupClass.end_time)}
                            </span>
                            {groupClass.max_capacity && (
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {spotsTaken}/{groupClass.max_capacity}
                              </span>
                            )}
                          </div>
                          {groupClass.coach && (
                            <p className="text-sm text-t1-gold mt-1">Coach: {groupClass.coach.full_name}</p>
                          )}
                        </div>
                        <div>
                          {booked ? (
                            <Button
                              onClick={() => {
                                const booking = getBookingForClass(groupClass.id, selectedDate)
                                if (booking) cancelBooking(booking)
                              }}
                              disabled={processing === getBookingForClass(groupClass.id, selectedDate)?.id || isPast || isSessionCancelled(groupClass.id, selectedDate)}
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                              {processing === getBookingForClass(groupClass.id, selectedDate)?.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Cancel'
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => bookClass(groupClass, selectedDate)}
                              disabled={processing === groupClass.id || isFull || isPast || isClosed || isSessionCancelled(groupClass.id, selectedDate)}
                              className={isFull || isClosed || isSessionCancelled(groupClass.id, selectedDate) ? 'bg-zinc-600' : 'bg-gradient-t1'}
                            >
                              {processing === groupClass.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isSessionCancelled(groupClass.id, selectedDate) ? (
                                'Cancelled'
                              ) : isFull ? (
                                'Full'
                              ) : isClosed ? (
                                'Closed'
                              ) : (
                                'Book'
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}

      {view === 'my-bookings' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-t1-red" />
            </div>
          ) : myBookings.filter(b => new Date(b.class_date) >= new Date(new Date().toDateString())).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming bookings</p>
              <Button 
                onClick={() => setView('schedule')}
                className="mt-4 bg-gradient-t1"
              >
                Browse Schedule
              </Button>
            </div>
          ) : (
            myBookings
              .filter(b => new Date(b.class_date) >= new Date(new Date().toDateString()))
              .sort((a, b) => new Date(a.class_date).getTime() - new Date(b.class_date).getTime())
              .map(booking => (
                <div
                  key={booking.id}
                  className="bg-secondary rounded-xl p-4 border border-t1-red/10"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-cinzel font-semibold">{booking.group_class?.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(booking.class_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        {booking.group_class && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime(booking.group_class.start_time)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          booking.status === 'booked' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : booking.status === 'attended'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                        }`}>
                          {booking.status === 'booked' ? 'Booked' : booking.status === 'attended' ? 'Attended' : booking.status}
                        </span>
                      </div>
                    </div>
                    {booking.status === 'booked' && (
                      <Button
                        onClick={() => cancelBooking(booking)}
                        disabled={processing === booking.id}
                        variant="outline"
                        size="sm"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        {processing === booking.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))
          )}

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-400">
              Sessions are not deducted until you check in using the Attend feature.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
