import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Check, Plus, Trash2, Users, Calendar as CalendarIcon, ChevronLeft, Download, AlertTriangle } from 'lucide-react'

type SharedSubscriptionsProps = {
  admin: { id: string; full_name: string; email: string }
}

type Package = { id: string; name: string; type: string; sessions_count: number | null; is_active: boolean }

type SharedSub = {
  id: string  // Format: SSxxxx (e.g., SS0001, SS0002)
  package_id: string
  sessions_total: number
  sessions_remaining: number
  start_date: string
  end_date: string
  status: 'active' | 'expired' | 'archived'
  created_by_admin_id: string | null
  created_at?: string
}

type Member = { id: string; member_id: string; full_name: string }

export function SharedSubscriptions({ admin }: SharedSubscriptionsProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [packages, setPackages] = useState<Package[]>([])
  const [sharedSubs, setSharedSubs] = useState<SharedSub[]>([])
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [members, setMembers] = useState<Record<string, Member[]>>({})
  const [usageByMember, setUsageByMember] = useState<Record<string, Record<string, number>>>({})

  const selectedSub = useMemo(() => sharedSubs.find(s => s.id === selectedSubId) || null, [sharedSubs, selectedSubId])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [pkgRes, subsRes] = await Promise.all([
        supabase.from('subscription_packages').select('id, name, type, sessions_count, is_active').eq('type', 'session').eq('is_shareable', true).eq('is_active', true),
        supabase.from('shared_subscriptions' as any).select('*').order('created_at', { ascending: false })
      ])

      if (pkgRes.error) throw pkgRes.error
      if (subsRes.error) {
        // Table may not exist yet; show gentle message
        setError('Shared subscriptions tables are not yet provisioned. Apply DB changes and refresh.')
        setPackages(pkgRes.data || [])
        setSharedSubs([])
        setLoading(false)
        return
      }

      setPackages(pkgRes.data || [])
      setSharedSubs(subsRes.data || [])

      // Load members per subscription (if mapping table exists)
      const membersMap: Record<string, Member[]> = {}
      const usageMap: Record<string, Record<string, number>> = {}

      for (const sub of subsRes.data || []) {
        const memRes = await supabase
          .from('shared_subscription_members' as any)
          .select('member:members(id, member_id, full_name)')
          .eq('shared_subscription_id', sub.id)
        if (!memRes.error && memRes.data) {
          membersMap[sub.id] = memRes.data.map((r: any) => r.member)
        } else {
          membersMap[sub.id] = []
        }

        // Usage from ledger if exists
        const usageRes = await supabase
          .from('session_deductions' as any)
          .select('member_id, action')
          .eq('source_type', 'shared')
          .eq('source_id', sub.id)
        const agg: Record<string, number> = {}
        if (!usageRes.error && usageRes.data) {
          for (const row of usageRes.data as any[]) {
            const delta = row.action === 'deduct' ? 1 : -1
            agg[row.member_id] = (agg[row.member_id] || 0) + delta
          }
        }
        usageMap[sub.id] = agg
      }

      setMembers(membersMap)
      setUsageByMember(usageMap)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleCreate = async (pkgId: string) => {
    const pkg = packages.find(p => p.id === pkgId)
    if (!pkg || !pkg.sessions_count) return

    setError('')
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 90)
    const { error } = await supabase.from('shared_subscriptions' as any).insert({
      package_id: pkg.id,
      sessions_total: pkg.sessions_count,
      sessions_remaining: pkg.sessions_count,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      status: 'active',
      created_by_admin_id: admin.id
    })
    if (error) {
      setError(error.message)
    } else {
      await loadAll()
    }
  }

  const [addMemberInput, setAddMemberInput] = useState('')
  const [showPersonalSubWarning, setShowPersonalSubWarning] = useState(false)
  const [pendingMemberData, setPendingMemberData] = useState<{id: string, member_id: string, full_name: string} | null>(null)
  const [personalSubDetails, setPersonalSubDetails] = useState<any>(null)
  const handleAddMember = async () => {
    if (!selectedSub) return
    setError('')
    // resolve by human member_id
    const res = await supabase.from('members').select('id, member_id, full_name').eq('member_id', addMemberInput.trim().toUpperCase()).single()
    if (res.error || !res.data) { setError('Member not found'); return }

    // Check if member has an active personal subscription
    const { data: personalSub, error: subError } = await supabase
      .from('member_subscriptions')
      .select('*, package:subscription_packages(name, type)')
      .eq('member_id', res.data.id)
      .eq('status', 'active')
      .single()

    if (!subError && personalSub) {
      // Show warning about removing personal subscription
      setPersonalSubDetails(personalSub)
      setPendingMemberData(res.data)
      setShowPersonalSubWarning(true)
      return
    }

    // No personal subscription, proceed normally
    await addMemberToSharedSubscription(res.data)
  }

  const addMemberToSharedSubscription = async (memberData: {id: string, member_id: string, full_name: string}) => {
    // Remove member from any existing shared subscriptions first
    const { error: removeError } = await supabase
      .from('shared_subscription_members' as any)
      .delete()
      .eq('member_id', memberData.id)
    
    if (removeError) { setError(removeError.message); return }

    // If they had a personal subscription, remove it
    if (personalSubDetails) {
      const { error: deletePersonalError } = await supabase
        .from('member_subscriptions')
        .delete()
        .eq('id', personalSubDetails.id)
      
      if (deletePersonalError) { 
        setError(`Failed to remove personal subscription: ${deletePersonalError.message}`); 
        return 
      }
    }

    // Now add to the new shared subscription
    const { error } = await supabase.from('shared_subscription_members' as any).insert({
      shared_subscription_id: selectedSub.id,
      member_id: memberData.id,
      is_default: true
    })
    if (error) { setError(error.message); return }
    
    // Reset state
    setAddMemberInput('')
    setShowPersonalSubWarning(false)
    setPendingMemberData(null)
    setPersonalSubDetails(null)
    await loadAll()
  }

  const cancelAddMember = () => {
    setShowPersonalSubWarning(false)
    setPendingMemberData(null)
    setPersonalSubDetails(null)
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedSub) return
    setError('')
    const { error } = await supabase.from('shared_subscription_members' as any)
      .delete()
      .eq('shared_subscription_id', selectedSub.id)
      .eq('member_id', memberId)
    if (error) { setError(error.message); return }
    await loadAll()
  }

  const handleEndDateChange = async (newDate: string) => {
    if (!selectedSub) return
    const { error } = await supabase.from('shared_subscriptions' as any).update({ end_date: newDate }).eq('id', selectedSub.id)
    if (error) { setError(error.message); return }
    await loadAll()
  }

  const handleDelete = async () => {
    if (!selectedSub) return
    if (!confirm(`Are you sure you want to delete shared subscription ${selectedSub.id}? This will remove all members from the pool and cannot be undone.`)) return
    
    setError('')
    
    // First remove all members
    const { error: membersError } = await supabase
      .from('shared_subscription_members' as any)
      .delete()
      .eq('shared_subscription_id', selectedSub.id)
    
    if (membersError) {
      setError(membersError.message)
      return
    }
    
    // Then delete the subscription
    const { error: deleteError } = await supabase
      .from('shared_subscriptions' as any)
      .delete()
      .eq('id', selectedSub.id)
    
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    
    setSelectedSubId(null)
    await loadAll()
  }

  const handleExportUsage = async () => {
    if (!selectedSub) return

    try {
      // Get detailed session deduction history
      const { data: deductions, error } = await supabase
        .from('session_deductions' as any)
        .select(`
          *,
          member:members(member_id, full_name)
        `)
        .eq('source_type', 'shared')
        .eq('source_id', selectedSub.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get current members list
      const currentMembers = members[selectedSub.id] || []
      const packageInfo = packages.find(p => p.id === selectedSub.package_id)

      // Create CSV content with better formatting
      const csvRows = [
        ['TRIPLE ONE - Shared Subscription Usage Report'],
        [''],
        ['Subscription Details'],
        ['Subscription ID', selectedSub.id],
        ['Package', packageInfo?.name || 'Unknown Package'],
        ['Total Sessions', selectedSub.sessions_total.toString()],
        ['Remaining Sessions', selectedSub.sessions_remaining.toString()],
        ['Start Date', selectedSub.start_date],
        ['End Date', selectedSub.end_date],
        ['Status', selectedSub.status.toUpperCase()],
        ['Total Members', currentMembers.length.toString()],
        ['Export Date', new Date().toLocaleDateString()],
        ['Export Time', new Date().toLocaleTimeString()],
        [''],
        ['Current Member Status'],
        ['Member ID', 'Member Name', 'Total Sessions Used', 'Join Date', 'Status']
      ]

      // Add current members with their total usage and join info
      currentMembers.forEach(member => {
        const totalUsed = usageByMember[selectedSub.id]?.[member.id] || 0
        // Find join date from session_deductions (first deduct action)
        const memberDeductions = deductions?.filter((d: any) => d.member_id === member.id && d.action === 'deduct') || []
        const joinDate = memberDeductions.length > 0 
          ? new Date(memberDeductions[memberDeductions.length - 1].created_at).toLocaleDateString()
          : 'Unknown'
        
        csvRows.push([
          member.member_id,
          member.full_name,
          totalUsed.toString(),
          joinDate,
          'Active'
        ])
      })

      csvRows.push([''])
      csvRows.push(['Session Usage History'])
      csvRows.push(['Date', 'Time', 'Member ID', 'Member Name', 'Action', 'Session Change'])

      // Add detailed history with better formatting
      deductions?.forEach((deduction: any) => {
        const date = new Date(deduction.created_at)
        const sessionChange = deduction.action === 'deduct' ? '-1' : '+1'
        const actionDisplay = deduction.action === 'deduct' ? 'Check-in' : 'Refund'
        
        csvRows.push([
          date.toLocaleDateString(),
          date.toLocaleTimeString(),
          deduction.member?.member_id || 'Unknown',
          deduction.member?.full_name || 'Unknown Member',
          actionDisplay,
          sessionChange
        ])
      })

      // Add summary statistics
      csvRows.push([''])
      csvRows.push(['Summary Statistics'])
      const totalDeductions = deductions?.filter((d: any) => d.action === 'deduct').length || 0
      const totalRestorations = deductions?.filter((d: any) => d.action === 'restore').length || 0
      const netUsage = totalDeductions - totalRestorations
      
      csvRows.push(['Total Check-ins', totalDeductions.toString()])
      csvRows.push(['Total Refunds', totalRestorations.toString()])
      csvRows.push(['Net Sessions Used', netUsage.toString()])
      csvRows.push(['Sessions Remaining', selectedSub.sessions_remaining.toString()])
      csvRows.push(['Utilization Rate', `${((netUsage / selectedSub.sessions_total) * 100).toFixed(1)}%`])

      // Convert to CSV string
      const csvContent = csvRows.map(row => 
        row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
      ).join('\n')

      // Download the file with better filename
      const packageName = packageInfo?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown'
      const filename = `TripleOne_Shared_${selectedSub.id}_${packageName}_${new Date().toISOString().split('T')[0]}.csv`
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (e: any) {
      setError(`Export failed: ${e.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-cinzel font-bold text-xl flex items-center gap-2"><Users className="w-5 h-5"/> Shared Subscriptions</h2>
        <Button onClick={loadAll} variant="outline" className="text-xs">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{error}</div>
      )}

      <div className="bg-t1-black/50 rounded-2xl p-5 border border-t1-red/20 space-y-3">
        <h4 className="font-cinzel font-semibold text-sm">Create Shared Subscription</h4>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select className="h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-3 text-sm" id="pkg">
            {packages.map(p => (
              <option key={p.id} value={p.id}>{p.name || `${p.sessions_count} Sessions`}</option>
            ))}
          </select>
          <Button
            onClick={() => {
              const sel = (document.getElementById('pkg') as HTMLSelectElement | null)?.value
              if (sel) handleCreate(sel)
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
          >
            <Plus className="w-4 h-4 mr-1"/> Create
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h4 className="font-cinzel font-semibold text-sm">All Shared Subscriptions</h4>
          <div className="space-y-2">
            {sharedSubs.map(s => {
              const isExpired = new Date(s.end_date) < new Date()
              const displayStatus = isExpired ? 'Expired' : 'Active'
              return (
              <button key={s.id} onClick={() => setSelectedSubId(s.id)} className={`w-full text-left rounded-xl border p-3 ${selectedSubId===s.id? 'border-t1-red/60 bg-white/5':'border-t1-red/20 bg-t1-black/40'} hover:border-t1-red/60 transition-colors`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{packages.find(p=>p.id===s.package_id)?.name || `${s.sessions_total} Sessions`}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-t1-gold/20 text-t1-gold font-mono font-bold">{s.id}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Remaining: {s.sessions_remaining} • Ends {s.end_date}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full border ${
                    isExpired ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  }`}>{displayStatus}</span>
                </div>
              </button>
              )
            })}
            {sharedSubs.length===0 && (
              <p className="text-sm text-muted-foreground">No shared subscriptions yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-cinzel font-semibold text-sm">Details</h4>
          {!selectedSub ? (
            <p className="text-sm text-muted-foreground">Select a shared subscription to manage members and expiry.</p>
          ) : (
            <div className="bg-t1-black/50 rounded-2xl p-5 border border-t1-red/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{packages.find(p=>p.id===selectedSub.package_id)?.name || `${selectedSub.sessions_total} Sessions`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 rounded-full bg-t1-gold/20 text-t1-gold font-mono font-bold border border-t1-gold/30">ID: {selectedSub.id}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Remaining: {selectedSub.sessions_remaining} • Start {selectedSub.start_date} • End {selectedSub.end_date}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportUsage}
                    variant="outline"
                    className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 rounded-lg"
                    title="Export usage history to CSV"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="outline"
                    className="bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>


              <div className="space-y-2">
                <Label className="text-t1-cream">Edit Remaining Sessions</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={0}
                    value={selectedSub.sessions_remaining}
                    onChange={async (e) => {
                      const newVal = parseInt(e.target.value, 10)
                      if (isNaN(newVal) || newVal < 0) return
                      const { error } = await supabase
                        .from('shared_subscriptions' as any)
                        .update({ sessions_remaining: newVal })
                        .eq('id', selectedSub.id)
                      if (!error) await loadAll()
                      else setError(error.message)
                    }}
                    className="h-10 w-32 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg"
                  />
                  <span className="text-xs text-muted-foreground">sessions</span>
                </div>
                <Label className="text-t1-cream mt-4">Edit End Date</Label>
                <Input type="date" value={selectedSub.end_date} onChange={(e)=>handleEndDateChange(e.target.value)} className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg"/>
                <p className="text-xs text-muted-foreground">After changing end date, consider creating a new shared subscription for continuation or exporting usage.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-t1-cream">Members</Label>
                <div className="flex gap-2">
                  <Input placeholder="Enter Member ID (e.g., T1-0001)" value={addMemberInput} onChange={(e)=>setAddMemberInput(e.target.value)} className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg"/>
                  <Button onClick={handleAddMember} className="bg-t1-gold hover:bg-t1-gold/90 text-t1-black rounded-lg"><Check className="w-4 h-4 mr-1"/>Add</Button>
                </div>
                <div className="space-y-2">
                  {(members[selectedSub.id] || []).map(m => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border border-t1-red/20 p-2">
                      <div>
                        <p className="text-sm font-semibold">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.member_id} • Used: {usageByMember[selectedSub.id]?.[m.id] || 0}</p>
                      </div>
                      <button onClick={()=>handleRemoveMember(m.id)} className="p-2 rounded-lg hover:bg-white/10"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                  {(!members[selectedSub.id] || members[selectedSub.id].length===0) && (
                    <p className="text-sm text-muted-foreground">No members yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning Dialog for Personal Subscription Removal */}
      <Dialog open={showPersonalSubWarning} onOpenChange={setShowPersonalSubWarning}>
        <DialogContent className="bg-t1-black border-t1-red/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-t1-cream">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Remove Personal Subscription?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-t1-cream">
              <strong>{pendingMemberData?.full_name}</strong> ({pendingMemberData?.member_id}) currently has an active personal subscription.
            </p>
            <div className="bg-t1-black/50 rounded-lg p-3 border border-t1-red/20">
              <p className="text-sm text-muted-foreground mb-2">Current Personal Subscription:</p>
              <p className="font-semibold text-t1-gold">{personalSubDetails?.package?.name || 'Unknown Package'}</p>
              <p className="text-sm text-muted-foreground">
                {personalSubDetails?.sessions_remaining} sessions remaining • Expires {personalSubDetails?.end_date ? new Date(personalSubDetails.end_date).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
            <p className="text-amber-400 text-sm">
              ⚠️ Adding this member to the shared subscription will <strong>permanently remove</strong> their personal subscription. This action cannot be undone.
            </p>
            <p className="text-t1-cream">
              Are you sure you want to proceed?
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              onClick={cancelAddMember} 
              variant="outline" 
              className="border-t1-red/30 text-t1-cream hover:bg-t1-red/10"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => pendingMemberData && addMemberToSharedSubscription(pendingMemberData)} 
              className="bg-t1-red hover:bg-t1-red/90 text-white"
            >
              Remove Personal & Add to Shared
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
