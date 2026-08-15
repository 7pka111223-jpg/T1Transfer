import { useState } from 'react'
import { ArrowLeft, CreditCard, Lock, CheckCircle, Loader2, Eye, EyeOff, Phone, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { supabase } from '../lib/supabase'

type AccountActivationProps = {
  onBack: () => void
  onSuccess: () => void
}

export function AccountActivation({ onBack, onSuccess }: AccountActivationProps) {
  const [step, setStep] = useState<'verify' | 'pin'>('verify')
  const [memberId, setMemberId] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [memberUuid, setMemberUuid] = useState('')

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { data, error: fetchError } = await supabase
        .from('members')
        .select('id, status, phone')
        .eq('member_id', memberId.toUpperCase())
        .single()

      if (fetchError || !data) {
        setError('Member ID not found')
        return
      }

      if (data.status !== 'pending') {
        setError('Account is already activated')
        return
      }

      const cleanPhone = phone.replace(/\D/g, '')
      const storedPhone = data.phone.replace(/\D/g, '')
      
      if (!storedPhone.includes(cleanPhone) && !cleanPhone.includes(storedPhone)) {
        setError('Phone number does not match our records')
        return
      }

      setMemberUuid(data.id)
      setStep('pin')
    } catch (err) {
      setError('Verification failed. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setError('PIN must be exactly 4 digits')
      return
    }

    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setIsSubmitting(true)

    try {
      const { error: updateError } = await supabase
        .from('members')
        .update({ pin: pin, status: 'active' })
        .eq('id', memberUuid)

      if (updateError) throw updateError
      setSuccess(true)
    } catch (err) {
      setError('Failed to set PIN. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-t1-black text-t1-cream flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-cinzel font-bold">Account Activated!</h2>
            <p className="text-muted-foreground">You can now login with your Member ID and PIN</p>
          </div>

          <Button 
            onClick={onSuccess}
            className="w-full h-12 bg-gradient-t1 hover:opacity-90 text-white font-cinzel font-semibold rounded-xl glow-t1"
          >
            Go to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-t1-black text-t1-cream flex flex-col justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t1-dark-red/20 via-transparent to-transparent" />
      
      <div className="relative max-w-md mx-auto px-6 py-8 pb-12 w-full">
        <button 
          onClick={step === 'verify' ? onBack : () => setStep('verify')}
          className="flex items-center gap-2 text-muted-foreground hover:text-t1-cream transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="space-y-2 mb-8">
          <h1 className="text-2xl font-cinzel font-bold">Activate Account</h1>
          <p className="text-muted-foreground">
            {step === 'verify' ? 'Verify your identity' : 'Set your PIN'}
          </p>
        </div>

        <div className="flex gap-2 mb-8">
          <div className={`h-1 flex-1 rounded-full ${step === 'verify' || step === 'pin' ? 'bg-gradient-t1' : 'bg-white/10'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'pin' ? 'bg-gradient-t1' : 'bg-white/10'}`} />
        </div>

        {step === 'verify' && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="memberId" className="text-t1-cream flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-t1-red" />
                Member ID *
              </Label>
              <Input
                id="memberId"
                type="text"
                required
                value={memberId}
                onChange={(e) => setMemberId(e.target.value.toUpperCase())}
                placeholder="T1123"
                className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-zinc-500 rounded-xl uppercase focus:ring-t1-red focus:border-t1-red"
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-zinc-500 rounded-xl focus:ring-t1-red focus:border-t1-red"
              />
              <p className="text-xs text-muted-foreground">Enter the phone number you registered with</p>
            </div>

            {error && (
              <p className="text-t1-red text-sm">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full h-16 overflow-hidden bg-gradient-to-r from-t1-red via-t1-dark-red to-t1-red text-white font-cinzel font-bold text-lg rounded-2xl shadow-lg shadow-t1-red/30 hover:shadow-xl hover:shadow-t1-red/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shine" />
              {isSubmitting ? (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Verify
                  <ChevronRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>
        )}

        {step === 'pin' && (
          <form onSubmit={handleSetPin} className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
              <p className="text-emerald-400 text-sm">Identity verified! Now set your PIN.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-t1-cream flex items-center gap-2">
                <Lock className="w-4 h-4 text-t1-red" />
                Create 4-Digit PIN *
              </Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  required
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-muted-foreground rounded-xl pr-12 focus:ring-t1-red focus:border-t1-red"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-t1-cream"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin" className="text-t1-cream flex items-center gap-2">
                <Lock className="w-4 h-4 text-t1-red" />
                Confirm PIN *
              </Label>
              <Input
                id="confirmPin"
                type={showPin ? 'text' : 'password'}
                required
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-muted-foreground rounded-xl focus:ring-t1-red focus:border-t1-red"
              />
            </div>

            {error && (
              <p className="text-t1-red text-sm">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full h-16 overflow-hidden bg-gradient-to-r from-t1-red via-t1-dark-red to-t1-red text-white font-cinzel font-bold text-lg rounded-2xl shadow-lg shadow-t1-red/30 hover:shadow-xl hover:shadow-t1-red/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shine" />
              {isSubmitting ? (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Activating...
                </span>
              ) : (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Activate Account
                  <ChevronRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}