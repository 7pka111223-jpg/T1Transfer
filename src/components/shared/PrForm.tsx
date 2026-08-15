import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { supabase } from '../../lib/supabase'

type Movement = {
  id: string
  name: string
  description: string | null
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
}

type PrFormProps = {
  memberId: string
  movements: Movement[]
  onSubmit: (pr: PersonalRecord) => void
  onCancel: () => void
}

export function PrForm({ memberId, movements, onSubmit, onCancel }: PrFormProps) {
  const [formData, setFormData] = useState({
    movement_id: '',
    recordType: 'max_reps' as 'weighted' | 'max_reps',
    value: '',
    weightUsed: '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.movement_id || !formData.value) {
      setError('Movement and value are required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const insertData: any = {
        member_id: memberId,
        movement_id: formData.movement_id,
        record_type: formData.recordType,
        value: parseFloat(formData.value),
        notes: formData.notes || null,
        recorded_at: new Date().toISOString()
      }

      if (formData.recordType === 'weighted' && formData.weightUsed) {
        insertData.weight_used = parseFloat(formData.weightUsed)
      }

      const { data, error: insertError } = await supabase
        .from('personal_records')
        .insert(insertData)
        .select('*')
        .single()

      if (insertError) throw insertError
      onSubmit(data)
      setFormData({ movement_id: '', recordType: 'max_reps', value: '', weightUsed: '', notes: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add PR')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-secondary rounded-2xl p-5 border border-t1-red/30 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-cinzel font-semibold">Add Personal Record</h3>
        <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-3">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-t1-cream text-sm">Movement *</Label>
          <select
            value={formData.movement_id}
            onChange={(e) => setFormData(prev => ({ ...prev, movement_id: e.target.value }))}
            className="w-full h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-3 text-sm"
            required
          >
            <option value="">Select a movement</option>
            {movements.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-t1-cream text-sm">PR Type *</Label>
          <select
            value={formData.recordType}
            onChange={(e) => setFormData(prev => ({ ...prev, recordType: e.target.value as 'weighted' | 'max_reps' }))}
            className="w-full h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-3 text-sm"
            required
          >
            <option value="max_reps">Max Reps</option>
            <option value="weighted">Weighted (kg)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-t1-cream text-sm">
            {formData.recordType === 'weighted' ? 'Weight (kg) *' : 'Reps *'}
          </Label>
          <Input
            type="number"
            step={formData.recordType === 'weighted' ? '0.5' : '1'}
            value={formData.value}
            onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
            placeholder={formData.recordType === 'weighted' ? '0.0' : '0'}
            className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
            required
          />
        </div>

        {formData.recordType === 'weighted' && (
          <div className="space-y-2">
            <Label className="text-t1-cream text-sm">Weight Used (kg)</Label>
            <Input
              type="number"
              step="0.5"
              value={formData.weightUsed}
              onChange={(e) => setFormData(prev => ({ ...prev, weightUsed: e.target.value }))}
              placeholder="e.g., 20.5"
              className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-t1-cream text-sm">Notes (optional)</Label>
          <Input
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="e.g., new personal best"
            className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-t1-red to-t1-dark-red text-white h-10 rounded-lg font-cinzel"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add PR'
            )}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1 bg-transparent border-t1-red/30 text-t1-cream h-10 rounded-lg"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
