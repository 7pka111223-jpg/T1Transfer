import { TrendingUp } from 'lucide-react'

type PersonalRecord = {
  id: string
  member_id: string
  movement_id: string
  record_type: 'weighted' | 'max_reps'
  value: number
  weight_used: number | null
  recorded_at: string
  notes: string | null
  movement?: { name: string }
}

type PrDisplayProps = {
  pr: PersonalRecord
  showNotes?: boolean
}

export function PrDisplay({ pr, showNotes = true }: PrDisplayProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="bg-secondary rounded-xl p-4 border border-t1-red/10 hover:border-t1-red/30 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">{pr.movement?.name || 'Unknown Movement'}</p>
            <p className="text-xs text-muted-foreground">{formatDate(pr.recorded_at)}</p>
            {showNotes && pr.notes && <p className="text-xs text-t1-gold mt-1">{pr.notes}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-cinzel font-bold text-amber-400">
            {pr.value}{pr.record_type === 'weighted' && pr.weight_used ? ` @ ${pr.weight_used}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {pr.record_type === 'weighted' ? 'kg' : 'reps'}
          </p>
        </div>
      </div>
    </div>
  )
}
