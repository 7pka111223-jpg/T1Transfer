import { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, Clock, User, Phone, Mail, CheckCircle, Loader2, MapPin } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { supabase } from '../lib/supabase'

type AssessmentBookingProps = {
  onBack: () => void
  onSuccess: () => void
}

type BranchData = {
  id: string
  name: string
  location?: string
}

const AVAILABLE_TIMES = ['19:00','20:00','21:00']

function getAvailableDates(): Date[] {
  const dates: Date[] = []
  const today = new Date()
  
  let i = 1
  while (dates.length < 6) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const day = date.getDay()
    if (day === 0 || day === 2 || day === 3 || day === 6) {
      dates.push(date)
    }
    i++
  }
  return dates
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDateForDb(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatTimeDisplay(time: string): string {
  const [hours] = time.split(':')
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:00${ampm}`
}

export function AssessmentBooking({ onBack, onSuccess }: AssessmentBookingProps) {
  const stepOrder = ['branch', 'info', 'datetime', 'confirm'] as const
  type Step = typeof stepOrder[number]
  const [step, setStep] = useState<Step>('branch')
  const [branches, setBranches] = useState<BranchData[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    branch: '' as string
  })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const availableDates = getAvailableDates()

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('id, name, location')
          .order('name')
        
        if (error) throw error
        setBranches(data || [])
      } catch (err) {
        console.error('Failed to load branches:', err)
      } finally {
        setBranchesLoading(false)
      }
    }

    loadBranches()
  }, [])

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const phone = formData.phone.trim()
    const egyptPhoneRegex = /^01\d{9}$/
    if (!egyptPhoneRegex.test(phone)) {
      setError('Enter a valid Egyptian number (11 digits starting with 01')
      return
    }
    setError('')
    setStep('datetime')
  }

  const handleDateTimeSubmit = () => {
    if (selectedDate && selectedTime) {
      setStep('confirm')
    }
  }

  const handleFinalSubmit = async () => {
    if (!selectedDate || !selectedTime || !formData.branch) return
    
    setIsSubmitting(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('assessment_sessions')
        .insert({
          full_name: formData.fullName,
          phone: formData.phone,
          email: formData.email || null,
          branch: formData.branch,
          preferred_date: formatDateForDb(selectedDate),
          preferred_time: selectedTime,
          status: 'pending',
          lead_status: 'not_contacted'
        })

      if (insertError) throw insertError
      setSuccess(true)
    } catch (err) {
      setError('Failed to book assessment. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="h-screen bg-t1-black text-t1-cream overflow-hidden flex items-center justify-center p-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-cinzel font-bold">Assessment Booked!</h2>
            <p className="text-muted-foreground">We'll see you soon</p>
          </div>

          <div className="bg-secondary rounded-2xl p-6 border border-t1-red/20 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Branch</p>
              <p className="text-lg font-cinzel font-semibold text-t1-gold">
                {branches.find(b => b.id === formData.branch)?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="text-lg font-cinzel font-semibold">{selectedDate && formatDate(selectedDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Time</p>
              <p className="text-lg font-cinzel font-semibold">{selectedTime && formatTimeDisplay(selectedTime)}</p>
            </div>
            {formData.branch && branches.find(b => b.id === formData.branch)?.location && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => window.open(branches.find(b => b.id === formData.branch)?.location, '_blank')}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-emerald-400 hover:text-emerald-300 transition-all duration-200 font-semibold"
                >
                  <MapPin className="w-5 h-5" />
                  <span>View Location on Map</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We'll contact you to confirm your appointment.
            </p>
            <Button 
              onClick={onSuccess}
              className="w-full h-12 bg-gradient-t1 hover:opacity-90 text-white font-cinzel font-semibold rounded-xl glow-t1"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-t1-black text-t1-cream overflow-hidden flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t1-dark-red/20 via-transparent to-transparent" />
      
      <div className="relative flex-1 flex flex-col max-w-md mx-auto px-6 py-8 w-full">
        <button 
          onClick={() => {
            const currentIndex = stepOrder.indexOf(step)
            if (currentIndex <= 0) {
              onBack()
            } else {
              setStep(stepOrder[currentIndex - 1])
            }
          }}
          className="flex items-center gap-2 text-muted-foreground hover:text-t1-cream transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <div className="space-y-2 mb-8">
            <h1 className="text-2xl font-cinzel font-bold">Book Free Assessment</h1>
            <p className="text-muted-foreground">
              {step === 'branch' && 'Select your preferred branch'}
              {step === 'info' && 'Enter your contact information'}
              {step === 'datetime' && 'Choose your preferred time'}
              {step === 'confirm' && 'Confirm your booking'}
            </p>
          </div>

        <div className="flex gap-2 mb-8">
          {stepOrder.map((s, i) => (
            <div 
              key={s}
              className={`h-1 flex-1 rounded-full ${
                stepOrder.indexOf(step) >= i 
                  ? 'bg-gradient-t1' 
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {step === 'branch' && (
          <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-t1-cream flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-t1-red" />
                    Select Branch *
                  </Label>
                  {!formData.branch && <span className="text-xs text-muted-foreground">Pick one to continue</span>}
                </div>
                {branchesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-t1-red border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {branches.map((branch) => {
                      const isSelected = formData.branch === branch.id
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, branch: branch.id })
                            setStep('info')
                          }}
                          aria-pressed={isSelected}
                          className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 ${
                            isSelected
                              ? 'bg-gradient-to-br from-t1-red to-t1-dark-red text-white border-t1-gold shadow-[0_20px_60px_-30px_rgba(255,0,0,0.7)] ring-2 ring-t1-gold ring-offset-2 ring-offset-t1-black'
                              : 'bg-white/5 text-white/80 border-white/10 hover:border-t1-gold/40 hover:text-white shadow-[0_10px_40px_-30px_rgba(0,0,0,0.8)]'
                          } ${!isSelected ? 'hover:-translate-y-0.5' : ''}`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                          <div className="relative flex items-center gap-4">
                            <span className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${
                              isSelected
                                ? 'bg-black/30 border-white/30 text-white'
                                : 'bg-white/5 border-white/10 text-white/80 group-hover:border-t1-gold/50 group-hover:text-white'
                            }`}>
                              <MapPin className="w-6 h-6" />
                            </span>
                            <div className="flex flex-col">
                              <span className="text-[11px] uppercase tracking-[0.2em] text-t1-gold/80">Branch</span>
                              <span className="text-xl font-cinzel font-semibold leading-tight">{branch.name}</span>
                            </div>
                            <span className={`ml-auto text-sm font-semibold transition-colors ${
                              isSelected ? 'text-white' : 'text-white/60 group-hover:text-white'
                            }`}>
                              Choose
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
          </div>
        )}

        {step === 'info' && (
          <form onSubmit={handleInfoSubmit} className="space-y-6">
            {error && <p className="text-t1-red text-sm">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-t1-cream flex items-center gap-2">
                <User className="w-4 h-4 text-t1-red" />
                Full Name *
              </Label>
              <Input
                id="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name"
                className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-zinc-500 rounded-xl focus:ring-t1-red focus:border-t1-red"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-t1-cream flex items-center gap-2">
                <Phone className="w-4 h-4 text-t1-red" />
                Phone Number *
              </Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="01012345678"
                className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-zinc-500 rounded-xl focus:ring-t1-red focus:border-t1-red"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-t1-cream flex items-center gap-2">
                <Mail className="w-4 h-4 text-t1-red" />
                Email (Optional)
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-zinc-500 rounded-xl focus:ring-t1-red focus:border-t1-red"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 bg-gradient-t1 hover:opacity-90 text-white font-cinzel font-bold text-lg rounded-xl shadow-lg glow-t1"
            >
              Next
            </Button>
          </form>
        )}

        {step === 'datetime' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-t1-cream flex items-center gap-2">
                <Calendar className="w-4 h-4 text-t1-red" />
                Select Date
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {availableDates.map((date) => (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={`p-3 rounded-xl text-center transition-all ${
                      selectedDate?.toDateString() === date.toDateString()
                        ? 'bg-t1-red text-white ring-2 ring-t1-red ring-offset-2 ring-offset-t1-black'
                        : 'bg-secondary border border-t1-red/20 hover:bg-t1-red/10 text-t1-cream'
                    }`}
                  >
                    <div className="text-xs opacity-70">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="font-cinzel font-semibold">
                      {date.getDate()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-t1-cream flex items-center gap-2">
                <Clock className="w-4 h-4 text-t1-red" />
                Select Time
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_TIMES.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-3 rounded-xl text-center transition-all font-cinzel ${
                      selectedTime === time
                        ? 'bg-t1-red text-white ring-2 ring-t1-red ring-offset-2 ring-offset-t1-black'
                        : 'bg-secondary border border-t1-red/20 hover:bg-t1-red/10 text-t1-cream'
                    }`}
                  >
                    {formatTimeDisplay(time)}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleDateTimeSubmit}
              disabled={!selectedDate || !selectedTime}
              className="w-full h-14 bg-gradient-t1 hover:opacity-90 text-white font-cinzel font-bold text-lg rounded-xl shadow-lg glow-t1 disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="bg-secondary rounded-2xl p-6 border border-t1-red/20 space-y-4">
              <h3 className="font-cinzel font-semibold text-lg">Booking Summary</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{formData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{formData.phone}</span>
                </div>
                {formData.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{formData.email}</span>
                  </div>
                )}
                <div className="h-px bg-t1-red/20" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Branch
                  </span>
                  <span className="font-cinzel font-semibold text-t1-gold">{branches.find(b => b.id === formData.branch)?.name || formData.branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-cinzel">{selectedDate && formatDate(selectedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-cinzel">{selectedTime}</span>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-t1-red text-sm">{error}</p>
            )}

            <Button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="w-full h-14 bg-gradient-t1 hover:opacity-90 text-white font-cinzel font-bold text-lg rounded-xl shadow-lg glow-t1 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                'Confirm Booking'
              )}
            </Button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}