import { useState, useEffect } from 'react'
import { TrendingUp, Plus, Trophy, Weight, Repeat, ChevronDown, X, Target, Activity } from 'lucide-react'
import { Button } from './ui/button'
import { supabase } from '../lib/supabase'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Movement = {
  id: string
  name: string
  description: string
}

type PersonalRecord = {
  id: string
  movement_id: string
  record_type: 'weighted' | 'max_reps'
  value: number
  weight_used: number | null
  notes: string | null
  recorded_at: string
  movement?: Movement
}

type WorkoutTrackingProps = {
  memberId: string
}

export function WorkoutTracking({ memberId }: WorkoutTrackingProps) {
  const [movements, setMovements] = useState<Movement[]>([])
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<string>('')
  const [recordType, setRecordType] = useState<'weighted' | 'max_reps'>('max_reps')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<'records' | 'charts'>('records')
  const [selectedChartMovement, setSelectedChartMovement] = useState<string>('')
  const [chartType, setChartType] = useState<'weighted' | 'max_reps'>('max_reps')

  useEffect(() => {
    loadData()
  }, [memberId])

  const loadData = async () => {
    const [movementsRes, recordsRes] = await Promise.all([
      supabase
        .from('movements')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('personal_records')
        .select('*, movement:movements(id, name, description)')
        .eq('member_id', memberId)
        .order('recorded_at', { ascending: false })
    ])

    if (movementsRes.data) {
      setMovements(movementsRes.data)
      if (movementsRes.data.length > 0 && !selectedChartMovement) {
        setSelectedChartMovement(movementsRes.data[0].id)
      }
    }
    if (recordsRes.data) setPersonalRecords(recordsRes.data)
  }

  const handleAddRecord = async () => {
    if (!selectedMovement || !value) return
    setLoading(true)

    const { error } = await supabase
      .from('personal_records')
      .insert({
        member_id: memberId,
        movement_id: selectedMovement,
        record_type: recordType,
        value: parseFloat(value),
        notes: notes || null,
        recorded_at: new Date().toISOString()
      })

    if (!error) {
      setShowAddModal(false)
      setSelectedMovement('')
      setValue('')
      setNotes('')
      loadData()
    }
    setLoading(false)
  }

  const getBestRecord = (movementId: string, type: 'weighted' | 'max_reps') => {
    const records = personalRecords.filter(
      r => r.movement_id === movementId && r.record_type === type
    )
    if (records.length === 0) return null
    return records.reduce((best, curr) => curr.value > best.value ? curr : best)
  }

  const getChartData = (movementId: string, type: 'weighted' | 'max_reps') => {
    const records = personalRecords
      .filter(r => r.movement_id === movementId && r.record_type === type)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .slice(-10)
    
    return records.map(record => ({
      date: new Date(record.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: new Date(record.recorded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      value: record.value,
      weight: record.weight_used,
      notes: record.notes,
      id: record.id
    }))
  }

  const chartData = selectedChartMovement ? getChartData(selectedChartMovement, chartType) : []
  const maxValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 0
  const minValue = chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) : 0
  const peakPerformance = chartData.length > 0 ? chartData.reduce((max, curr) => curr.value > max.value ? curr : max) : null

  // Custom Glassmorphic Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      // Try to get value and date from payload[0].payload, fallback to payload[0].value
      const data = payload[0].payload || {};
      const value = data.value ?? payload[0].value;
      const date = data.fullDate ?? data.date ?? '';
      return (
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-t1-gold/30 rounded-2xl p-4 shadow-2xl shadow-t1-gold/20 min-w-[160px]">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${chartType === 'weighted' ? 'bg-t1-gold' : 'bg-t1-red'}`} />
            <p className="text-xs font-semibold text-t1-cream/70">{date}</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-cinzel font-bold text-t1-cream">
              {value !== undefined ? value : '--'} <span className="text-sm">{chartType === 'weighted' ? 'kg' : 'reps'}</span>
            </p>
            {data.weight && chartType === 'weighted' && (
              <p className="text-xs text-t1-gold/80 flex items-center gap-1">
                <Weight className="w-3 h-3" /> Weight Used: {data.weight}kg
              </p>
            )}
            {data.notes && (
              <p className="text-xs text-muted-foreground italic mt-2 pt-2 border-t border-t1-gold/20">
                {data.notes}
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-cinzel font-black text-gradient-t1 tracking-tight drop-shadow">Workout Tracking</h2>
        <Button
          onClick={() => setShowAddModal(true)}
          className="relative bg-gradient-t1 text-white rounded-xl font-cinzel text-sm h-8 px-4 shadow hover:scale-[1.04] active:scale-100 transition-all border border-t1-gold animate-pulse hover:animate-none"
          style={{
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.6), 0 0 40px rgba(212, 175, 55, 0.3)'
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Log PR
        </Button>
      </div>

      <div className="flex gap-2 p-1 bg-t1-black/60 rounded-2xl border border-t1-red/20 shadow">
        <button
          onClick={() => setActiveView('records')}
          className={`flex-1 py-3 px-3 rounded-xl text-base font-cinzel font-bold transition-all tracking-wide shadow-sm
            ${activeView === 'records' ? 'bg-t1-gold text-t1-black scale-[1.03]' : 'text-t1-gold hover:text-t1-cream'}`}
        >
          <Trophy className="w-5 h-5 inline mr-2" /> Records
        </button>
        <button
          onClick={() => setActiveView('charts')}
          className={`flex-1 py-3 px-3 rounded-xl text-base font-cinzel font-bold transition-all tracking-wide shadow-sm
            ${activeView === 'charts' ? 'bg-t1-gold text-t1-black scale-[1.03]' : 'text-t1-gold hover:text-t1-cream'}`}
        >
          <TrendingUp className="w-5 h-5 inline mr-2" /> Charts
        </button>
      </div>

      {activeView === 'records' && (
        <div className="space-y-4">
          {movements.map(movement => {
            const weightedBest = getBestRecord(movement.id, 'weighted')
            const repsBest = getBestRecord(movement.id, 'max_reps')
            
            return (
              <div key={movement.id} className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-t1 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-cinzel font-bold">{movement.name}</h3>
                    <p className="text-xs text-muted-foreground">{movement.description}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-t1-black/50 rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Weight className="w-3 h-3 text-t1-gold" />
                      <span className="text-xs text-muted-foreground">Weighted</span>
                    </div>
                    {weightedBest ? (
                      <div>
                        <p className="text-xl font-cinzel font-bold text-t1-gold">
                          {weightedBest.value} <span className="text-sm">kg</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No record</p>
                    )}
                  </div>
                  <div className="bg-t1-black/50 rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Repeat className="w-3 h-3 text-t1-red" />
                      <span className="text-xs text-muted-foreground">Reps</span>
                    </div>
                    {repsBest ? (
                      <p className="text-xl font-cinzel font-bold text-t1-red">
                        {repsBest.value} <span className="text-sm">reps</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No record</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          
          {movements.length === 0 && (
            <div className="bg-secondary rounded-2xl p-6 border border-t1-red/10 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No movements available</p>
            </div>
          )}
        </div>
      )}

      {activeView === 'charts' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <select
                value={selectedChartMovement}
                onChange={(e) => setSelectedChartMovement(e.target.value)}
                className="w-full h-10 pl-3 pr-8 bg-secondary border border-t1-red/20 rounded-xl text-t1-cream appearance-none cursor-pointer focus:outline-none focus:border-t1-red/50"
              >
                {movements.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'weighted' | 'max_reps')}
                className="h-10 pl-3 pr-8 bg-secondary border border-t1-red/20 rounded-xl text-t1-cream appearance-none cursor-pointer focus:outline-none focus:border-t1-red/50"
              >
                <option value="max_reps">Max Reps</option>
                <option value="weighted">Weighted</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-cinzel font-semibold text-lg">
                  {chartType === 'weighted' ? 'Weighted Progress' : 'Max Reps Progress'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 10 recorded sessions
                </p>
              </div>
              {peakPerformance && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <Target className="w-3 h-3" /> Peak Performance
                  </p>
                  <p className="text-xl font-cinzel font-bold bg-gradient-t1 bg-clip-text text-transparent">
                    {peakPerformance.value} {chartType === 'weighted' ? 'kg' : 'reps'}
                  </p>
                </div>
              )}
            </div>
            
            {chartData.length > 0 ? (
              <div className="space-y-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorWeighted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorReps" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0.05}/>
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="rgba(212, 175, 55, 0.1)" 
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9CA3AF"
                        tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(212, 175, 55, 0.2)' }}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(212, 175, 55, 0.2)' }}
                        domain={['dataMin - 5', 'dataMax + 5']}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartType === 'weighted' ? '#D4AF37' : '#DC2626', strokeWidth: 2, strokeDasharray: '5 5' }} />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={chartType === 'weighted' ? '#D4AF37' : '#DC2626'}
                        strokeWidth={3}
                        fill={chartType === 'weighted' ? 'url(#colorWeighted)' : 'url(#colorReps)'}
                        fillOpacity={1}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                        dot={{ 
                          r: 5, 
                          fill: chartType === 'weighted' ? '#D4AF37' : '#DC2626',
                          strokeWidth: 2,
                          stroke: '#0A0A0A',
                          filter: 'url(#glow)'
                        }}
                        activeDot={{ 
                          r: 8, 
                          fill: chartType === 'weighted' ? '#D4AF37' : '#DC2626',
                          stroke: '#FAF0DC',
                          strokeWidth: 3,
                          filter: 'url(#glow)',
                          style: { cursor: 'pointer' }
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-t1-red/10">
                  <div className="bg-t1-black/50 rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Trophy className="w-3 h-3 text-t1-gold" />
                      <span className="text-xs text-muted-foreground">Best</span>
                    </div>
                    <p className="text-lg font-cinzel font-bold text-t1-gold">
                      {maxValue}
                    </p>
                  </div>
                  <div className="bg-t1-black/50 rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Activity className="w-3 h-3 text-t1-red" />
                      <span className="text-xs text-muted-foreground">Latest</span>
                    </div>
                    <p className="text-lg font-cinzel font-bold text-t1-red">
                      {chartData[chartData.length - 1].value}
                    </p>
                  </div>
                  <div className="bg-t1-black/50 rounded-xl p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <TrendingUp className="w-3 h-3 text-t1-cream" />
                      <span className="text-xs text-muted-foreground">Entries</span>
                    </div>
                    <p className="text-lg font-cinzel font-bold text-t1-cream">
                      {chartData.length}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <p className="text-muted-foreground font-semibold">No data for this movement</p>
                  <p className="text-xs text-muted-foreground mt-1">Log your first PR to see progress</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-t1-black border border-t1-red/30 rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-cinzel font-bold text-lg">Log Personal Record</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-t1-cream">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Movement</label>
                <div className="relative">
                  <select
                    value={selectedMovement}
                    onChange={(e) => setSelectedMovement(e.target.value)}
                    className="w-full h-12 pl-4 pr-10 bg-secondary border border-t1-red/20 rounded-xl text-t1-cream appearance-none cursor-pointer focus:outline-none focus:border-t1-red/50"
                  >
                    <option value="">Select movement</option>
                    {movements.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Record Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRecordType('max_reps')}
                    className={`h-12 rounded-xl border transition-all ${
                      recordType === 'max_reps' 
                        ? 'bg-t1-red/20 border-t1-red text-t1-red' 
                        : 'border-t1-red/20 text-muted-foreground hover:border-t1-red/40'
                    }`}
                  >
                    <Repeat className="w-4 h-4 inline mr-1" /> Max Reps
                  </button>
                  <button
                    onClick={() => setRecordType('weighted')}
                    className={`h-12 rounded-xl border transition-all ${
                      recordType === 'weighted' 
                        ? 'bg-t1-gold/20 border-t1-gold text-t1-gold' 
                        : 'border-t1-red/20 text-muted-foreground hover:border-t1-red/40'
                    }`}
                  >
                    <Weight className="w-4 h-4 inline mr-1" /> Weighted
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  {recordType === 'weighted' ? 'Weight (kg)' : 'Max Reps'}
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className="w-full h-12 px-4 bg-secondary border border-t1-red/20 rounded-xl text-t1-cream focus:outline-none focus:border-t1-red/50"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this record..."
                  rows={2}
                  className="w-full px-4 py-3 bg-secondary border border-t1-red/20 rounded-xl text-t1-cream focus:outline-none focus:border-t1-red/50 resize-none"
                />
              </div>
            </div>

            <Button
              onClick={handleAddRecord}
              disabled={!selectedMovement || !value || loading}
              className="w-full h-12 bg-gradient-t1 text-white rounded-xl font-cinzel disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}