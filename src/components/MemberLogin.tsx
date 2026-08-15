import { useState, useEffect, useLayoutEffect } from 'react'
import { ArrowLeft, CreditCard, Lock, Loader2, Eye, EyeOff, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { supabase } from '../lib/supabase'

type MemberLoginProps = {
  onBack: () => void
  onLogin: (member: MemberData) => void
  onActivate: () => void
}

export type MemberData = {
  id: string
  member_id: string
  full_name: string
  phone: string
  email: string | null
  date_of_birth: string | null
  gender: string | null
  status: string
  level: string
  profile_image_url: string | null
  medical_notes: string | null
  emergency_contact: string | null
  loyalty_points: number | null
  branch_id: string | null
}

export function MemberLogin({ onBack, onLogin, onActivate }: MemberLoginProps) {
  const [memberId, setMemberId] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const { data, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .eq('member_id', memberId.toUpperCase())
        .single()

      if (fetchError || !data) {
        setError('Member ID not found')
        return
      }

      if (data.status === 'pending') {
        setError('Account not activated. Please activate your account first.')
        return
      }

      if (data.pin !== pin) {
        setError('Invalid PIN')
        return
      }

      onLogin(data)
    } catch (err) {
      setError('Login failed. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-t1-black text-t1-cream flex flex-col justify-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t1-dark-red/20 via-transparent to-transparent" />
      
      <div className="relative max-w-md mx-auto px-6 py-8 pb-12 w-full">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-t1-cream transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="space-y-2 mb-8">
          <h1 className="text-2xl font-cinzel font-bold">Member Login</h1>
          <p className="text-muted-foreground">Access your Triple One account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
              className="h-12 bg-secondary border-t1-red/20 text-t1-cream placeholder:text-muted-foreground rounded-xl uppercase focus:ring-t1-red focus:border-t1-red"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin" className="text-t1-cream flex items-center gap-2">
              <Lock className="w-4 h-4 text-t1-red" />
              4-Digit PIN *
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
                Logging in...
              </span>
            ) : (
              <span className="relative z-10 flex items-center justify-center gap-2">
                Login
                <ChevronRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm mb-3">Don't have a PIN yet?</p>
          <Button
            variant="outline"
            onClick={onActivate}
            className="bg-white/5 border-t1-red/30 hover:bg-t1-red/10 text-t1-cream rounded-xl font-cinzel"
          >
            Activate Account
          </Button>
        </div>
      </div>
    </div>
  )
}