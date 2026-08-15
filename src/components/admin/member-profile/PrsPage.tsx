import { useState, useEffect } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { PrForm } from '../../shared/PrForm'
import { PrDisplay } from '../../shared/PrDisplay'
import { Button } from '../../ui/button'

type Member = {
  id: string
  member_id: string
  full_name: string
  phone: string
}

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

type Movement = {
  id: string
  name: string
  description: string | null
}

type PrsPageProps = {
  member: Member
  prs: PersonalRecord[]
  onPrsUpdate: () => void
  onBack: () => void
}

export function PrsPage({ member, prs: initialPrs, onPrsUpdate, onBack }: PrsPageProps) {
  const [prs, setPrs] = useState<PersonalRecord[]>(initialPrs)
  const [movements, setMovements] = useState<Movement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMovements()
  }, [])

  const loadMovements = async () => {
    try {
      const { data } = await supabase.from('movements').select('*').order('name')
      if (data) setMovements(data)
    } catch (err) {
      console.error('Failed to load movements:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrAdded = (newPr: PersonalRecord) => {
    setPrs(prev => [newPr, ...prev])
    setShowForm(false)
    onPrsUpdate()
  }

  const getTopPrByMovement = () => {
    const grouped: Record<string, PersonalRecord> = {}
    prs.forEach(pr => {
      const movementName = pr.movement?.name || 'Unknown'
      if (!grouped[movementName] || new Date(pr.recorded_at) > new Date(grouped[movementName].recorded_at)) {
        grouped[movementName] = pr
      }
    })
    return Object.values(grouped).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
  }

  return (
    <div className="min-h-screen bg-t1-black text-t1-cream pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-t1-cream hover:text-t1-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Profile
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-cinzel font-bold">Personal Records</h2>
            <p className="text-muted-foreground">{member.full_name}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-t1-red to-t1-dark-red text-white rounded-xl font-cinzel h-10 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add PR
          </Button>
        </div>

        {/* Add PR Form */}
        {showForm && !loading && (
          <PrForm
            memberId={member.id}
            movements={movements}
            onSubmit={handlePrAdded}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* PRs List - Top PR per movement */}
        {prs.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-cinzel font-semibold text-sm text-t1-gold">Top PR Per Movement</h3>
            {getTopPrByMovement().map(pr => (
              <PrDisplay key={pr.id} pr={pr} showNotes={true} />
            ))}

            {/* All PRs Section */}
            {prs.length > getTopPrByMovement().length && (
              <div className="mt-8 pt-6 border-t border-t1-red/10">
                <h3 className="font-cinzel font-semibold text-sm text-t1-gold mb-3">All Records</h3>
                <div className="space-y-3">
                  {prs.map(pr => (
                    <PrDisplay key={pr.id} pr={pr} showNotes={true} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-secondary rounded-2xl p-12 border border-t1-red/10 text-center">
            <p className="text-muted-foreground mb-4">No personal records yet</p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-t1-red to-t1-dark-red text-white rounded-xl font-cinzel h-10 px-4"
            >
              Add First PR
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
