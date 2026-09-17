import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Printer, Loader2, QrCode } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Branch = { id: string; name: string }

type CheckInQrScreenProps = {
  onBack: () => void
}

export function CheckInQrScreen({ onBack }: CheckInQrScreenProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [loaded, setLoaded] = useState(false)

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
        if (list.length > 0) setBranchId(list[0].id)
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedBranch = branches.find((b) => b.id === branchId)
  const checkInUrl = branchId ? `${window.location.origin}/?branch=${branchId}` : ''

  return (
    <div className="max-w-md mx-auto px-6 py-6 pb-32">
      <div className="no-print">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-t1-cream" />
          </button>
          <div>
            <h2 className="text-xl font-cinzel font-bold text-t1-cream">Check-in QR</h2>
            <p className="text-xs text-muted-foreground">Print it and hang it at the entrance</p>
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
      </div>

      <div className="print-qr bg-white rounded-2xl px-8 py-10 text-center">
        <p className="font-cinzel font-bold text-2xl tracking-wide text-zinc-900">TRIPLE ONE</p>
        <p className="text-sm text-zinc-500 mt-1 mb-6">Scan to check in</p>

        {checkInUrl ? (
          <div className="inline-block">
            <QRCodeSVG value={checkInUrl} size={260} bgColor="#ffffff" fgColor="#0a0a0a" level="M" />
          </div>
        ) : (
          <div className="w-[260px] h-[260px] mx-auto flex items-center justify-center">
            {loaded ? (
              <span className="text-sm text-zinc-500 px-6">No branches available</span>
            ) : (
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            )}
          </div>
        )}

        {selectedBranch && (
          <p className="mt-6 text-lg font-cinzel font-semibold text-zinc-900">{selectedBranch.name}</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          Open the Triple One app and scan this code, or scan it with your phone camera
        </p>
      </div>

      <div className="no-print">
        <button
          onClick={() => window.print()}
          disabled={!checkInUrl}
          className="mt-5 w-full h-11 rounded-xl bg-gradient-to-r from-t1-red to-t1-dark-red text-white font-cinzel text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform"
        >
          <Printer className="w-4 h-4" />
          Print this code
        </button>

        <div className="mt-5 flex items-start gap-3 bg-secondary border border-t1-red/20 rounded-xl p-4">
          <QrCode className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            This code is permanent for {selectedBranch ? selectedBranch.name : 'the selected branch'} — it
            never changes, so you only need to print it once.
          </p>
        </div>
      </div>
    </div>
  )
}
