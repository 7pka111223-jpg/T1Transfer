import { useState } from 'react'
import { ArrowLeft, Shield, Lock, User } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { supabase } from '../lib/supabase'

export type AdminData = {
  id: string
  full_name: string
  email: string
}

type AdminLoginProps = {
  onBack: () => void
  onLogin: (admin: AdminData) => void
}

export function AdminLogin({ onBack, onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { data, error: queryError } = await supabase
        .from('admins')
        .select('id, username, full_name, email, pin')
        .ilike('username', username.trim())
        .single()

      if (queryError || !data || data.pin !== pin) {
        setError('Invalid username or PIN')
        setIsLoading(false)
        return
      }

      onLogin({
        id: data.id,
        full_name: data.full_name || data.username,
        email: data.email || ''
      })
    } catch (err) {
      console.error(err)
      setError('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-t1-black text-t1-cream">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t1-dark-red/20 via-transparent to-transparent" />
      
      <div className="relative max-w-md mx-auto px-6 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-t1-cream transition-colors mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-t1-red/30 to-t1-dark-red/30 flex items-center justify-center mb-4 border border-t1-red/20">
            <Shield className="w-10 h-10 text-t1-red" />
          </div>
          <h1 className="text-2xl font-cinzel font-bold">Admin Login</h1>
          <p className="text-sm text-muted-foreground mt-2">Access the admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-t1-cream flex items-center gap-2">
              <User className="w-4 h-4" />
              Username
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="h-14 bg-secondary border-t1-red/20 text-t1-cream rounded-2xl text-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-t1-cream flex items-center gap-2">
              <Lock className="w-4 h-4" />
              PIN
            </Label>
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4-digit PIN"
              maxLength={4}
              className="h-14 bg-secondary border-t1-red/20 text-t1-cream rounded-2xl text-lg text-center tracking-[0.5em]"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || username.length === 0 || pin.length < 4}
            className="w-full h-14 bg-gradient-t1 hover:opacity-90 text-white font-cinzel font-bold text-lg rounded-2xl shadow-xl glow-t1"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  )
}