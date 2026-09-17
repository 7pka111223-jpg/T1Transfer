import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, RefreshCw, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AdminData } from './AdminLogin'

type Branch = { id: string; name: string }

const ROTATION_SECONDS = 60

type CheckInQrScreenProps = {
  admin: AdminData
  onBack: () => void
}

export function CheckInQrScreen({ admin, onBack }: CheckInQrScreenProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoaded, setBranchesLoaded] = useState(false)
  const [branchId, setBranchId] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(ROTATION_SECONDS)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generatingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('branches')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (cancelled) return
        const list = (data as Branch[]) || []
        setBranches(list)
        if (list.length > 0) setBranchId((current) => current || list[0].id)
        setBranchesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const generateToken = useCallback(async () => {
    if (generatingRef.current) return
    generatingRef.current = true
    setIsGenerating(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_checkin_token' as any, {
        p_branch_id: branchId || null,
        p_admin_id: admin.id,
        p_ttl_seconds: ROTATION_SECONDS
      })
      if (rpcError) throw rpcError
      const result = data as { token: string; expires_at: string } | null
      if (!result?.token) throw new Error('No code was returned')
      setToken(result.token)
      setExpiresAt(new Date(result.expires_at).getTime())
      setSecondsLeft(ROTATION_SECONDS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a code')
    } finally {
      setIsGenerating(false)
      generatingRef.current = false
    }
  }, [branchId, admin.id])

  useEffect(() => {
    if (!branchesLoaded) return
    generateToken()
  }, [branchesLoaded, generateToken])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!expiresAt) return
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) generateToken()
    }, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt, generateToken])

  const selectedBranch = branches.find((b) => b.id === branchId)

  return (
    <div className="max-w-md mx-auto px-6 py-6 pb-32">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-t1-cream" />
        </button>
        <div>
          <h2 className="text-xl font-cinzel font-bold text-t1-cream">Check-in QR</h2>
          <p className="text-xs text-muted-foreground">Display this screen at the gym entrance</p>
        </div>
      </div>

      {branches.length > 1 && (
        <div className="mb-5">
          <label className="block text-xs font-cinzel text-muted-foreground mb-2">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full h-11 px-3 rounded-xl bg-secondary border border-t1-red/20 text-t1-cream text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-t1-black border border-t1-red/30 rounded-2xl p-6 flex flex-col items-center">
        <div className="bg-white rounded-2xl p-4">
          {token ? (
            <QRCodeSVG value={token} size={232} bgColor="#ffffff" fgColor="#0a0a0a" level="M" />
          ) : (
            <div className="w-[232px] h-[232px] flex items-center justify-center">
              {error ? (
                <span className="text-sm text-red-500 px-4 text-center">{error}</span>
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
              )}
            </div>
          )}
        </div>

        <div className="w-full mt-5">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-t1-red to-t1-gold transition-[width] duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / ROTATION_SECONDS) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {token ? `New code in ${secondsLeft}s` : error ? 'Code unavailable' : 'Generating code…'}
          </p>
        </div>

        <button
          onClick={generateToken}
          disabled={isGenerating}
          className="mt-5 w-full h-11 rounded-xl bg-gradient-to-r from-t1-red to-t1-dark-red text-white font-cinzel text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          New code now
        </button>

        {selectedBranch && (
          <p className="mt-4 text-xs text-muted-foreground text-center">{selectedBranch.name}</p>
        )}
      </div>

      <div className="mt-5 flex items-start gap-3 bg-secondary border border-t1-red/20 rounded-xl p-4">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          The code refreshes every {ROTATION_SECONDS} seconds and is validated on the server, so a
          screenshot stops working once it expires.
        </p>
      </div>
    </div>
  )
}
