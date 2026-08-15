import { useState, useEffect } from 'react'
import { ArrowLeft, Phone, MessageCircle, DollarSign, TrendingUp, AlertCircle, Phone as PhoneIcon, Edit2, Check, X, Plus, Repeat2, Trash2, MoreVertical } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { PaymentsPage } from './member-profile/PaymentsPage'
import { PrsPage } from './member-profile/PrsPage'

type Member = {
  id: string
  member_id: string
  full_name: string
  phone: string
  email: string | null
  level: string
  status: string
  branch_id: string | null
  medical_notes: string | null
  emergency_contact: string | null
  loyalty_points: number | null
}

type ManualPayment = {
  id: string
  member_id: string
  amount: number
  payment_type: string
  description: string | null
  payment_date: string
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

type Page = 'overview' | 'payments' | 'prs' | 'medical' | 'emergency'

type MemberProfilePanelProps = {
  member: Member
  onBack: () => void
}

export function MemberProfilePanel({ member, onBack }: MemberProfilePanelProps) {
  const [currentPage, setCurrentPage] = useState<Page>('overview')
  const [payments, setPayments] = useState<ManualPayment[]>([])
  const [prs, setPrs] = useState<PersonalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMedical, setEditingMedical] = useState(false)
  const [editingEmergency, setEditingEmergency] = useState(false)
  const [medicalNotes, setMedicalNotes] = useState(member.medical_notes || '')
  const [emergencyForm, setEmergencyForm] = useState<{ name: string; phone: string; relationship: string }>(() => {
    if (member.emergency_contact) {
      try {
        return JSON.parse(member.emergency_contact)
      } catch {
        return { name: '', phone: '', relationship: '' }
      }
    }
    return { name: '', phone: '', relationship: '' }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showLoyaltyInput, setShowLoyaltyInput] = useState(false)
  const [loyaltyPointsToAdd, setLoyaltyPointsToAdd] = useState('')
  const [currentLoyaltyPoints, setCurrentLoyaltyPoints] = useState(member.loyalty_points || 0)
  const [editingLevel, setEditingLevel] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState(member.level)
  const [editingBranch, setEditingBranch] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(member.branch_id || '1st Settlement')
  const [branches, setBranches] = useState<{id: string; name: string}[]>([])
  const [editingSubscription, setEditingSubscription] = useState(false)
  const [subscriptionPackages, setSubscriptionPackages] = useState<any[]>([])
  const [memberSubscription, setMemberSubscription] = useState<any>(null)
  const [editingSubscriptionDetails, setEditingSubscriptionDetails] = useState(false)
  const [subscriptionEndDate, setSubscriptionEndDate] = useState('')
  const [subscriptionSessions, setSubscriptionSessions] = useState('')
  const [resetPinLoading, setResetPinLoading] = useState(false)
  const [sharedSubscription, setSharedSubscription] = useState<any>(null)

  useEffect(() => {
    loadAllData()
  }, [member.id])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [paymentsRes, prsRes, packagesRes, subscriptionRes, branchesRes, sharedSubRes] = await Promise.all([
        supabase
          .from('manual_payments')
          .select('*')
          .eq('member_id', member.id)
          .order('payment_date', { ascending: false }),
        supabase
          .from('personal_records')
          .select('*, movement:movements(name)')
          .eq('member_id', member.id)
          .order('recorded_at', { ascending: false }),
        supabase
          .from('subscription_packages')
          .select('*')
          .order('name'),
        supabase
          .from('member_subscriptions')
          .select('*')
          .eq('member_id', member.id)
          .single(),
        supabase
          .from('branches')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('shared_subscription_members' as any)
          .select(`
            shared_subscription_id,
            shared_subscription:shared_subscriptions(
              id,
              sessions_total,
              sessions_remaining,
              start_date,
              end_date,
              status,
              package:subscription_packages(name)
            )
          `)
          .eq('member_id', member.id)
          .single()
      ])

      if (paymentsRes.data) setPayments(paymentsRes.data)
      if (prsRes.data) setPrs(prsRes.data)
      if (packagesRes.data) setSubscriptionPackages(packagesRes.data)
      if (subscriptionRes.data) setMemberSubscription(subscriptionRes.data)
      if (branchesRes.data) setBranches(branchesRes.data)
      if (sharedSubRes.data) setSharedSubscription(sharedSubRes.data)
    } catch (err) {
      console.error('Failed to load member data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTopPrByMovement = () => {
    const grouped: Record<string, PersonalRecord> = {}
    prs.forEach(pr => {
      const movementName = pr.movement?.name || 'Unknown'
      if (!grouped[movementName] || new Date(pr.recorded_at) > new Date(grouped[movementName].recorded_at)) {
        grouped[movementName] = pr
      }
    })
    return Object.values(grouped).slice(0, 3)
  }

  const handleWhatsApp = () => {
    const phone = member.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}`, '_blank')
  }

  // Send WhatsApp welcome message with username and activation steps
  const handleWhatsAppWelcome = () => {
    let phone = member.phone.replace(/\D/g, '')
    // If phone starts with '0', replace with '20' (Egypt country code)
    if (phone.startsWith('0')) {
      phone = '20' + phone.slice(1)
    }
    const name = member.full_name
    const memberId = member.member_id
    const message = `Welcome to TripleOne, ${name}!\n\nYour username: *${memberId}*\n\nTo activate your account:\n1. Visit https://tripleonebars.com and add it to your Homescreen as a web app.\n2. Open the app from your Homescreen, tap \"Activate Account\".\n3. Enter your username and phone number, then create your 4-digit PIN.\n4. Use your member ID and PIN to log in.\n\n*If you need any help, just reply to this message. We’re here for you!*`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleCall = () => {
    window.location.href = `tel:${member.phone}`
  }

  const handleResetPin = async () => {
    setResetPinLoading(true)
    setSaveError('')
    try {
      const { error } = await supabase
        .from('members')
        .update({ pin: null, status: 'pending' })
        .eq('id', member.id)

      if (error) throw error
      alert(`PIN reset for ${member.full_name}. Member must complete account activation on next login.`)
      member.status = 'pending'
    } catch (err) {
      setSaveError('Failed to reset PIN')
      console.error('Reset PIN error:', err)
    } finally {
      setResetPinLoading(false)
    }
  }

  const getLevelIcon = (level: string) => {
    const icons: Record<string, string> = {
      Warrior: '⚔️',
      Spartan: '🛡️',
      Legend: '👑',
      Ladies: '🌸'
    }
    return icons[level] || '💪'
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Warrior':
        return 'from-[#cd7f32] to-[#8b4513]'
      case 'Spartan':
        return 'from-[#c0c0c0] to-[#808080]'
      case 'Legend':
        return 'from-t1-gold to-[#b8860b]'
      case 'Ladies':
        return 'from-[#ff9ecd] to-[#ff6f9c]'
      default:
        return 'from-zinc-500 to-zinc-600'
    }
  }

  const handleSaveMedical = async () => {
    setIsSaving(true)
    setSaveError('')
    try {
      const { error } = await supabase
        .from('members')
        .update({ medical_notes: medicalNotes || null })
        .eq('id', member.id)

      if (error) throw error
      member.medical_notes = medicalNotes || null
      setEditingMedical(false)
    } catch (err) {
      setSaveError('Failed to save medical notes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveEmergency = async () => {
    if (!emergencyForm.name || !emergencyForm.phone || !emergencyForm.relationship) {
      setSaveError('All emergency contact fields are required')
      return
    }

    setIsSaving(true)
    setSaveError('')
    try {
      const { error } = await supabase
        .from('members')
        .update({ emergency_contact: JSON.stringify(emergencyForm) })
        .eq('id', member.id)

      if (error) throw error
      member.emergency_contact = JSON.stringify(emergencyForm)
      setEditingEmergency(false)
    } catch (err) {
      setSaveError('Failed to save emergency contact')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddLoyaltyPoints = async () => {
    const pointsToAdd = parseInt(loyaltyPointsToAdd)
    if (isNaN(pointsToAdd) || pointsToAdd === 0) {
      setSaveError('Please enter a valid number (can be negative to subtract)')
      return
    }

    setIsSaving(true)
    setSaveError('')
    try {
      const newTotal = currentLoyaltyPoints + pointsToAdd
      const { error } = await supabase
        .from('members')
        .update({ loyalty_points: newTotal })
        .eq('id', member.id)

      if (error) throw error
      setCurrentLoyaltyPoints(newTotal)
      member.loyalty_points = newTotal
      setShowLoyaltyInput(false)
      setLoyaltyPointsToAdd('')
    } catch (err) {
      setSaveError('Failed to update loyalty points')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveLevel = async () => {
    if (selectedLevel === member.level) {
      setEditingLevel(false)
      return
    }

    setIsSaving(true)
    setSaveError('')
    try {
      const { error } = await supabase
        .from('members')
        .update({ level: selectedLevel })
        .eq('id', member.id)

      if (error) throw error
      member.level = selectedLevel
      setEditingLevel(false)
    } catch (err) {
      setSaveError('Failed to update level')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBranch = async () => {
    if (selectedBranch === member.branch_id) {
      setEditingBranch(false)
      return
    }

    setIsSaving(true)
    setSaveError('')
    try {
      const { error } = await supabase
        .from('members')
        .update({ branch_id: selectedBranch })
        .eq('id', member.id)

      if (error) throw error
      member.branch_id = selectedBranch
      setEditingBranch(false)
    } catch (err) {
      setSaveError('Failed to update branch')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSubscription = async (packageId: string) => {
    setIsSaving(true)
    setSaveError('')
    try {
      const pkg = subscriptionPackages.find(p => p.id === packageId)
      if (!pkg) throw new Error('Package not found')

      const startDate = new Date().toISOString().split('T')[0]
      let endDate = ''
      if (pkg.duration_days) {
        const end = new Date()
        end.setDate(end.getDate() + pkg.duration_days)
        endDate = end.toISOString().split('T')[0]
      }

      if (memberSubscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('member_subscriptions')
          .update({
            package_id: packageId,
            sessions_remaining: pkg.sessions_count,
            start_date: startDate,
            end_date: endDate,
            status: 'active'
          })
          .eq('id', memberSubscription.id)

        if (error) throw error
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('member_subscriptions')
          .insert({
            member_id: member.id,
            package_id: packageId,
            sessions_remaining: pkg.sessions_count,
            start_date: startDate,
            end_date: endDate,
            status: 'active'
          })

        if (error) throw error
      }

      loadAllData()
      setEditingSubscription(false)
    } catch (err) {
      setSaveError('Failed to update subscription')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveSubscription = async () => {
    if (!memberSubscription) return
    if (!window.confirm('Remove this subscription? This member will no longer have access.')) return

    setIsSaving(true)
    setSaveError('')
    try {
      const { error } = await supabase
        .from('member_subscriptions')
        .delete()
        .eq('id', memberSubscription.id)

      if (error) throw error
      loadAllData()
      setEditingSubscription(false)
    } catch (err) {
      setSaveError('Failed to remove subscription')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSubscriptionDetails = async () => {
    if (!memberSubscription) return
    if (!subscriptionEndDate) {
      setSaveError('End date is required')
      return
    }

    setIsSaving(true)
    setSaveError('')
    try {
      const updateData: any = {
        end_date: subscriptionEndDate
      }

      // Only update sessions if it's a session-based subscription and value changed
      const pkg = subscriptionPackages.find(p => p.id === memberSubscription.package_id)
      if (pkg?.type === 'session' && subscriptionSessions !== '') {
        updateData.sessions_remaining = parseInt(subscriptionSessions)
        if (isNaN(updateData.sessions_remaining) || updateData.sessions_remaining < 0) {
          setSaveError('Sessions must be a valid number')
          setIsSaving(false)
          return
        }
      }

      const { error } = await supabase
        .from('member_subscriptions')
        .update(updateData)
        .eq('id', memberSubscription.id)

      if (error) throw error
      loadAllData()
      setEditingSubscriptionDetails(false)
    } catch (err) {
      setSaveError('Failed to update subscription details')
    } finally {
      setIsSaving(false)
    }
  }

  // Render different pages
  if (currentPage === 'payments') {
    return <PaymentsPage member={member} onBack={() => setCurrentPage('overview')} payments={payments} />
  }

  if (currentPage === 'prs') {
    return <PrsPage member={member} onBack={() => setCurrentPage('overview')} prs={prs} onPrsUpdate={loadAllData} />
  }

  // Overview page
  return (
    <div className="min-h-screen bg-t1-black text-t1-cream pb-24">
      {/* Header with back button */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-t1-cream hover:text-t1-gold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Members
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Member Details Card */}
        <div className="bg-secondary rounded-2xl p-6 border border-t1-red/10 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getLevelColor(member.level)} flex items-center justify-center text-2xl shadow-lg`}>
                {getLevelIcon(member.level)}
              </div>
              <div>
                <h2 className="text-2xl font-cinzel font-bold">{member.full_name}</h2>
                <p className="text-sm text-muted-foreground">{member.member_id}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getLevelColor(member.level)} text-white`}>
                    {member.level} Level
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    member.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-zinc-600/20 text-zinc-400'
                  }`}>
                    {member.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Call, WhatsApp, and more options */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCall}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                title="Call member"
              >
                <PhoneIcon className="w-5 h-5 text-t1-cream" />
              </button>
              <button
                onClick={handleWhatsApp}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                title="Send WhatsApp message"
              >
                <MessageCircle className="w-5 h-5 text-t1-cream" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                    title="More options"
                  >
                    <MoreVertical className="w-5 h-5 text-t1-cream" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-t1-black border border-t1-red/30 rounded-lg">
                  <DropdownMenuItem
                    onClick={handleResetPin}
                    disabled={resetPinLoading}
                    className="text-t1-cream hover:bg-t1-red/20 cursor-pointer focus:bg-t1-red/20"
                  >
                    {resetPinLoading ? 'Resetting...' : 'Reset PIN'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleWhatsAppWelcome}
                    className="text-t1-cream hover:bg-emerald-500/20 cursor-pointer focus:bg-emerald-500/20"
                  >
                    Send WhatsApp Welcome
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-t1-red/10">
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-semibold">{member.phone}</p>
            </div>
            {member.email && (
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-semibold text-sm break-all">{member.email}</p>
              </div>
            )}
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Loyalty Points</p>
                  <p className="font-semibold text-t1-gold text-lg">{currentLoyaltyPoints}</p>
                </div>
                {!showLoyaltyInput && (
                  <button
                    onClick={() => setShowLoyaltyInput(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-t1-gold/20 hover:bg-t1-gold/30 text-t1-gold transition-colors text-xs font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    Add Points
                  </button>
                )}
              </div>
              
              {showLoyaltyInput && (
                <div className="mt-3 space-y-2">
                  {saveError && (
                    <div className="text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                      {saveError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={loyaltyPointsToAdd}
                      onChange={(e) => setLoyaltyPointsToAdd(e.target.value)}
                      placeholder="Points to add/remove"
                      className="h-9 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
                    />
                    <Button
                      onClick={handleAddLoyaltyPoints}
                      disabled={isSaving}
                      size="sm"
                      className="bg-t1-gold hover:bg-t1-gold/90 text-t1-black rounded-lg font-semibold"
                    >
                      {isSaving ? 'Saving...' : <><Check className="w-3 h-3 mr-1" /> Save</>}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowLoyaltyInput(false)
                        setLoyaltyPointsToAdd('')
                        setSaveError('')
                      }}
                      disabled={isSaving}
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-t1-red/30 text-t1-cream rounded-lg"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Level Management Card */}
        <div className="bg-t1-black/50 rounded-2xl p-5 border border-t1-red/20 space-y-3">
          <h4 className="font-cinzel font-semibold text-sm flex items-center gap-2">
            <span className="text-t1-gold">👑</span>
            Member Level
          </h4>
          {editingLevel ? (
            <div className="space-y-2">
              {saveError && (
                <div className="text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                  {saveError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="flex-1 h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-3 text-sm"
                >
                  <option value="Warrior">⚔️ Warrior</option>
                  <option value="Spartan">🛡️ Spartan</option>
                  <option value="Legend">👑 Legend</option>
                  <option value="Ladies">🌸 Ladies</option>
                </select>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-br ${getLevelColor(selectedLevel)}`}>
                  {selectedLevel === 'Legend' ? '👑' : selectedLevel === 'Spartan' ? '🛡️' : selectedLevel === 'Ladies' ? '🌸' : '⚔️'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveLevel}
                  disabled={isSaving}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  {isSaving ? 'Saving...' : <><Check className="w-3 h-3 mr-1" /> Save</>}
                </Button>
                <Button
                  onClick={() => {
                    setEditingLevel(false)
                    setSelectedLevel(member.level)
                    setSaveError('')
                  }}
                  disabled={isSaving}
                  size="sm"
                  variant="outline"
                  className="bg-transparent border-t1-red/30 text-t1-cream rounded-lg"
                >
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${getLevelColor(member.level)} text-white`}>
                  {member.level}
                </span>
              </div>
              <button
                onClick={() => setEditingLevel(true)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Branch Management Card */}
        <div className="bg-t1-black/50 rounded-2xl p-5 border border-t1-red/20 space-y-3">
          <h4 className="font-cinzel font-semibold text-sm flex items-center gap-2">
            <span className="text-t1-gold">🌍</span>
            Member Branch
          </h4>
          {editingBranch ? (
            <div className="space-y-2">
              {saveError && (
                <div className="text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                  {saveError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="flex-1 h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-3 text-sm"
                >
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveBranch}
                  disabled={isSaving}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  {isSaving ? 'Saving...' : <><Check className="w-3 h-3 mr-1" /> Save</>}
                </Button>
                <Button
                  onClick={() => {
                    setEditingBranch(false)
                    setSelectedBranch(member.branch_id || '1st Settlement')
                    setSaveError('')
                  }}
                  disabled={isSaving}
                  size="sm"
                  variant="outline"
                  className="bg-transparent border-t1-red/30 text-t1-cream rounded-lg"
                >
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-600 to-amber-700 text-white">
                  {member.branch_id || '1st Settlement'}
                </span>
              </div>
              <button
                onClick={() => setEditingBranch(true)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Subscription Management Card */}
        <div className="bg-t1-black/50 rounded-2xl p-5 border border-t1-red/20 space-y-3">
          <h4 className="font-cinzel font-semibold text-sm flex items-center gap-2">
            <span className="text-purple-400">📅</span>
            Subscription Package
          </h4>
          {editingSubscription ? (
            <div className="space-y-2">
              {saveError && (
                <div className="text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                  {saveError}
                </div>
              )}
              <div className="space-y-2">
                {subscriptionPackages
                  .filter(p => p.is_active && p.sessions_count !== 100 && p.sessions_count !== 150)
                  .sort((a, b) => {
                    // First sort by type: session-based before time-based
                    if (a.sessions_count && !b.sessions_count) return -1
                    if (!a.sessions_count && b.sessions_count) return 1
                    
                    // Within session-based: sort by sessions count (lower to higher)
                    if (a.sessions_count && b.sessions_count) {
                      return a.sessions_count - b.sessions_count
                    }
                    
                    // Within time-based: sort by duration (smaller to higher)
                    if (a.duration_days && b.duration_days) {
                      return a.duration_days - b.duration_days
                    }
                    
                    return 0
                  })
                  .map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => handleSaveSubscription(pkg.id)}
                      disabled={isSaving}
                      className="w-full p-3 rounded-lg border border-t1-red/20 hover:border-t1-red/40 bg-t1-black transition-all text-left text-sm"
                    >
                      <p className="font-semibold">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pkg.duration_days ? `${pkg.duration_days} days` : 'Unlimited'} 
                        {pkg.sessions_count ? ` • ${pkg.sessions_count} sessions` : ''}
                      </p>
                    </button>
                  ))}
              </div>
              <Button
                onClick={() => {
                  setEditingSubscription(false)
                  setSaveError('')
                }}
                disabled={isSaving}
                size="sm"
                variant="outline"
                className="w-full bg-transparent border-t1-red/30 text-t1-cream rounded-lg"
              >
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {memberSubscription ? (
                <>
                  <div className="bg-t1-black rounded-lg p-3">
                    <p className="font-semibold text-sm">{subscriptionPackages.find(p => p.id === memberSubscription.package_id)?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(memberSubscription.end_date).toLocaleDateString()}
                    </p>
                    {memberSubscription.sessions_remaining !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Sessions: {memberSubscription.sessions_remaining}
                      </p>
                    )}
                  </div>
                  {!editingSubscriptionDetails ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingSubscriptionDetails(true)
                          setSubscriptionEndDate(memberSubscription.end_date)
                          setSubscriptionSessions(memberSubscription.sessions_remaining?.toString() || '')
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white transition-all text-sm font-semibold"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => setEditingSubscription(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white transition-all text-sm font-semibold"
                      >
                        <Repeat2 className="w-4 h-4" />
                        Change
                      </button>
                      <button
                        onClick={handleRemoveSubscription}
                        disabled={isSaving}
                        className="px-3 py-2.5 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove subscription"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-t1-black rounded-lg p-3">
                      {saveError && (
                        <div className="text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                          {saveError}
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">End Date *</Label>
                        <Input
                          type="date"
                          value={subscriptionEndDate}
                          onChange={(e) => setSubscriptionEndDate(e.target.value)}
                          className="h-9 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
                          required
                        />
                      </div>
                      {subscriptionPackages.find(p => p.id === memberSubscription.package_id)?.type === 'session' && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Remaining Sessions *</Label>
                          <Input
                            type="number"
                            min="0"
                            value={subscriptionSessions}
                            onChange={(e) => setSubscriptionSessions(e.target.value)}
                            className="h-9 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
                            required
                          />
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={handleSaveSubscriptionDetails}
                          disabled={isSaving}
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                          {isSaving ? 'Saving...' : <><Check className="w-3 h-3 mr-1" /> Save</>}
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingSubscriptionDetails(false)
                            setSaveError('')
                          }}
                          disabled={isSaving}
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-transparent border-t1-red/30 text-t1-cream rounded-lg"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-3">No active subscription</p>
                  <button
                    onClick={() => setEditingSubscription(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-t1-gold/20 hover:bg-t1-gold/30 text-t1-gold transition-colors text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Assign Package
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Shared Subscription Card */}
        {sharedSubscription && sharedSubscription.shared_subscription && (
          <div className="bg-t1-black/50 rounded-2xl p-5 border border-t1-gold/30 space-y-3">
            <h4 className="font-cinzel font-semibold text-sm flex items-center gap-2">
              <span className="text-t1-gold">👥</span>
              Shared Subscription
            </h4>
            <div className="bg-t1-black rounded-lg p-3 border border-t1-gold/20">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm text-t1-gold">{sharedSubscription.shared_subscription.package?.name || 'Shared Package'}</p>
                <span className="text-xs px-3 py-1 rounded-full bg-t1-gold/20 text-t1-gold font-mono font-bold border border-t1-gold/30">
                  {sharedSubscription.shared_subscription.id}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Pool: {sharedSubscription.shared_subscription.sessions_remaining}/{sharedSubscription.shared_subscription.sessions_total} sessions
                </p>
                <p className="text-xs text-muted-foreground">
                  Valid until: {new Date(sharedSubscription.shared_subscription.end_date).toLocaleDateString()}
                </p>
                <p className={`text-xs ${
                  new Date(sharedSubscription.shared_subscription.end_date) < new Date() ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  Status: {new Date(sharedSubscription.shared_subscription.end_date) < new Date() ? 'Expired' : 'Active'}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              This member shares sessions from this pool with other members
            </p>
          </div>
        )}

        {/* Feature Cards Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payments Card */}
            <button
              onClick={() => setCurrentPage('payments')}
              className="bg-secondary rounded-2xl p-4 border border-t1-red/10 hover:border-t1-red/30 transition-all text-left group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-cinzel font-semibold group-hover:text-t1-gold transition-colors">Payments</h3>
              </div>
              <div className="space-y-2">
                {payments.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-t1-red/10 last:border-0">
                    <span className="text-muted-foreground">{p.payment_type}</span>
                    <span className="text-emerald-400 font-semibold">{p.amount} EGP</span>
                  </div>
                ))}
              </div>
              {payments.length > 3 && (
                <button className="text-xs text-t1-red hover:text-t1-gold mt-2 transition-colors">
                  View All ({payments.length})
                </button>
              )}
            </button>

            {/* PRs Card */}
            <button
              onClick={() => setCurrentPage('prs')}
              className="bg-secondary rounded-2xl p-4 border border-t1-red/10 hover:border-t1-red/30 transition-all text-left group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-cinzel font-semibold group-hover:text-t1-gold transition-colors">Personal Records</h3>
              </div>
              <div className="space-y-2">
                {getTopPrByMovement().map(pr => (
                  <div key={pr.id} className="flex items-center justify-between text-xs py-1 border-b border-t1-red/10 last:border-0">
                    <span className="text-muted-foreground">{pr.movement?.name}</span>
                    <span className="text-amber-400 font-semibold">
                      {pr.value} {pr.record_type === 'weighted' ? 'kg' : 'reps'}
                    </span>
                  </div>
                ))}
              </div>
              {prs.length > 0 && (
                <button className="text-xs text-t1-red hover:text-t1-gold mt-2 transition-colors">
                  View All ({prs.length})
                </button>
              )}
            </button>

            {/* Medical Notes Card */}
            <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10 hover:border-t1-red/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="font-cinzel font-semibold">Medical Notes</h3>
                </div>
                {!editingMedical && (
                  <button
                    onClick={() => setEditingMedical(true)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {saveError && editingMedical && (
                <div className="mb-3 text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                  {saveError}
                </div>
              )}

              {editingMedical ? (
                <div className="space-y-3">
                  <textarea
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    placeholder="Enter medical notes..."
                    className="w-full h-24 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-3 py-2 text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveMedical}
                      disabled={isSaving}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      {isSaving ? 'Saving...' : <><Check className="w-3 h-3 mr-1" /> Save</>}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingMedical(false)
                        setMedicalNotes(member.medical_notes || '')
                        setSaveError('')
                      }}
                      disabled={isSaving}
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-t1-red/30 text-t1-cream rounded-lg"
                    >
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditingMedical(true)} className="cursor-pointer">
                  {member.medical_notes ? (
                    <p className="text-xs text-muted-foreground">{member.medical_notes}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No medical notes - Click to add</p>
                  )}
                </div>
              )}
            </div>

            {/* Emergency Contact Card */}
            <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10 hover:border-t1-red/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <PhoneIcon className="w-5 h-5 text-red-400" />
                  </div>
                  <h3 className="font-cinzel font-semibold">Emergency Contact</h3>
                </div>
                {!editingEmergency && (
                  <button
                    onClick={() => setEditingEmergency(true)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {saveError && editingEmergency && (
                <div className="mb-3 text-xs text-red-400 bg-red-500/20 border border-red-500/30 rounded-lg p-2">
                  {saveError}
                </div>
              )}

              {editingEmergency ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Name *</Label>
                    <Input
                      value={emergencyForm.name}
                      onChange={(e) => setEmergencyForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Full name"
                      className="h-9 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Phone *</Label>
                    <Input
                      value={emergencyForm.phone}
                      onChange={(e) => setEmergencyForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone number"
                      className="h-9 bg-t1-black border-t1-red/20 text-t1-cream rounded-lg text-sm"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1">Relationship *</Label>
                    <select
                      value={emergencyForm.relationship}
                      onChange={(e) => setEmergencyForm(prev => ({ ...prev, relationship: e.target.value }))}
                      className="w-full h-9 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-3 text-sm"
                      required
                    >
                      <option value="">Select relationship</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveEmergency}
                      disabled={isSaving}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      {isSaving ? 'Saving...' : <><Check className="w-3 h-3 mr-1" /> Save</>}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingEmergency(false)
                        if (member.emergency_contact) {
                          try {
                            setEmergencyForm(JSON.parse(member.emergency_contact))
                          } catch {
                            setEmergencyForm({ name: '', phone: '', relationship: '' })
                          }
                        }
                        setSaveError('')
                      }}
                      disabled={isSaving}
                      size="sm"
                      variant="outline"
                      className="bg-transparent border-t1-red/30 text-t1-cream rounded-lg"
                    >
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditingEmergency(true)} className="cursor-pointer">
                  {member.emergency_contact ? (
                    (() => {
                      try {
                        const ec = JSON.parse(member.emergency_contact)
                        return (
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold">{ec.name}</p>
                            <p className="text-muted-foreground">{ec.phone}</p>
                            <p className="text-muted-foreground">{ec.relationship}</p>
                          </div>
                        )
                      } catch {
                        return <p className="text-xs text-muted-foreground italic">Invalid format - Click to fix</p>
                      }
                    })()
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No emergency contact - Click to add</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-8 h-8 border-4 border-t1-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading...
          </div>
        )}
      </div>
    </div>
  )
}
