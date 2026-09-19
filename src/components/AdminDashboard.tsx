import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, Dumbbell, Users, TrendingUp, Settings, Bell, ChevronRight, Search, UserPlus, CreditCard, Star, Activity, Clock, Award, Calendar, Shield, DollarSign, Phone, MessageCircle, XCircle, MapPin, MoreVertical, AlertTriangle, QrCode, Download } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { supabase } from '../lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { MemberProfilePanel } from './admin/MemberProfilePanel'
import { SharedSubscriptions } from './admin/SharedSubscriptions'
import { CheckInQrScreen } from './CheckInQrScreen'

type AdminDashboardProps = {
  admin: {
    id: string
    full_name: string
    email: string
  }
  onLogout: () => void
}

type Movement = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

type Member = {
  id: string
  member_id: string
  full_name: string
  phone: string
  email: string | null
  level: string
  status: string
  loyalty_points: number
  pin: string | null
  medical_notes: string | null
  emergency_contact: string | null
  branch_id: string | null
}

type LeadStatus = 'not_contacted' | 'contacted' | 'no_answer' | 'booked'

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'not_contacted', label: 'Not contacted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'booked', label: 'Booked' },
]

type AssessmentSession = {
  id: string
  full_name: string
  phone: string
  email: string | null
  branch: string | null
  preferred_date: string | null
  preferred_time: string | null
  status: string
  notes: string | null
  created_at: string
  confirmed: boolean
  lead_status?: string | null
}

type AttendanceRecord = {
  id: string
  member_id: string
  check_in_time: string
  check_in_method: string
  branch_id?: string | null
  member?: { full_name: string; member_id: string }
}

type Subscription = {
  id: string
  member_id: string
  sessions_remaining: number | null
  start_date: string
  end_date: string
  status: string
  package?: { name: string; type: string }
  member?: { full_name: string; member_id: string }
}

type Payment = {
  id: string
  member_id: string
  amount: number
  payment_type: string
  description: string | null
  payment_date: string
  member?: { full_name: string; member_id: string }
}

type PersonalRecord = {
  id: string
  member_id: string
  movement_id: string
  record_type: string
  value: number
  weight_used: number | null
  notes: string | null
  recorded_at: string
  member?: { full_name: string; member_id: string }
  movement?: { name: string }
}

type SubscriptionPackage = {
  id: string
  name: string
  type: string
  sessions_count: number | null
  duration_days: number | null
  price: string
  is_active: boolean
}

type GroupClass = {
  id: string
  name: string
  description: string | null
  member_level: string
  max_capacity: number | null
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  branch_id: string | null
  workout_type_id: string | null
}

type ClassSession = {
  id: string
  group_class_id: string
  session_date: string
  start_time: string
  end_time: string
  status: string | null
  created_at: string
  group_class?: GroupClass
}

type ClassBooking = {
  id: string
  class_id: string
  member_id: string
  class_date: string
  status: string
  checked_in_at: string | null
  session_id: string | null
  member?: { full_name: string; member_id: string; phone: string; level: string }
  group_class?: GroupClass
}

const denseOverlay = Object.freeze({
  lanes: Array.from({ length: 240 }, (_, index) => ({
    id: `r${index.toString(36)}`,
    key: `cell-${((index * 17) % 101).toString(36)}`,
    order: Array.from({ length: 10 }, (_, step) => ({
      token: `t${((index * 11 + step * 7) % 97).toString(36)}`,
      label: `v${((index + step * 13) % 43).toString(36)}`,
      value: `${index}-${step}-${((index * 3 + step * 5) % 29).toString(36)}`,
    })),
    mesh: {
      zone: `z${(index % 23).toString(36)}`,
      cluster: `c${((index * 5) % 19).toString(36)}`,
      flags: Array.from({ length: 8 }, (_, flagIndex) => ({
        ref: `f${((index * 13 + flagIndex * 7) % 89).toString(36)}`,
        tag: `tag-${flagIndex}-${index.toString(36)}`,
        hash: `h${((index + flagIndex * 3) % 41).toString(36)}`,
      })),
    },
  })),
  graph: Array.from({ length: 1200 }, (_, index) => ({
    name: `node-${((index * 19) % 113).toString(36)}`,
    id: `n${index.toString(36)}`,
    rank: index % 15,
    anchors: Array.from({ length: 12 }, (_, step) => ({
      key: `a${((index + step * 17) % 79).toString(36)}`,
      meta: `m${((index * 3 + step * 5) % 61).toString(36)}`,
      section: `${step}-${((index + step) % 31).toString(36)}`,
    })),
    state: {
      mode: index % 2 === 0 ? 'layered' : 'folded',
      branch: `b${(index % 11).toString(36)}`,
      trace: Array.from({ length: 6 }, (_, traceStep) => ({
        step: traceStep,
        ref: `r${((index + traceStep * 7) % 47).toString(36)}`,
        markers: Array.from({ length: 5 }, (_, marker) => ({
          code: `${marker}-${((index + marker * 11) % 29).toString(36)}`,
          path: `p${((index + marker * 13) % 53).toString(36)}`,
        })),
      })),
    },
  })),
  registry: Object.fromEntries(
    Array.from({ length: 96 }, (_, index) => [
      `k${index.toString(36)}`,
      {
        raw: `${index}-${((index * 19) % 127).toString(36)}`,
        bucket: `bucket-${(index % 18).toString(36)}`,
        aliases: Array.from({ length: 9 }, (_, aliasIndex) => `alias-${aliasIndex}-${((index + aliasIndex * 13) % 37).toString(36)}`),
        summary: {
          channel: `c${(index % 17).toString(36)}`,
          layer: `l${((index * 5) % 23).toString(36)}`,
          score: (index * 19) % 131,
        },
      },
    ])
  ),
  rail: Array.from({ length: 320 }, (_, index) => ({
    a: `a${index.toString(36)}`,
    b: `b${((index * 3) % 71).toString(36)}`,
    c: `c${((index + 13) % 59).toString(36)}`,
    d: Array.from({ length: 11 }, (_, inner) => `d${((index * 17 + inner * 7) % 73).toString(36)}`),
  })),
  pipeline: Array.from({ length: 160 }, (_, index) => ({
    lane: `lane-${(index % 21).toString(36)}`,
    phase: `phase-${((index * 11) % 29).toString(36)}`,
    blocks: Array.from({ length: 7 }, (_, blockIndex) => ({
      id: `b${((index * 13 + blockIndex * 5) % 89).toString(36)}`,
      label: `block-${blockIndex}-${index.toString(36)}`,
      tokens: Array.from({ length: 4 }, (_, tokenIndex) => `token-${tokenIndex}-${((index + tokenIndex * 7) % 41).toString(36)}`),
    })),
  })),
})

void denseOverlay

const operativeGhost = (() => {
  const schema = Array.from({ length: 240 }, (_, index) => ({
    ordinal: index,
    key: `s${index.toString(36)}`,
    lane: `lane-${(index % 19).toString(36)}`,
    bucket: `bucket-${((index * 7) % 23).toString(36)}`,
    tokens: Array.from({ length: 8 }, (_, step) => ({
      id: `t${((index * 13 + step * 5) % 89).toString(36)}`,
      label: `seg-${step}-${((index + step * 11) % 31).toString(36)}`,
      weight: (index * 17 + step * 13) % 97,
    })),
  }))

  const matrix = Array.from({ length: 800 }, (_, index) => ({
    row: `r${index.toString(36)}`,
    rank: index % 17,
    clusters: Array.from({ length: 10 }, (_, clusterIndex) => ({
      cluster: `c${((index * 3 + clusterIndex * 11) % 59).toString(36)}`,
      tags: Array.from({ length: 6 }, (_, tagIndex) => ({
        id: `g${((index + tagIndex * 7) % 71).toString(36)}`,
        value: `${tagIndex}-${((index * 9 + tagIndex * 13) % 47).toString(36)}`,
      })),
    })),
    state: {
      phase: `p${(index % 11).toString(36)}`,
      region: `reg-${((index * 5) % 19).toString(36)}`,
      flux: Array.from({ length: 5 }, (_, fluxIndex) => ({
        ref: `f${((index * 7 + fluxIndex * 9) % 83).toString(36)}`,
        path: `path-${fluxIndex}-${((index + fluxIndex) % 29).toString(36)}`,
      })),
    },
  }))

  const registry = Object.fromEntries(
    Array.from({ length: 120 }, (_, index) => [
      `key-${index.toString(36)}`,
      {
        binding: `bind-${((index * 19) % 131).toString(36)}`,
        labels: Array.from({ length: 7 }, (_, aliasIndex) => `label-${aliasIndex}-${((index + aliasIndex * 13) % 37).toString(36)}`),
        summary: {
          level: `lvl-${(index % 15).toString(36)}`,
          signal: `sig-${((index * 5) % 23).toString(36)}`,
          load: (index * 29) % 107,
        },
      },
    ])
  )

  const logs = Array.from({ length: 340 }, (_, index) => ({
    id: `log-${index.toString(36)}`,
    stamp: `${index}-${((index * 13) % 97).toString(36)}`,
    frames: Array.from({ length: 9 }, (_, frameIndex) => ({
      node: `n${((index * 11 + frameIndex * 7) % 67).toString(36)}`,
      marker: `m${((index + frameIndex * 3) % 41).toString(36)}`,
      data: Array.from({ length: 4 }, (_, dataIndex) => `d${((index * 5 + frameIndex * 11 + dataIndex * 13) % 61).toString(36)}`),
    })),
  }))

  function derive(seed: number) {
    const base = seed % 97
    return Array.from({ length: 22 }, (_, itemIndex) => ({
      seed: seed + itemIndex,
      token: `x${((base + itemIndex * 7) % 101).toString(36)}`,
      lens: Array.from({ length: 5 }, (_, lensIndex) => `l${((base + lensIndex * 13 + itemIndex * 3) % 67).toString(36)}`),
    }))
  }

  return { schema, matrix, registry, logs, derive }
})()

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

void operativeGhost

export function AdminDashboard({ admin, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'newuser' | 'attendance' | 'payments' | 'members' | 'movements' | 'shared' | 'expiring' | 'settings' | 'qr'>(() => {
    const saved = localStorage.getItem('adminActiveTab')
    return (saved as any) || 'overview'
  })
  const [movements, setMovements] = useState<Movement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [assessments, setAssessments] = useState<AssessmentSession[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [sharedSubscriptions, setSharedSubscriptions] = useState<any[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [packages, setPackages] = useState<SubscriptionPackage[]>([])
  const [notifications, setNotifications] = useState<{id: string; message: string; time: Date}[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  const [classSessions, setClassSessions] = useState<ClassSession[]>([])
  const [classBookings, setClassBookings] = useState<ClassBooking[]>([])
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null)
  const [showSessionDetail, setShowSessionDetail] = useState(false)
  const [classSearch, setClassSearch] = useState('')
  const [rosterFilter, setRosterFilter] = useState<'all' | 'booked' | 'attended' | 'cancelled'>('all')
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return toDateInputValue(d)
  })
  const [exportTo, setExportTo] = useState(() => toDateInputValue(new Date()))
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [manualMemberId, setManualMemberId] = useState('')
  const [windowOffset, setWindowOffset] = useState(0) // 0 = this Fri->Fri, -1 previous, +1 next
  const [branches, setBranches] = useState<{id: string; name: string; location?: string}[]>([])
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [showAddMovement, setShowAddMovement] = useState(false)
  const [newMovementName, setNewMovementName] = useState('')
  const [newMovementDesc, setNewMovementDesc] = useState('')
  const [editingMovement, setEditingMovement] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({ totalMembers: 0, activeMembers: 0, totalMovements: 0, totalRecords: 0, todayCheckins: 0, todayQrCheckins: 0 })

  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentSession | null>(null)
  const [editDateTimeModal, setEditDateTimeModal] = useState<{ open: boolean; assessment: AssessmentSession | null; date: string; time: string }>({ open: false, assessment: null, date: '', time: '' })
  const [leadSearch, setLeadSearch] = useState('')
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | LeadStatus>('all')
  const [leadSort, setLeadSort] = useState<'newest' | 'oldest' | 'preferred' | 'name'>('newest')
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null)
  const [newUserForm, setNewUserForm] = useState({
    level: 'Warrior',
    date_of_birth: '',
    gender: '',
    training_goal: '',
    fitness_level: '',
    medical_notes: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: ''
  })

  const [showAddPayment, setShowAddPayment] = useState(false)
  const [newPayment, setNewPayment] = useState({ member_id: '', amount: '', payment_type: 'subscription', description: '' })

  const [selectedMemberForRecord, setSelectedMemberForRecord] = useState('')
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [newRecord, setNewRecord] = useState({ movement_id: '', record_type: 'reps', value: '', weight_used: '', notes: '' })

  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [memberSubForm, setMemberSubForm] = useState<{ package_id: string; sessions_remaining: string; start_date: string; end_date: string }>({ package_id: '', sessions_remaining: '', start_date: '', end_date: '' })
  const [memberPaymentForm, setMemberPaymentForm] = useState<{ amount: string; payment_type: string; description: string }>({ amount: '', payment_type: 'subscription', description: '' })

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [membersScrollPosition, setMembersScrollPosition] = useState(0)

  const generateMemberId = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('member_id')
        .order('member_id', { ascending: true })
      
      if (error) throw error
      
      // Parse valid T1 member IDs and extract numeric parts
      const validIds = (data || [])
        .filter(m => m.member_id?.startsWith('T1') && m.member_id.length >= 5)
        .map(m => {
          const numeric = parseInt(m.member_id.substring(2), 10)
          return { id: m.member_id, numeric, length: m.member_id.length }
        })
        .filter(m => !isNaN(m.numeric))
      
      // Get all 3-digit IDs in valid range (T1001-T1999)
      const threeDigitIds = validIds
        .filter(m => m.length === 5 && m.numeric >= 1 && m.numeric <= 999)
        .map(m => m.numeric)
        .sort((a, b) => a - b)
      
      // Find first available ID in 3-digit range (starting from 1)
      for (let i = 1; i <= 999; i++) {
        if (!threeDigitIds.includes(i)) {
          return `T1${i.toString().padStart(3, '0')}`
        }
      }
      
      // 3-digit range is full, check 4-digit range (10000-19999)
      const fourDigitIds = validIds
        .filter(m => m.length === 6 && m.numeric >= 10000 && m.numeric <= 19999)
        .map(m => m.numeric)
        .sort((a, b) => a - b)
      
      // Find first available ID in 4-digit range
      for (let i = 10000; i <= 19999; i++) {
        if (!fourDigitIds.includes(i)) {
          return `T1${i.toString().padStart(4, '0')}`
        }
      }
      
      // 4-digit range is full, check 5-digit range
      const fiveDigitIds = validIds
        .filter(m => m.length === 7 && m.numeric >= 20000 && m.numeric <= 99999)
        .map(m => m.numeric)
        .sort((a, b) => a - b)
      
      // Find first available ID in 5-digit range
      for (let i = 20000; i <= 99999; i++) {
        if (!fiveDigitIds.includes(i)) {
          return `T1${i.toString().padStart(5, '0')}`
        }
      }
      
      // All ranges full (very unlikely)
      return `T1${Date.now().toString().slice(-6)}`
      
    } catch (err) {
      console.error('Error generating member ID:', err)
      return `T1${String(Math.floor(100 + Math.random() * 900)).padStart(3, '0')}`
    }
  }

  const generatePin = () => {
    return String(Math.floor(1000 + Math.random() * 9000))
  }

    const getFridayWindow = (offset: number) => {
      const today = new Date()
      const day = today.getDay() // 0 Sun ... 6 Sat
      
      // We want to land on the most recent Friday.
      // Sun(0)->2, Mon(1)->3, Tue(2)->4, Wed(3)->5, Thu(4)->6, Fri(5)->0, Sat(6)->1
      const daysBack = [2, 3, 4, 5, 6, 0, 1]
      const diffToFriday = daysBack[day]
      
      const start = new Date(today)
      start.setDate(today.getDate() - diffToFriday + offset * 7)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      return { start, end }
    }

    const toLocalYYYYMMDD = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    const loadData = useCallback(async () => {
      const { start, end } = getFridayWindow(windowOffset)
      const startStr = toLocalYYYYMMDD(start)
      const endStr = toLocalYYYYMMDD(end)
      const today = toLocalYYYYMMDD(new Date())
    
    const [movementsRes, membersRes, recordsRes, assessmentsRes, attendanceRes, subscriptionsRes, paymentsRes, packagesRes, sessionsRes, bookingsRes, branchesRes, sharedSubsRes] = await Promise.all([
      supabase.from('movements').select('*').order('name'),
      supabase.from('members').select('id, member_id, full_name, phone, email, level, status, loyalty_points, pin, medical_notes, emergency_contact, branch_id').order('member_id', { ascending: false }),
      supabase.from('personal_records').select('*, member:members(full_name, member_id), movement:movements(name)').order('recorded_at', { ascending: false }),
      supabase.from('assessment_sessions').select('*').eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('attendance_records').select('*, member:members(full_name, member_id)').order('check_in_time', { ascending: false }).limit(50),
      supabase.from('member_subscriptions').select('*, package:subscription_packages(name, type), member:members(full_name, member_id)').order('end_date', { ascending: false }),
      supabase.from('manual_payments').select('*, member:members(full_name, member_id)').order('payment_date', { ascending: false }),
      supabase.from('subscription_packages').select('*'),
      supabase.from('class_sessions').select('*, group_class:group_classes(*)').gte('session_date', startStr).lt('session_date', endStr).order('session_date', { ascending: true }),
      supabase.from('class_bookings').select('*, member:members(full_name, member_id, phone, level), group_class:group_classes(*)').gte('class_date', startStr).lt('class_date', endStr),
      supabase.from('branches').select('id, name, location').order('name'),
      supabase.from('shared_subscription_members' as any).select(`
        member_id,
        shared_subscription:shared_subscriptions(
          id,
          sessions_total,
          sessions_remaining,
          status,
          end_date,
          package:subscription_packages(name)
        )
      `)
    ])

    if (movementsRes.data) setMovements(movementsRes.data)
    if (membersRes.data) {
      setMembers(membersRes.data)
      setStats(prev => ({
        ...prev,
        totalMembers: membersRes.data.length,
        activeMembers: membersRes.data.filter(m => m.status === 'active').length
      }))
    }
    if (movementsRes.data) {
      setStats(prev => ({ ...prev, totalMovements: movementsRes.data.filter(m => m.is_active).length }))
    }
    if (recordsRes.data) {
      setRecords(recordsRes.data)
      setStats(prev => ({ ...prev, totalRecords: recordsRes.data.length }))
    }
    if (assessmentsRes.data) setAssessments(assessmentsRes.data.filter(a => a.status === 'pending').map(a => ({ ...a, lead_status: (a as any).lead_status || 'not_contacted' })))
    if (attendanceRes.data) {
      setAttendance(attendanceRes.data)
      const todayCount = attendanceRes.data.filter(a => a.check_in_time.startsWith(today)).length
      const todayQrCount = attendanceRes.data.filter(a => a.check_in_method === 'qr' && a.check_in_time.startsWith(today)).length
      setStats(prev => ({ ...prev, todayCheckins: todayCount, todayQrCheckins: todayQrCount }))
    }
    if (subscriptionsRes.data) setSubscriptions(subscriptionsRes.data)
    if (sharedSubsRes.data) setSharedSubscriptions(sharedSubsRes.data)
    if (paymentsRes.data) setPayments(paymentsRes.data)
    if (packagesRes.data) setPackages(packagesRes.data)
    if (sessionsRes.data) {
      setClassSessions(sessionsRes.data)
      setSelectedSession(prev => prev || sessionsRes.data[0] || null)
    }
    if (bookingsRes.data) setClassBookings(bookingsRes.data)
    if (branchesRes.data) setBranches(branchesRes.data.map(b => ({
      id: b.id,
      name: b.name,
      location: b.location || ''
    })))
  }, [windowOffset])

  useEffect(() => {
    loadData()

    const attendanceChannel = supabase
      .channel('attendance-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_records' }, async (payload) => {
        const { data: memberData } = await supabase.from('members').select('full_name, member_id').eq('id', payload.new.member_id).single()
        if (memberData) {
          const newNotif = {
            id: payload.new.id,
            message: `${memberData.full_name} (${memberData.member_id}) checked in`,
            time: new Date()
          }
          setNotifications(prev => [newNotif, ...prev.slice(0, 9)])
        }
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(attendanceChannel)
    }
  }, [loadData])

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab)
  }, [activeTab])

  // Clear localStorage when component unmounts
  useEffect(() => {
    return () => {
      localStorage.removeItem('adminActiveTab')
    }
  }, [])

  // Restore scroll position when returning from member profile, or scroll to top when entering profile
  useEffect(() => {
    if (selectedMember) {
      // Scroll to top when entering member profile
      window.scrollTo(0, 0)
    } else if (membersScrollPosition > 0) {
      // Restore scroll position when returning to members list
      setTimeout(() => {
        window.scrollTo(0, membersScrollPosition)
      }, 0)
    }
  }, [selectedMember, membersScrollPosition])

  const handleConvertToMember = async () => {
    if (!selectedAssessment) return

    setIsSubmitting(true)
    try {
      const memberId = await generateMemberId()
      
      const emergencyContact = newUserForm.emergency_contact_name 
        ? JSON.stringify({
            name: newUserForm.emergency_contact_name,
            phone: newUserForm.emergency_contact_phone,
            relationship: newUserForm.emergency_contact_relationship
          })
        : null

      // Look up branch_id if branch name is provided
      let branchId = null
      if (selectedAssessment.branch) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('id')
          .eq('name', selectedAssessment.branch)
          .single()
        
        if (branchData) {
          branchId = branchData.id
        }
      }

      const { error: memberError } = await supabase.from('members').insert({
        member_id: memberId,
        full_name: selectedAssessment.full_name,
        phone: selectedAssessment.phone,
        email: selectedAssessment.email,
        pin: null,
        level: newUserForm.level,
        status: 'pending',
        branch_id: branchId,
        date_of_birth: newUserForm.date_of_birth || null,
        gender: newUserForm.gender || null,
        training_goal: newUserForm.training_goal || null,
        fitness_level: newUserForm.fitness_level || null,
        medical_notes: newUserForm.medical_notes || null,
        emergency_contact: emergencyContact,
        loyalty_points: 0
      })

      if (memberError) throw memberError

      await supabase.from('assessment_sessions').update({ status: 'converted', lead_status: 'booked' }).eq('id', selectedAssessment.id)

      setSelectedAssessment(null)
      setNewUserForm({ level: 'Warrior', date_of_birth: '', gender: '', training_goal: '', fitness_level: '', medical_notes: '', emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '' })
      loadData()
      alert(`Member created successfully! Member ID: ${memberId}\n\nThe user will need to activate their account using the "Activate Account" option on the login page to set their PIN.`)
    } catch (err: any) {
      console.error(err)
      alert(`Error creating member:\n\n${err?.message || JSON.stringify(err, null, 2)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPayment.member_id || !newPayment.amount) return

    setIsSubmitting(true)
    try {
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('member_id', newPayment.member_id.trim())
        .single()

      if (memberError || !member) {
        alert('Member not found. Please check the Member ID.')
        setIsSubmitting(false)
        return
      }

      const { error } = await supabase.from('manual_payments').insert({
        member_id: member.id,
        amount: parseFloat(newPayment.amount),
        payment_type: newPayment.payment_type,
        description: newPayment.description || null,
        recorded_by: admin.id
      })

      if (!error) {
        setShowAddPayment(false)
        setNewPayment({ member_id: '', amount: '', payment_type: 'subscription', description: '' })
        loadData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }


  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberForRecord || !newRecord.movement_id || !newRecord.value) return

    setIsSubmitting(true)
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('member_id', selectedMemberForRecord.trim())
        .single()

      if (memberError || !memberData) {
        alert('Member not found. Please check the Member ID.')
        setIsSubmitting(false)
        return
      }

      const { error } = await supabase.from('personal_records').insert({
        member_id: memberData.id,
        movement_id: newRecord.movement_id,
        record_type: newRecord.record_type,
        value: parseFloat(newRecord.value),
        weight_used: newRecord.weight_used ? parseFloat(newRecord.weight_used) : null,
        notes: newRecord.notes || null,
        recorded_at: new Date().toISOString()
      })

      if (!error) {
        setShowAddRecord(false)
        setNewRecord({ movement_id: '', record_type: 'reps', value: '', weight_used: '', notes: '' })
        setSelectedMemberForRecord('')
        loadData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRecord = async (id: string) => {
    const { error } = await supabase.from('personal_records').delete().eq('id', id)
    if (!error) loadData()
  }

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMovementName.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('movements').insert({
        name: newMovementName.trim(),
        description: newMovementDesc.trim() || null,
        is_active: true
      })

      if (!error) {
        loadData()
        setShowAddMovement(false)
        setNewMovementName('')
        setNewMovementDesc('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateMovement = async (id: string) => {
    if (!editName.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('movements').update({
        name: editName.trim(),
        description: editDesc.trim() || null
      }).eq('id', id)

      if (!error) {
        loadData()
        setEditingMovement(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleMovement = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('movements').update({
      is_active: !currentStatus
    }).eq('id', id)

    if (!error) loadData()
  }

  const handleDeleteMovement = async (id: string) => {
    const { error } = await supabase.from('movements').delete().eq('id', id)
    if (!error) loadData()
  }

  const startEditing = (movement: Movement) => {
    setEditingMovement(movement.id)
    setEditName(movement.name)
    setEditDesc(movement.description || '')
  }

  const filteredMembers = members.filter(m => 
    (m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.member_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone.includes(searchTerm)) &&
    (branchFilter === 'all' || m.branch_id === branchFilter) &&
    (levelFilter === 'all' || m.level === levelFilter)
  )

  const uniqueLevels = Array.from(new Set(members.map(m => m.level).filter(level => level && level.trim()))).sort()

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatClock = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours, 10)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const getLeadStatus = (a: AssessmentSession): LeadStatus => {
    const s = (a.lead_status || 'not_contacted') as string
    return (['not_contacted', 'contacted', 'no_answer', 'booked'] as LeadStatus[]).includes(s as LeadStatus)
      ? (s as LeadStatus)
      : 'not_contacted'
  }

  const leadStatusStyle = (s: LeadStatus) => {
    switch (s) {
      case 'contacted': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'no_answer': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'booked': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
  }

  const formatBookingTime = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 'Unknown'
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  }

  const handleLeadStatusChange = async (assessment: AssessmentSession, next: LeadStatus) => {
    const prev = getLeadStatus(assessment)
    if (prev === next) return
    setUpdatingLeadId(assessment.id)
    setAssessments(list => list.map(a => a.id === assessment.id ? { ...a, lead_status: next } : a))
    try {
      const { error } = await supabase.from('assessment_sessions').update({ lead_status: next }).eq('id', assessment.id)
      if (error) throw error
    } catch (err: any) {
      console.error('Failed to update lead status:', err)
      setAssessments(list => list.map(a => a.id === assessment.id ? { ...a, lead_status: prev } : a))
      alert('Could not save lead status. If this persists, run supabase/migrations/20260919_lead_status.sql in your Supabase project.')
    } finally {
      setUpdatingLeadId(null)
    }
  }

  const filteredLeads = assessments
    .filter(a => {
      if (leadStatusFilter !== 'all' && getLeadStatus(a) !== leadStatusFilter) return false
      const q = leadSearch.trim().toLowerCase()
      if (!q) return true
      return a.full_name.toLowerCase().includes(q) || a.phone.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      switch (leadSort) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name': return a.full_name.localeCompare(b.full_name)
        case 'preferred': {
          const ad = a.preferred_date ? new Date(`${a.preferred_date}T${a.preferred_time || '00:00'}`).getTime() : Number.MAX_SAFE_INTEGER
          const bd = b.preferred_date ? new Date(`${b.preferred_date}T${b.preferred_time || '00:00'}`).getTime() : Number.MAX_SAFE_INTEGER
          return ad - bd
        }
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  const handleExportAttendance = async () => {
    if (!exportFrom || !exportTo) {
      setExportMessage('Pick both a start and an end date.')
      return
    }
    if (exportFrom > exportTo) {
      setExportMessage('The start date must be on or before the end date.')
      return
    }

    setIsExporting(true)
    setExportMessage(null)

    try {
      // Local day boundaries, converted to the timestamps stored in the table
      const fromIso = new Date(`${exportFrom}T00:00:00`).toISOString()
      const toIso = new Date(`${exportTo}T23:59:59.999`).toISOString()

      const pageSize = 1000
      let rows: AttendanceRecord[] = []
      let start = 0

      while (true) {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('id, check_in_time, check_in_method, branch_id, member:members(full_name, member_id)')
          .gte('check_in_time', fromIso)
          .lte('check_in_time', toIso)
          .order('check_in_time', { ascending: true })
          .range(start, start + pageSize - 1)

        if (error) throw error

        const batch = (data as AttendanceRecord[]) || []
        rows = rows.concat(batch)
        if (batch.length < pageSize) break
        start += pageSize
      }

      if (rows.length === 0) {
        setExportMessage('No check-ins found in that period.')
        return
      }

      const cell = (value: unknown) => {
        const text = value === null || value === undefined ? '' : String(value)
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
      }

      const pad = (n: number) => String(n).padStart(2, '0')
      const lines: string[][] = [['Date', 'Time', 'Member ID', 'Member Name', 'Method', 'Branch', 'Checked in at']]

      for (const row of rows) {
        const at = new Date(row.check_in_time)
        lines.push([
          `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
          `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`,
          row.member?.member_id ?? '',
          row.member?.full_name ?? '',
          row.check_in_method ?? '',
          branches.find(b => b.id === row.branch_id)?.name ?? '',
          row.check_in_time
        ])
      }

      // BOM so Excel reads the file as UTF-8
      const csv = lines.map(line => line.map(cell).join(',')).join('\r\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `attendance_${exportFrom}_to_${exportTo}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportMessage(`Exported ${rows.length} check-in${rows.length === 1 ? '' : 's'}.`)
    } catch (err) {
      setExportMessage(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const getDayName = (day: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days[day]
  }

  const getFirstName = (full: string | undefined) => {
    if (!full) return ''
    return full.split(' ')[0]
  }

  const formatWindowLabel = (offset: number) => {
    if (offset === 0) return 'This Fri–Fri'
    if (offset === -1) return 'Prev Fri–Fri'
    if (offset === 1) return 'Next Fri–Fri'
    return offset > 1 ? `+${offset}w` : `${offset}w`
  }

  const formatWindowDates = (offset: number) => {
    const { start, end } = getFridayWindow(offset)
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    const startStr = start.toLocaleDateString('en-US', opts)
    const endStr = end.toLocaleDateString('en-US', opts)
    return `${startStr} – ${endStr}`
  }

  const getSessionBookings = (session: ClassSession | null) => {
    if (!session) return []
    return classBookings.filter(b => b.class_id === session.group_class_id && b.class_date === session.session_date)
  }

  const getSessionStats = (session: ClassSession | null) => {
    const bookings = getSessionBookings(session)
    const booked = bookings.filter(b => b.status === 'booked').length
    const attended = bookings.filter(b => b.status === 'attended').length
    return { booked, attended }
  }

  const handleManualAttend = async () => {
    if (!selectedSession || !manualMemberId.trim()) return

    const code = manualMemberId.trim().toUpperCase()
    const booking = classBookings.find(b =>
      b.class_id === selectedSession.group_class_id &&
      b.class_date === selectedSession.session_date &&
      b.member?.member_id.toUpperCase() === code
    )

    try {
      const now = new Date().toISOString()

      let targetBooking = booking
      if (!targetBooking) {
        const { data: memberRow } = await supabase.from('members').select('id').eq('member_id', code).single()
        if (!memberRow) {
          alert('Member not found')
          return
        }
        const { data: created, error: insertErr } = await supabase
          .from('class_bookings')
          .insert({
            class_id: selectedSession.group_class_id,
            member_id: memberRow.id,
            class_date: selectedSession.session_date,
            status: 'attended',
            checked_in_at: now,
            session_id: selectedSession.id
          })
          .select('*, member:members(full_name, member_id, phone, level), group_class:group_classes(*)')
          .single()
        if (insertErr || !created) throw insertErr
        targetBooking = created as ClassBooking
        setClassBookings(prev => [...prev, targetBooking!])
      } else {
        if (targetBooking.status === 'attended') {
          alert('Already marked attended')
          return
        }
        if (targetBooking.status === 'cancelled') {
          alert('Booking was cancelled. Restore booking first.')
          return
        }
        const { error } = await supabase
          .from('class_bookings')
          .update({ status: 'attended', checked_in_at: now, session_id: selectedSession.id })
          .eq('id', targetBooking.id)
        if (error) throw error
        setClassBookings(prev => prev.map(b => b.id === targetBooking.id ? { ...b, status: 'attended', checked_in_at: now, session_id: selectedSession.id } : b))
      }

      const { data: insertedAttendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .insert({
          member_id: targetBooking.member_id,
          check_in_time: now,
          check_in_method: 'admin',
          class_booking_id: targetBooking.id,
          session_id: selectedSession.id
        })
        .select('id')
        .single()
      if (attendanceError) throw attendanceError

      // Deduct session from subscription
      const { data: subscription, error: subError } = await supabase
        .from('member_subscriptions')
        .select('*, package:subscription_packages(type)')
        .eq('member_id', targetBooking.member_id)
        .eq('status', 'active')
        .single()

      let sharedSubscription = null
      if (subError || !subscription) {
        // Check for shared subscription if no personal subscription
        const { data: sharedSubData } = await supabase
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
              package:subscription_packages(type)
            )
          `)
          .eq('member_id', targetBooking.member_id)
        
        if (sharedSubData && sharedSubData.length > 0) {
          // Sort by end_date descending to get the most recent subscription
          const sorted = sharedSubData.sort((a: any, b: any) => {
            const aDate = new Date(a.shared_subscription?.end_date || 0)
            const bDate = new Date(b.shared_subscription?.end_date || 0)
            return bDate.getTime() - aDate.getTime()
          })
          sharedSubscription = sorted[0]?.shared_subscription
        }
      }

      const activeSub = subscription || sharedSubscription
      const isShared = !!sharedSubscription

      if (activeSub) {
        const isSessionBased = activeSub.package?.type === 'session'
        if (isSessionBased && activeSub.sessions_remaining !== null && activeSub.sessions_remaining > 0) {
          const newSessionsRemaining = activeSub.sessions_remaining - 1
          
          if (isShared && sharedSubscription) {
            // Update shared subscription pool
            const { error: sharedUpdateError } = await supabase
              .from('shared_subscriptions' as any)
              .update({ sessions_remaining: newSessionsRemaining })
              .eq('id', sharedSubscription.id)
            if (sharedUpdateError) throw sharedUpdateError
            
            // Record the deduction
            const { error: deductionError } = await supabase.from('session_deductions' as any).insert({
              member_id: targetBooking.member_id,
              source_type: 'shared',
              source_id: sharedSubscription.id,
              booking_id: targetBooking.id,
              attendance_id: insertedAttendance?.id || null,
              session_id: selectedSession?.id || null,
              action: 'deduct',
              created_at: now
            })
            if (deductionError) console.error('Failed to record deduction:', deductionError)
          } else if (subscription) {
            // Update personal subscription
            const { error: updateError } = await supabase
              .from('member_subscriptions')
              .update({ sessions_remaining: newSessionsRemaining })
              .eq('id', subscription.id)
            if (updateError) throw updateError
          }
        }
      }

      setManualMemberId('')
    } catch (err) {
      console.error(err)
      alert('Failed to mark attendance')
    }
  }

  const handleRosterToggle = async (booking: ClassBooking, toAttended: boolean) => {
    try {
      const now = new Date().toISOString()
      if (toAttended) {
        const { error } = await supabase
          .from('class_bookings')
          .update({ status: 'attended', checked_in_at: now, session_id: selectedSession?.id || null })
          .eq('id', booking.id)
        if (error) throw error
        const { data: insertedAttendance, error: attendanceError } = await supabase
          .from('attendance_records')
          .insert({
            member_id: booking.member_id,
            check_in_time: now,
            check_in_method: 'admin',
            class_booking_id: booking.id,
            session_id: selectedSession?.id || null
          })
          .select('id')
          .single()
        if (attendanceError) throw attendanceError

        // Deduct session from subscription
        const { data: subscription, error: subError } = await supabase
          .from('member_subscriptions')
          .select('*, package:subscription_packages(type)')
          .eq('member_id', booking.member_id)
          .eq('status', 'active')
          .single()

        let sharedSubscription = null
        if (subError || !subscription) {
          // Check for shared subscription if no personal subscription
          const { data: sharedSubData } = await supabase
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
                package:subscription_packages(type)
              )
            `)
            .eq('member_id', booking.member_id)
          
          if (sharedSubData && sharedSubData.length > 0) {
            // Sort by end_date descending to get the most recent subscription
            const sorted = sharedSubData.sort((a: any, b: any) => {
              const aDate = new Date(a.shared_subscription?.end_date || 0)
              const bDate = new Date(b.shared_subscription?.end_date || 0)
              return bDate.getTime() - aDate.getTime()
            })
            sharedSubscription = sorted[0]?.shared_subscription
          }
        }

        const activeSub = subscription || sharedSubscription
        const isShared = !!sharedSubscription

        if (activeSub) {
          const isSessionBased = activeSub.package?.type === 'session'
          if (isSessionBased && activeSub.sessions_remaining !== null && activeSub.sessions_remaining > 0) {
            const newSessionsRemaining = activeSub.sessions_remaining - 1
            
            if (isShared && sharedSubscription) {
              // Update shared subscription pool
              const { error: sharedUpdateError } = await supabase
                .from('shared_subscriptions' as any)
                .update({ sessions_remaining: newSessionsRemaining })
                .eq('id', sharedSubscription.id)
              if (sharedUpdateError) throw sharedUpdateError
              
              // Record the deduction
              const { error: deductionError } = await supabase.from('session_deductions' as any).insert({
                member_id: booking.member_id,
                source_type: 'shared',
                source_id: sharedSubscription.id,
                booking_id: booking.id,
                attendance_id: insertedAttendance?.id || null,
                session_id: selectedSession?.id || null,
                action: 'deduct',
                created_at: now
              })
              if (deductionError) console.error('Failed to record deduction:', deductionError)
            } else if (subscription) {
              // Update personal subscription
              const { error: updateError } = await supabase
                .from('member_subscriptions')
                .update({ sessions_remaining: newSessionsRemaining })
                .eq('id', subscription.id)
              if (updateError) throw updateError
            }
          }
        }

        setClassBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'attended', checked_in_at: now, session_id: selectedSession?.id || null } : b))
      } else {
        const { error } = await supabase
          .from('class_bookings')
          .update({ status: 'booked', checked_in_at: null, session_id: selectedSession?.id || null })
          .eq('id', booking.id)
        if (error) throw error

        const { data: attendanceRow } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('class_booking_id', booking.id)
          .single()

        await supabase.from('attendance_records').delete().eq('class_booking_id', booking.id)

        // Add session back to subscription
        const { data: subscription, error: subError } = await supabase
          .from('member_subscriptions')
          .select('*, package:subscription_packages(type)')
          .eq('member_id', booking.member_id)
          .eq('status', 'active')
          .single()

        let sharedSubscription = null
        if (subError || !subscription) {
          // Check for shared subscription if no personal subscription
          const { data: sharedSubData } = await supabase
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
                package:subscription_packages(type)
              )
            `)
            .eq('member_id', booking.member_id)
          
          if (sharedSubData && sharedSubData.length > 0) {
            // Sort by end_date descending to get the most recent subscription
            const sorted = sharedSubData.sort((a: any, b: any) => {
              const aDate = new Date(a.shared_subscription?.end_date || 0)
              const bDate = new Date(b.shared_subscription?.end_date || 0)
              return bDate.getTime() - aDate.getTime()
            })
            sharedSubscription = sorted[0]?.shared_subscription
          }
        }

        const activeSub = subscription || sharedSubscription
        const isShared = !!sharedSubscription

        if (activeSub) {
          const isSessionBased = activeSub.package?.type === 'session'
          if (isSessionBased && activeSub.sessions_remaining !== null) {
            const newSessionsRemaining = activeSub.sessions_remaining + 1
            
            if (isShared && sharedSubscription) {
              // Update shared subscription pool
              const { error: sharedUpdateError } = await supabase
                .from('shared_subscriptions' as any)
                .update({ sessions_remaining: newSessionsRemaining })
                .eq('id', sharedSubscription.id)
              if (sharedUpdateError) throw sharedUpdateError

              // Remove the matching deduction so shared usage stays correct
              let deductionDeleted = false
              const { data: deletedByBooking, error: deleteByBookingError } = await supabase
                .from('session_deductions' as any)
                .delete()
                .eq('source_type', 'shared')
                .eq('source_id', sharedSubscription.id)
                .eq('booking_id', booking.id)
                .eq('action', 'deduct')
                .select('id')

              if (!deleteByBookingError && deletedByBooking && deletedByBooking.length > 0) {
                deductionDeleted = true
              }

              if (!deductionDeleted && attendanceRow?.id) {
                const { data: deletedByAttendance, error: deleteByAttendanceError } = await supabase
                  .from('session_deductions' as any)
                  .delete()
                  .eq('attendance_id', attendanceRow.id)
                  .eq('action', 'deduct')
                  .select('id')
                if (!deleteByAttendanceError && deletedByAttendance && deletedByAttendance.length > 0) {
                  deductionDeleted = true
                }
              }

              if (!deductionDeleted) {
                const { data: latestDeduction } = await supabase
                  .from('session_deductions' as any)
                  .select('id')
                  .eq('member_id', booking.member_id)
                  .eq('source_type', 'shared')
                  .eq('source_id', sharedSubscription.id)
                  .eq('action', 'deduct')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()

                if (latestDeduction?.id) {
                  const { error: deleteByIdError } = await supabase
                    .from('session_deductions' as any)
                    .delete()
                    .eq('id', latestDeduction.id)
                  if (deleteByIdError) console.error('Failed to delete deduction entry:', deleteByIdError)
                }
              }
            } else if (subscription) {
              // Update personal subscription
              const { error: updateError } = await supabase
                .from('member_subscriptions')
                .update({ sessions_remaining: newSessionsRemaining })
                .eq('id', subscription.id)
              if (updateError) throw updateError
            }
          }
        }

        setClassBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'booked', checked_in_at: null } : b))
      }
    } catch (err) {
      console.error(err)
      alert('Unable to update attendance')
    }
  }

  const handleCancelClass = async (session: ClassSession) => {
    if (!confirm(`Are you sure you want to cancel the "${session.group_class?.name}" class on ${formatDate(session.session_date)}? This will cancel all bookings and restore sessions for attended members.`)) {
      return
    }

    try {
      // Update class session status to cancelled
      const { error: sessionError } = await supabase
        .from('class_sessions')
        .update({ status: 'cancelled' })
        .eq('id', session.id)
      
      if (sessionError) throw sessionError

      // Get all bookings for this session
      const sessionBookings = getSessionBookings(session)
      
      // Cancel all bookings
      const { error: bookingsError } = await supabase
        .from('class_bookings')
        .update({ status: 'cancelled' })
        .eq('class_id', session.group_class_id)
        .eq('class_date', session.session_date)
      
      if (bookingsError) throw bookingsError

      // Restore sessions for attended bookings
      const attendedBookings = sessionBookings.filter(b => b.status === 'attended')
      
      for (const booking of attendedBookings) {
        // Check if it's a shared subscription
        const { data: sharedSubscription } = await supabase
          .from('shared_subscription_members' as any)
          .select('shared_subscription:shared_subscriptions(*)')
          .eq('member_id', booking.member_id)
          .eq('shared_subscription.sessions_total', booking.session_id)
          .single()
        
        if (sharedSubscription) {
          // Update shared subscription
          const { error: sharedUpdateError } = await supabase
            .from('shared_subscriptions')
            .update({ sessions_remaining: (sharedSubscription.shared_subscription.sessions_remaining || 0) + 1 })
            .eq('id', sharedSubscription.shared_subscription.id)
          if (sharedUpdateError) throw sharedUpdateError
          
          // Record the restoration
          const { error: restoreError } = await supabase.from('session_deductions' as any).insert({
            member_id: booking.member_id,
            source_type: 'shared',
            source_id: sharedSubscription.shared_subscription.id,
            action: 'restore',
            created_at: new Date().toISOString()
          })
          if (restoreError) console.error('Failed to record restoration:', restoreError)
        } else {
          // Update personal subscription
          const { data: subscription } = await supabase
            .from('member_subscriptions')
            .select('*')
            .eq('member_id', booking.member_id)
            .eq('status', 'active')
            .single()
          
          if (subscription) {
            const { error: updateError } = await supabase
              .from('member_subscriptions')
              .update({ sessions_remaining: (subscription.sessions_remaining || 0) + 1 })
              .eq('id', subscription.id)
            if (updateError) throw updateError
          }
        }
      }

      // Update local state
      setClassSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: 'cancelled' } : s))
      setClassBookings(prev => prev.map(b => 
        b.class_id === session.group_class_id && b.class_date === session.session_date 
          ? { ...b, status: 'cancelled' } : b
      ))

      alert('Class cancelled successfully. All bookings have been cancelled and sessions restored for attended members.')
    } catch (err) {
      console.error('Failed to cancel class:', err)
      alert('Failed to cancel class. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-t1-black text-t1-cream pb-24 overflow-y-auto">
      <div className="sticky top-0 z-40 bg-gradient-to-r from-t1-red/20 to-t1-dark-red/20 border-b border-t1-red/20 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-t1 flex items-center justify-center">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-spin [animation-duration:3s]" />
              </div>
              <div>
                <h2 className="font-cinzel font-bold text-sm sm:text-base">Admin Panel</h2>
                <p className="text-xs text-muted-foreground hidden sm:block">{admin.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl bg-secondary border border-t1-red/20"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-t1-red text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
              <Button
                onClick={() => window.open('https://coach.tripleonebars.com/?lang=en', '_blank')}
                variant="outline"
                className="bg-transparent border-t1-gold/40 text-t1-gold hover:text-t1-cream rounded-xl text-xs sm:text-sm px-2 sm:px-4"
              >
                Coaching
              </Button>
              <Button
                onClick={onLogout}
                variant="outline"
                className="bg-transparent border-t1-red/30 text-t1-cream rounded-xl text-xs sm:text-sm px-2 sm:px-4"
              >
                Logout
              </Button>
            </div>
          </div>

          {showNotifications && notifications.length > 0 && (
            <div className="mt-4 bg-secondary rounded-2xl p-4 border border-t1-red/20">
              <h3 className="font-cinzel font-semibold mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-t1-red" />
                Recent Check-ins
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notifications.map(notif => (
                  <div key={notif.id} className="flex items-center justify-between text-sm py-2 border-b border-t1-red/10 last:border-0">
                    <span>{notif.message}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(notif.time.toISOString())}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'overview' && (
          <>
            <h2 className="text-xl font-cinzel font-bold">Dashboard Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
                <Users className="w-6 h-6 text-t1-red mb-2" />
                <p className="text-2xl font-cinzel font-bold">{stats.totalMembers}</p>
                <p className="text-xs text-muted-foreground">Total Members</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
                <Users className="w-6 h-6 text-emerald-500 mb-2" />
                <p className="text-2xl font-cinzel font-bold">{stats.activeMembers}</p>
                <p className="text-xs text-muted-foreground">Active Members</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
                <Activity className="w-6 h-6 text-blue-500 mb-2" />
                <p className="text-2xl font-cinzel font-bold">{stats.todayCheckins}</p>
                <p className="text-xs text-muted-foreground">Today Check-ins</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
                <Dumbbell className="w-6 h-6 text-t1-gold mb-2" />
                <p className="text-2xl font-cinzel font-bold">{stats.totalMovements}</p>
                <p className="text-xs text-muted-foreground">Movements</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
                <TrendingUp className="w-6 h-6 text-purple-500 mb-2" />
                <p className="text-2xl font-cinzel font-bold">{stats.totalRecords}</p>
                <p className="text-xs text-muted-foreground">Personal Records</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-cinzel font-semibold text-lg">Quick Actions</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('expiring')}
                  className="bg-secondary rounded-2xl p-5 border border-t1-red/10 hover:border-t1-red/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <h4 className="font-cinzel font-semibold group-hover:text-t1-gold transition-colors">Expiring Soon</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">Members with low sessions or expiring subscriptions</p>
                </button>

                <button
                  onClick={() => setActiveTab('shared')}
                  className="bg-secondary rounded-2xl p-5 border border-t1-red/10 hover:border-t1-red/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <h4 className="font-cinzel font-semibold group-hover:text-t1-gold transition-colors">Shared Subscriptions</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">Create shared pools and manage members & usage</p>
                </button>

                <button
                  onClick={() => setActiveTab('movements')}
                  className="bg-secondary rounded-2xl p-5 border border-t1-red/10 hover:border-t1-red/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-t1-red/20">
                      <Dumbbell className="w-5 h-5 text-t1-red" />
                    </div>
                    <h4 className="font-cinzel font-semibold group-hover:text-t1-gold transition-colors">Movements</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">Manage exercises for personal records</p>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-cinzel font-semibold flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-t1-gold" />
                    Pending Leads
                  </h3>
                  <button onClick={() => setActiveTab('newuser')} className="text-xs text-t1-red flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  {assessments.slice(0, 3).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-t1-red/10 last:border-0 gap-2">
                      <div>
                        <p className="font-semibold text-sm">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.phone} • Booked {formatBookingTime(a.created_at)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${leadStatusStyle(getLeadStatus(a))}`}>
                        {LEAD_STATUS_OPTIONS.find(o => o.value === getLeadStatus(a))?.label || 'Pending'}
                      </span>
                    </div>
                  ))}
                  {assessments.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No pending leads</p>
                  )}
                </div>
              </div>

              <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-cinzel font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Recent Check-ins
                  </h3>
                  <button onClick={() => setActiveTab('attendance')} className="text-xs text-t1-red flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  {attendance.slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-t1-red/10 last:border-0">
                      <div>
                        <p className="font-semibold text-sm">{a.member?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.member?.member_id}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatTime(a.check_in_time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-cinzel font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  Recent Payments
                </h3>
                <button onClick={() => setActiveTab('payments')} className="text-xs text-t1-red flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {showAddPayment ? (
                <form onSubmit={handleAddPayment} className="space-y-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Member ID *</Label>
                      <Input
                        value={newPayment.member_id}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, member_id: e.target.value }))}
                        placeholder="e.g., T12345"
                        className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Amount (EGP) *</Label>
                      <Input
                        type="number"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Payment Type</Label>
                      <select
                        value={newPayment.payment_type}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, payment_type: e.target.value }))}
                        className="w-full h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-4"
                      >
                        <option value="subscription">Subscription</option>
                        <option value="session">Session</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Description</Label>
                      <Input
                        value={newPayment.description}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional notes"
                        className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting} size="sm" className="bg-gradient-t1 text-white rounded-xl font-cinzel">
                      {isSubmitting ? 'Recording...' : 'Record Payment'}
                    </Button>
                    <Button type="button" onClick={() => setShowAddPayment(false)} size="sm" variant="outline" className="bg-transparent border-t1-red/30 text-t1-cream rounded-xl">
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  onClick={() => setShowAddPayment(true)}
                  size="sm"
                  className="bg-gradient-t1 text-white rounded-xl font-cinzel text-xs mb-4"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Record Payment
                </Button>
              )}
              <div className="space-y-3">
                {payments.slice(0, 5).map(payment => (
                  <div key={payment.id} className="flex items-center justify-between py-2 border-b border-t1-red/10 last:border-0">
                    <div>
                      <p className="font-semibold text-sm">{payment.member?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{payment.payment_type} • {payment.description || 'No note'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">{payment.amount} EGP</p>
                      <p className="text-xs text-muted-foreground">{formatDate(payment.payment_date)}</p>
                    </div>
                  </div>
                ))}
                {payments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet</p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'newuser' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button 
                onClick={() => selectedAssessment ? setSelectedAssessment(null) : setActiveTab('overview')} 
                className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-t1-cream" />
              </button>
              <h2 className="text-xl font-cinzel font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-t1-gold" />
                Lead Conversion
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">Convert assessment signups into full members with Member IDs</p>

            {selectedAssessment ? (
              <div className="bg-secondary rounded-2xl p-5 border border-t1-red/30">
                <h3 className="font-cinzel font-semibold mb-4">Complete Registration for {selectedAssessment.full_name}</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-t1-black/50 rounded-xl">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-semibold">{selectedAssessment.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-semibold">{selectedAssessment.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-semibold">{selectedAssessment.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Branch</p>
                    <p className="font-semibold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-t1-gold" />
                      <span className="text-t1-gold">{selectedAssessment.branch || 'Not specified'}</span>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Preferred Date/Time</p>
                    <p className="font-semibold">{selectedAssessment.preferred_date || 'N/A'} {selectedAssessment.preferred_time ? `at ${selectedAssessment.preferred_time}` : ''}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Member Level *</Label>
                      <select
                        value={newUserForm.level}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, level: e.target.value }))}
                        className="w-full h-12 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-4"
                      >
                          <option value="Warrior">Warrior</option>
                          <option value="Spartan">Spartan</option>
                          <option value="Legend">Legend</option>
                          <option value="Ladies">Ladies</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Date of Birth</Label>
                      <Input
                        type="date"
                        value={newUserForm.date_of_birth}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                        className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Gender</Label>
                      <select
                        value={newUserForm.gender}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, gender: e.target.value }))}
                        className="w-full h-12 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-4"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-t1-cream">Fitness Level</Label>
                      <select
                        value={newUserForm.fitness_level}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, fitness_level: e.target.value }))}
                        className="w-full h-12 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-4"
                      >
                        <option value="">Select</option>
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-t1-cream">Training Goal</Label>
                    <Input
                      value={newUserForm.training_goal}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, training_goal: e.target.value }))}
                      placeholder="e.g., Build muscle, Lose weight"
                      className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-t1-cream">Medical Notes (optional)</Label>
                    <Input
                      value={newUserForm.medical_notes}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, medical_notes: e.target.value }))}
                      placeholder="Any medical conditions or special requirements"
                      className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-t1-cream">Emergency Contact (optional)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={newUserForm.emergency_contact_name}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                        placeholder="Name"
                        className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      />
                      <Input
                        value={newUserForm.emergency_contact_phone}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                        placeholder="Phone"
                        className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      />
                      <select
                        value={newUserForm.emergency_contact_relationship}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, emergency_contact_relationship: e.target.value }))}
                        className="w-full h-12 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-4"
                      >
                        <option value="">Relationship</option>
                        <option value="Parent">Parent</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Friend">Friend</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleConvertToMember}
                      disabled={isSubmitting}
                      className="bg-gradient-t1 text-white rounded-xl font-cinzel flex-1"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Member & Generate ID'}
                    </Button>
                    <Button
                      onClick={() => setSelectedAssessment(null)}
                      variant="outline"
                      className="bg-transparent border-t1-red/30 text-t1-cream rounded-xl"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={leadSearch}
                        onChange={(e) => setLeadSearch(e.target.value)}
                        placeholder="Search name, phone, email..."
                        className="h-10 pl-9 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      />
                    </div>
                    <select
                      value={leadStatusFilter}
                      onChange={(e) => setLeadStatusFilter(e.target.value as 'all' | LeadStatus)}
                      className="h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-3"
                    >
                      <option value="all">All statuses ({assessments.length})</option>
                      {LEAD_STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label} ({assessments.filter(a => getLeadStatus(a) === o.value).length})</option>
                      ))}
                    </select>
                    <select
                      value={leadSort}
                      onChange={(e) => setLeadSort(e.target.value as 'newest' | 'oldest' | 'preferred' | 'name')}
                      className="h-10 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-3"
                    >
                      <option value="newest">Sort: Newest booking first</option>
                      <option value="oldest">Sort: Oldest booking first</option>
                      <option value="preferred">Sort: Preferred session date</option>
                      <option value="name">Sort: Name A–Z</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">Showing {filteredLeads.length} of {assessments.length} leads</p>
                </div>
                {filteredLeads.map(assessment => {
                  const ls = getLeadStatus(assessment)
                  return (
                  <div key={assessment.id} className={`bg-secondary rounded-2xl p-4 border ${assessment.confirmed ? 'border-emerald-500/30' : 'border-t1-red/10'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${assessment.confirmed ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/30' : 'bg-gradient-to-br from-amber-500/30 to-amber-600/30'}`}>
                            <UserPlus className={`w-4 h-4 ${assessment.confirmed ? 'text-emerald-400' : 'text-amber-400'}`} />
                          </div>
                          <h3 className="font-cinzel font-semibold text-base">{assessment.full_name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${leadStatusStyle(ls)}`}>
                            {LEAD_STATUS_OPTIONS.find(o => o.value === ls)?.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{assessment.phone} • {assessment.email || 'No email'}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {assessment.branch && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-t1-gold/20 border border-t1-gold/30">
                              <MapPin className="w-3 h-3 text-t1-gold" />
                              <span className="text-xs text-t1-gold font-semibold">{branches.find(b => b.id === assessment.branch)?.name || assessment.branch}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-t1-red" />
                            <span className="text-xs text-t1-cream font-semibold">
                              {assessment.preferred_date || 'No date'} {assessment.preferred_time ? `at ${assessment.preferred_time}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Booked: {formatBookingTime(assessment.created_at)}</span>
                          </div>
                          {assessment.confirmed && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                              Confirmed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Label className="text-xs text-muted-foreground">Status:</Label>
                          <select
                            value={ls}
                            disabled={updatingLeadId === assessment.id}
                            onChange={(e) => handleLeadStatusChange(assessment, e.target.value as LeadStatus)}
                            className="h-9 bg-t1-black border border-t1-red/20 text-t1-cream rounded-lg px-2 text-xs"
                          >
                            {LEAD_STATUS_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          {updatingLeadId === assessment.id && <span className="text-xs text-muted-foreground">Saving...</span>}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => window.open(`tel:${assessment.phone}`, '_self')}
                          className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            const phone = assessment.phone.replace(/[^0-9]/g, '')
                            const formattedPhone = phone.startsWith('0') ? '2' + phone : phone
                            const url = `https://wa.me/${formattedPhone}`
                            window.open(url, '_blank')
                          }}
                          className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <Button
                          onClick={() => setSelectedAssessment(assessment)}
                          size="sm"
                          className="bg-gradient-t1 text-white rounded-lg font-cinzel text-xs px-3"
                        >
                          Convert
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-lg bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-t1-red/20">
                            <DropdownMenuItem
                              onClick={async () => {
                                await supabase.from('assessment_sessions').update({ confirmed: !assessment.confirmed }).eq('id', assessment.id)
                                loadData()
                              }}
                              className="text-t1-cream cursor-pointer"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              {assessment.confirmed ? 'Unconfirm' : 'Confirm Coming'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditDateTimeModal({
                                  open: true,
                                  assessment: assessment,
                                  date: assessment.preferred_date || '',
                                  time: assessment.preferred_time || ''
                                })
                              }}
                              className="text-t1-cream cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit Date/Time
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                if (window.confirm('Cancel this lead? The data will be archived.')) {
                                  await supabase.from('assessment_sessions').update({ archived: true }).eq('id', assessment.id)
                                  loadData()
                                }
                              }}
                              className="text-red-400 cursor-pointer"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel Request
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  );
                })}
                {filteredLeads.length === 0 && (
                  <div className="text-center py-12">
                    <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{assessments.length === 0 ? 'No pending leads' : 'No leads match the current search / filter'}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'classes' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => {
                if (showSessionDetail) {
                  setShowSessionDetail(false)
                  setSelectedSession(null)
                } else {
                  setActiveTab('overview')
                }
              }} className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors">
                <ArrowLeft className="w-5 h-5 text-t1-cream" />
              </button>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-t1-gold" />
                <h2 className="text-xl font-cinzel font-bold">Classes & Rosters</h2>
              </div>
            </div>

            {!showSessionDetail && (
              <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10 mb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setWindowOffset(windowOffset - 1)}
                    className="px-3 py-2 rounded-lg border border-t1-red/20 bg-t1-black/40 text-sm"
                  >Prev</button>
                  <button
                    onClick={() => setWindowOffset(0)}
                    className={`px-3 py-2 rounded-lg text-sm ${windowOffset === 0 ? 'bg-gradient-t1 text-white' : 'border border-t1-red/20 bg-t1-black/40'}`}
                  >This Fri–Fri</button>
                    <button
                      disabled={windowOffset >= 0}
                      onClick={() => setWindowOffset(windowOffset + 1)}
                      className={`px-3 py-2 rounded-lg border border-t1-red/20 bg-t1-black/40 text-sm ${windowOffset >= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >Next</button>
                  <span className="text-xs text-muted-foreground self-center">{formatWindowLabel(windowOffset)} • {formatWindowDates(windowOffset)}</span>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-muted-foreground">Tap a class to open fullscreen roster</p>
                  <div className="flex gap-2 items-center">
                    <select
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="h-10 px-3 rounded-xl bg-t1-black border border-t1-red/20 text-t1-cream text-sm"
                    >
                      <option value="all">All Branches</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <Input
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                      placeholder="Search class name"
                      className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

              {!showSessionDetail && (
                <div className="space-y-3">
                    {classSessions
                      .filter(s => !classSearch.trim() || s.group_class?.name.toLowerCase().includes(classSearch.toLowerCase()))
                      .filter(s => branchFilter === 'all' || s.group_class?.branch_id === branchFilter)
                      .sort((a, b) => {
                        if (a.session_date !== b.session_date) {
                          return a.session_date.localeCompare(b.session_date)
                        }
                        return a.start_time.localeCompare(b.start_time)
                      })
                    .map(session => {
                    const stats = getSessionStats(session)
                    const branchName = branches.find(b => b.id === session.group_class?.branch_id)?.name
                    return (
                      <button
                        key={session.id}
                        onClick={() => {
                          setSelectedSession(session)
                          setShowSessionDetail(true)
                        }}
                        className={`w-full text-left rounded-2xl border p-4 shadow-lg transition-all ${
                          session.status === 'cancelled'
                            ? 'border-red-500/30 bg-gradient-to-br from-red-900/20 to-red-900/10 opacity-75'
                            : 'border-t1-red/15 bg-gradient-to-br from-t1-black to-t1-black/60 hover:border-t1-red/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white ${
                                session.status === 'cancelled'
                                  ? 'bg-gradient-to-br from-red-500/40 to-red-600/40'
                                  : 'bg-gradient-to-br from-t1-red/40 to-t1-dark-red/40'
                              }`}>
                                {session.status === 'cancelled' ? '✕' : getDayName(new Date(session.session_date).getDay())}
                              </div>
                              <div>
                                <h3 className="font-cinzel font-semibold text-base leading-tight">{session.group_class?.name}</h3>
                                <p className="text-xs text-muted-foreground">{formatDate(session.session_date)} {branchName && <span className="text-t1-gold">• {branchName}</span>}</p>
                                {session.status === 'cancelled' && (
                                  <p className="text-xs text-red-400 font-semibold">CANCELLED</p>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-t1-gold font-semibold">{formatClock(session.start_time)} - {formatClock(session.end_time)}</p>
                            {session.group_class?.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{session.group_class.description}</p>
                            )}
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-sm">Booked <span className="text-amber-400 font-semibold">{stats.booked}</span></p>
                            <p className="text-sm">Attended <span className="text-emerald-400 font-semibold">{stats.attended}</span></p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                {classSessions.length === 0 && (
                  <div className="text-center py-10 rounded-2xl border border-dashed border-t1-red/20 text-muted-foreground">
                    No sessions in this window
                  </div>
                )}
              </div>
            )}

            {showSessionDetail && selectedSession && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Session</p>
                    <h3 className="font-cinzel font-bold text-lg">{selectedSession.group_class?.name}</h3>
                    <p className="text-xs text-muted-foreground">{formatDate(selectedSession.session_date)} • {formatClock(selectedSession.start_time)} - {formatClock(selectedSession.end_time)}</p>
                    <p className="text-xs text-muted-foreground">Class ID: {selectedSession.group_class_id}</p>
                  </div>
                  <div className="text-right space-y-1 text-xs text-muted-foreground">
                    <p>{getSessionStats(selectedSession).booked} booked • {getSessionStats(selectedSession).attended} attended</p>
                    {selectedSession.status !== 'cancelled' && (
                      <Button
                        onClick={() => handleCancelClass(selectedSession)}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs px-3 h-8"
                      >
                        Cancel Class
                      </Button>
                    )}
                    {selectedSession.status === 'cancelled' && (
                      <p className="text-red-400 font-semibold">CLASS CANCELLED</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={rosterFilter}
                    onChange={(e) => setRosterFilter(e.target.value as typeof rosterFilter)}
                    className="h-10 px-3 rounded-xl bg-t1-black border border-t1-red/20 text-t1-cream"
                  >
                    <option value="all">All attendees</option>
                    <option value="booked">Booked</option>
                    <option value="attended">Attended</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span className="text-xs text-muted-foreground">Filter roster</span>
                </div>

                <div className="flex gap-2 items-center">
                  <Input
                    value={manualMemberId}
                    onChange={(e) => setManualMemberId(e.target.value)}
                    placeholder="Enter Member ID to mark attended"
                    className="h-10 bg-t1-black border-t1-red/30 text-t1-cream rounded-xl"
                  />
                  <Button onClick={handleManualAttend} disabled={!manualMemberId.trim()} className="h-10 px-4 bg-gradient-t1 text-white rounded-xl">
                    Mark Attended
                  </Button>
                </div>

                <div className="bg-secondary rounded-2xl border border-t1-red/10 overflow-hidden">
                  <div className="grid grid-cols-5 text-[11px] font-semibold text-muted-foreground px-3 py-2 bg-t1-black/40">
                    <span>Member Name</span>
                    <span>ID</span>
                    <span>Status</span>
                    <span>Checked</span>
                    <span className="text-right">Actions</span>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto">
                    {getSessionBookings(selectedSession)
                      .filter(b => rosterFilter === 'all' || b.status === rosterFilter)
                      .map(b => (
                        <div key={b.id} className="grid grid-cols-5 items-center px-3 py-3 border-t border-t1-red/10 text-sm">
                          <span className="font-semibold truncate">{b.member?.full_name}</span>
                          <span className="text-muted-foreground truncate">{b.member?.member_id}</span>
                          <span>
                            <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                              b.status === 'attended'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : b.status === 'cancelled'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {b.status}
                            </span>
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {b.checked_in_at ? formatTime(b.checked_in_at) : '—'}
                          </span>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => handleRosterToggle(b, b.status !== 'attended')}
                              size="sm"
                              className="h-8 px-3 bg-t1-red text-white rounded-lg text-xs"
                            >
                              {b.status === 'attended' ? 'Unattend' : 'Attend'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    {getSessionBookings(selectedSession).filter(b => rosterFilter === 'all' || b.status === rosterFilter).length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-8">No attendees for this filter</div>
                    )}
                  </div>
                </div>

                <div>
                  <Button
                    onClick={() => setShowSessionDetail(false)}
                    variant="outline"
                    className="w-full bg-transparent border-t1-red/30 text-t1-cream rounded-xl"
                  >
                    Back to classes
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'qr' && (
          <CheckInQrScreen onBack={() => setActiveTab('overview')} />
        )}

        {activeTab === 'attendance' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setActiveTab('overview')} className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors">
                <ArrowLeft className="w-5 h-5 text-t1-cream" />
              </button>
              <h2 className="text-xl font-cinzel font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Real-time Attendance
              </h2>
            </div>
            <div className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm text-emerald-400">Live tracking enabled</span>
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <p className="text-3xl font-cinzel font-bold text-t1-gold">{stats.todayCheckins}</p>
                  <p className="text-sm text-muted-foreground">Check-ins today</p>
                </div>
                <div>
                  <p className="text-3xl font-cinzel font-bold text-emerald-400">{stats.todayQrCheckins}</p>
                  <p className="text-sm text-muted-foreground">via QR</p>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-secondary rounded-2xl p-4 border border-t1-red/10">
              <h3 className="font-cinzel font-semibold mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-t1-gold" />
                Export attendance logs
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">From</label>
                  <Input
                    type="date"
                    value={exportFrom}
                    max={exportTo || undefined}
                    onChange={(e) => setExportFrom(e.target.value)}
                    className="bg-t1-black border-t1-red/20 text-t1-cream"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">To</label>
                  <Input
                    type="date"
                    value={exportTo}
                    min={exportFrom || undefined}
                    onChange={(e) => setExportTo(e.target.value)}
                    className="bg-t1-black border-t1-red/20 text-t1-cream"
                  />
                </div>
              </div>
              <Button
                onClick={handleExportAttendance}
                disabled={isExporting}
                className="mt-3 w-full h-11 bg-gradient-to-r from-t1-red to-t1-dark-red text-white rounded-xl font-cinzel"
              >
                {isExporting ? 'Exporting…' : 'Export CSV'}
              </Button>
              {exportMessage && (
                <p className="mt-2 text-xs text-muted-foreground">{exportMessage}</p>
              )}
            </div>

            <div className="space-y-3 mt-4">
              {attendance.map(record => (
                <div key={record.id} className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-blue-600/30 flex items-center justify-center">
                        <Check className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-cinzel font-semibold">{record.member?.full_name}</h3>
                        <p className="text-xs text-muted-foreground">{record.member?.member_id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatTime(record.check_in_time)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(record.check_in_time)} • {record.check_in_method}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'payments' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('overview')} className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-t1-cream" />
                </button>
                <h2 className="text-xl font-cinzel font-bold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                  Manual Payments
                </h2>
              </div>
              <Button
                onClick={() => setShowAddPayment(true)}
                className="bg-gradient-t1 text-white rounded-xl font-cinzel text-sm h-10 px-4"
              >
                <Plus className="w-4 h-4 mr-1" />
                Record Payment
              </Button>
            </div>

            {showAddPayment && (
              <form onSubmit={handleAddPayment} className="bg-secondary rounded-2xl p-5 border border-t1-red/30 space-y-4">
                <h3 className="font-cinzel font-semibold">Record New Payment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-t1-cream">Member ID *</Label>
                    <Input
                      value={newPayment.member_id}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, member_id: e.target.value }))}
                      placeholder="e.g., T12345"
                      className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-t1-cream">Amount (EGP) *</Label>
                    <Input
                      type="number"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-t1-cream">Payment Type</Label>
                    <select
                      value={newPayment.payment_type}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, payment_type: e.target.value }))}
                      className="w-full h-12 bg-t1-black border border-t1-red/20 text-t1-cream rounded-xl px-4"
                    >
                      <option value="subscription">Subscription</option>
                      <option value="session">Session</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-t1-cream">Description</Label>
                    <Input
                      value={newPayment.description}
                      onChange={(e) => setNewPayment(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional notes"
                      className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting} className="bg-gradient-t1 text-white rounded-xl font-cinzel">
                    {isSubmitting ? 'Recording...' : 'Record Payment'}
                  </Button>
                  <Button type="button" onClick={() => setShowAddPayment(false)} variant="outline" className="bg-transparent border-t1-red/30 text-t1-cream rounded-xl">
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {payments.map(payment => (
                <div key={payment.id} className="bg-secondary rounded-2xl p-4 border border-t1-red/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-cinzel font-semibold">{payment.member?.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{payment.payment_type} • {payment.description || 'No description'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">{payment.amount} EGP</p>
                      <p className="text-xs text-muted-foreground">{formatDate(payment.payment_date)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="text-center py-12">
                  <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No payments recorded yet</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'expiring' && (
          <div className="space-y-4">
            <button onClick={() => setActiveTab('overview')} className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Overview
            </button>
            <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
              <h3 className="font-cinzel font-semibold text-lg mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Expiring Soon
              </h3>
              <p className="text-sm text-muted-foreground mb-6">Members with low sessions or subscriptions expiring within 5 days (showing up to 50)</p>
              <div className="space-y-4">
                {(() => {
                  const now = new Date()
                  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
                  const expiringSoonMembers = members.filter(member => {
                    const memberSub = subscriptions.find(s => s.member_id === member.id)
                    if (!memberSub) return false
                    const isNotExpired = new Date(memberSub.end_date) >= now
                    const lowSessions = memberSub.sessions_remaining !== null && memberSub.sessions_remaining < 4
                    const expiringSoon = new Date(memberSub.end_date) >= now && new Date(memberSub.end_date) <= fiveDaysFromNow
                    return isNotExpired && (lowSessions || expiringSoon)
                  }).slice(0, 50) // Limit to 50 members for performance
                  return expiringSoonMembers.map(member => {
                    const memberSub = subscriptions.find(s => s.member_id === member.id)
                    return (
                      <div key={member.id} className="bg-t1-black/50 rounded-xl p-4 border border-t1-red/20">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-cinzel font-semibold">{member.full_name}</h4>
                            <p className="text-sm text-muted-foreground">{member.member_id}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => window.location.href = `tel:${member.phone}`}
                              className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title="Call"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const firstName = member.full_name.split(' ')[0]
                                const expiryDate = memberSub ? new Date(memberSub.end_date).toLocaleDateString() : 'soon'
                                let message = ''
                                
                                if (memberSub?.sessions_remaining !== null) {
                                  // Session-based subscription
                                  const sessionsLeft = memberSub.sessions_remaining
                                  message = `Hey ${firstName}!%0A%0AJust a heads up - you've got ${sessionsLeft} session(s) left until ${expiryDate}. We'd hate to see you go!%0A%0AYour progress matters to us.%0A%0ARenew now and keep the momentum going.%0A%0AHit reply if you have any questions!`
                                } else {
                                  // Time-based subscription
                                  message = `Hey ${firstName}!%0A%0AJust a heads up - your membership expires on ${expiryDate}. We'd hate to see you go!%0A%0AYour progress matters to us.%0A%0ARenew now and keep the momentum going.%0A%0AHit reply if you have any questions!`
                                }
                                
                                const phone = member.phone.replace(/[^0-9]/g, '')
                                const formattedPhone = phone.startsWith('0') ? '2' + phone : phone
                                const url = `https://wa.me/${formattedPhone}?text=${message}`
                                window.open(url, '_blank')
                              }}
                              className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title="Send WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          {memberSub?.sessions_remaining !== null && memberSub.sessions_remaining < 4 && (
                            <p className="text-amber-400">⚠️ Low Sessions: {memberSub.sessions_remaining} remaining</p>
                          )}
                          {memberSub && new Date(memberSub.end_date) <= fiveDaysFromNow && new Date(memberSub.end_date) >= now && (
                            <p className="text-red-400">⏰ Expires: {new Date(memberSub.end_date).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    )
                  })
                })()}
                {(() => {
                  const now = new Date()
                  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
                  const expiringSoonMembers = members.filter(member => {
                    const memberSub = subscriptions.find(s => s.member_id === member.id)
                    if (!memberSub) return false
                    const isNotExpired = new Date(memberSub.end_date) >= now
                    const lowSessions = memberSub.sessions_remaining !== null && memberSub.sessions_remaining < 4
                    const expiringSoon = new Date(memberSub.end_date) >= now && new Date(memberSub.end_date) <= fiveDaysFromNow
                    return isNotExpired && (lowSessions || expiringSoon)
                  })
                  return expiringSoonMembers.length === 0 && (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No members expiring soon</p>
                    </div>
                  )
                })()}
              </div>
            </div>
            <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
              <h3 className="font-cinzel font-semibold text-lg mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Expired
              </h3>
              <p className="text-sm text-muted-foreground mb-6">Members with expired subscriptions or no sessions remaining (showing up to 50)</p>
              <div className="space-y-4">
                {(() => {
                  const now = new Date()
                  const expiredMembers = members.filter(member => {
                    const memberSub = subscriptions.find(s => s.member_id === member.id)
                    if (!memberSub) return false
                    const subscriptionExpired = new Date(memberSub.end_date) < now
                    const noSessionsRemaining = memberSub.sessions_remaining === 0
                    return subscriptionExpired || noSessionsRemaining
                  }).slice(0, 50) // Limit to 50 members for performance
                  return expiredMembers.map(member => {
                    const memberSub = subscriptions.find(s => s.member_id === member.id)
                    const isSessionsExpired = memberSub?.sessions_remaining === 0
                    const isDateExpired = new Date(memberSub.end_date) < now
                    
                    return (
                      <div key={member.id} className="bg-t1-black/50 rounded-xl p-4 border border-t1-red/20">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-cinzel font-semibold">{member.full_name}</h4>
                            <p className="text-sm text-muted-foreground">{member.member_id}</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => window.location.href = `tel:${member.phone}`}
                              className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                              title="Call"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const firstName = member.full_name.split(' ')[0]
                                let message = ''
                                
                                if (isSessionsExpired) {
                                  message = `Hey ${firstName}!%0A%0AYou absolutely crushed it! You've completed all your sessions - that's incredible progress!%0A%0AYour trainers are ready to push you even further. Let's renew and build on that momentum!%0A%0AReply here and let's get you back on track!`
                                } else {
                                  message = `Hey ${firstName}!%0A%0AWe really miss having you at Triple One! Your goals matter to us, and we want to help you achieve them.%0A%0AYour membership expired on ${memberSub ? new Date(memberSub.end_date).toLocaleDateString() : 'recently'}, but it's never too late to come back.%0A%0ALet's renew and get back to crushing your fitness goals together!%0A%0AReply here and we'll get you sorted!`
                                }
                                
                                const phone = member.phone.replace(/[^0-9]/g, '')
                                const formattedPhone = phone.startsWith('0') ? '2' + phone : phone
                                const url = `https://wa.me/${formattedPhone}?text=${message}`
                                window.open(url, '_blank')
                              }}
                              className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title="Send WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm">
                          {isSessionsExpired && (
                            <p className="text-red-400">❌ Sessions Used: 0 remaining</p>
                          )}
                          {isDateExpired && (
                            <p className="text-red-400">⏰ Expired: {new Date(memberSub.end_date).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    )
                  })
                })()}
                {(() => {
                  const now = new Date()
                  const expiredMembers = members.filter(member => {
                    const memberSub = subscriptions.find(s => s.member_id === member.id)
                    if (!memberSub) return false
                    const subscriptionExpired = new Date(memberSub.end_date) < now
                    const noSessionsRemaining = memberSub.sessions_remaining === 0
                    return subscriptionExpired || noSessionsRemaining
                  })
                  return expiredMembers.length === 0 && (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No expired members</p>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shared' && (
          <div className="space-y-4">
            <button onClick={() => setActiveTab('overview')} className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Overview
            </button>
            <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
              <SharedSubscriptions admin={admin} />
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <>
            {selectedMember ? (
              <MemberProfilePanel 
                member={selectedMember} 
                onBack={() => setSelectedMember(null)}
              />
            ) : (
              <>
                <h2 className="text-xl font-cinzel font-bold">Members & Subscriptions</h2>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name, ID, or phone..."
                      className="h-12 bg-secondary border-t1-red/20 text-t1-cream rounded-xl pl-12"
                    />
                  </div>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="h-12 bg-secondary border-t1-red/20 text-t1-cream rounded-xl w-40 px-3"
                  >
                    <option value="all">All Branches</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="h-12 bg-secondary border-t1-red/20 text-t1-cream rounded-xl w-32 px-3"
                  >
                    <option value="all">All Levels</option>
                    {uniqueLevels.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  {filteredMembers.map(member => {
                    const memberRecords = records.filter(r => r.member_id === member.id)
                    const memberSub = subscriptions.find(s => s.member_id === member.id)
                    const sharedSub = sharedSubscriptions.find(s => s.member_id === member.id)
                    const memberPayments = payments.filter(p => p.member_id === member.id)
                    const isExpired = memberSub ? new Date(memberSub.end_date) < new Date() : false
                    const isLowSessions = memberSub?.sessions_remaining !== null && memberSub?.sessions_remaining !== undefined && memberSub.sessions_remaining < 4
                
                return (
                  <div key={member.id} className={`bg-secondary rounded-2xl border ${isExpired ? 'border-red-500/30' : isLowSessions ? 'border-amber-500/30' : 'border-t1-red/10'}`}>
                    <button
                      onClick={() => {
                        setMembersScrollPosition(window.scrollY)
                        setSelectedMember(member)
                      }}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                                member.status !== 'active'
                                  ? 'bg-zinc-800 text-zinc-400'
                                  : member.level === 'Legend' ? 'bg-gradient-to-br from-t1-gold to-[#b8860b]'
                                  : member.level === 'Spartan' ? 'bg-gradient-to-br from-[#c0c0c0] to-[#808080]'
                                  : member.level === 'Ladies' ? 'bg-gradient-to-br from-[#ff9ecd] to-[#ff6f9c]'
                                  : 'bg-gradient-to-br from-[#cd7f32] to-[#8b4513]'
                              }`}>
                                {member.status !== 'active'
                                  ? '💪'
                                  : member.level === 'Legend' ? '👑'
                                  : member.level === 'Spartan' ? '🛡️'
                                  : member.level === 'Ladies' ? '🌸'
                                  : '⚔️'}
                          </div>
                          <div>
                            <h3 className="font-cinzel font-semibold">{member.full_name}</h3>
                            <p className="text-xs text-muted-foreground">{member.member_id} • {member.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                            member.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-600/20 text-zinc-400'
                          }`}>
                            {member.status}
                          </span>
                          <ChevronRight className="w-4 h-4 text-t1-red" />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 pt-3 border-t border-t1-red/10">
                        <div>
                          <p className="text-xs text-muted-foreground">Loyalty</p>
                          <p className="font-semibold text-t1-gold">{member.loyalty_points || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Records</p>
                          <p className="font-semibold">{memberRecords.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Subscription</p>
                          <p className={`font-semibold text-sm ${
                            sharedSub ? 'text-t1-gold' :
                            memberSub ? (isExpired ? 'text-red-400' : 'text-emerald-400') : 'text-zinc-400'
                          }`}>
                            {sharedSub ? `👥 ${sharedSub.shared_subscription?.id || 'Shared'}` : memberSub ? memberSub.package?.name : 'None'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Sessions</p>
                          <p className={`font-semibold ${isLowSessions ? 'text-amber-400' : ''}`}>
                            {sharedSub ? `${sharedSub.shared_subscription?.sessions_remaining}/${sharedSub.shared_subscription?.sessions_total}` : memberSub?.sessions_remaining ?? '—'}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
              </>
            )}
          </>
        )}

        {activeTab === 'movements' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveTab('overview')} className="p-2 rounded-xl bg-secondary border border-t1-red/20 hover:bg-t1-red/10 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-t1-cream" />
                </button>
                <h2 className="text-xl font-cinzel font-bold">Manage Movements</h2>
              </div>
              <Button
                onClick={() => setShowAddMovement(true)}
                className="bg-gradient-t1 text-white rounded-xl font-cinzel text-sm h-10 px-4 glow-t1"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Movement
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Add or remove movements that members can track for personal records
            </p>

            {showAddMovement && (
              <div className="bg-secondary rounded-2xl p-5 border border-t1-red/30">
                <h3 className="font-cinzel font-semibold mb-4">Add New Movement</h3>
                <form onSubmit={handleAddMovement} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-t1-cream">Movement Name *</Label>
                    <Input
                      value={newMovementName}
                      onChange={(e) => setNewMovementName(e.target.value)}
                      placeholder="e.g., Pull-ups, Deadlift"
                      className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-t1-cream">Description (optional)</Label>
                    <Input
                      value={newMovementDesc}
                      onChange={(e) => setNewMovementDesc(e.target.value)}
                      placeholder="Brief description"
                      className="h-12 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting} className="bg-gradient-t1 text-white rounded-xl font-cinzel">
                      {isSubmitting ? 'Adding...' : 'Add Movement'}
                    </Button>
                    <Button type="button" onClick={() => setShowAddMovement(false)} variant="outline" className="bg-transparent border-t1-red/30 text-t1-cream rounded-xl">
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-3">
              {movements.map(movement => (
                <div 
                  key={movement.id} 
                  className={`bg-secondary rounded-2xl p-4 border ${movement.is_active ? 'border-t1-red/10' : 'border-zinc-700 opacity-60'}`}
                >
                  {editingMovement === movement.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      />
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="h-10 bg-t1-black border-t1-red/20 text-t1-cream rounded-xl"
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => handleUpdateMovement(movement.id)} disabled={isSubmitting} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => setEditingMovement(null)} size="sm" variant="outline" className="bg-transparent border-t1-red/30 text-t1-cream rounded-lg">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-t1-red/30 to-t1-dark-red/30 flex items-center justify-center">
                          <Dumbbell className="w-5 h-5 text-t1-red" />
                        </div>
                        <div>
                          <h3 className="font-cinzel font-semibold">{movement.name}</h3>
                          {movement.description && <p className="text-xs text-muted-foreground">{movement.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleMovement(movement.id, movement.is_active)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${movement.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-600/20 text-zinc-400'}`}
                        >
                          {movement.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <button onClick={() => startEditing(movement)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteMovement(movement.id)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-cinzel font-bold">Settings</h2>
            <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
              <h3 className="font-cinzel font-semibold mb-4">Admin Account</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{admin.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{admin.email}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-secondary rounded-2xl p-5 border border-t1-red/10">
              <h3 className="font-cinzel font-semibold mb-4">System Management</h3>
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">Quick access</p>
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
                  <button
                    onClick={() => setActiveTab('members')}
                    className="w-full h-12 rounded-xl bg-gradient-t1 text-white flex items-center justify-center gap-2"
                  >
                    <Users className="w-4 h-4" />
                    Members & Subscriptions
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-t1-black/95 backdrop-blur border-t border-t1-red/20 z-50 safe-area-inset-bottom">
          <div className="max-w-4xl mx-auto px-2 py-2 sm:py-3">
            <div className="flex justify-around items-center overflow-x-auto">
              {[
                { id: 'overview', icon: TrendingUp, label: 'Home' },
                { id: 'classes', icon: Calendar, label: 'Classes' },
                { id: 'qr', icon: QrCode, label: 'Check-in' },
                { id: 'members', icon: Users, label: 'Members' },
                { id: 'settings', icon: Settings, label: 'Settings' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all min-w-[56px] ${
                    activeTab === item.id 
                      ? 'text-t1-red' 
                      : 'text-muted-foreground hover:text-t1-cream'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

      {/* Edit Date/Time Dialog */}
      <Dialog open={editDateTimeModal.open} onOpenChange={(open) => setEditDateTimeModal(prev => ({ ...prev, open }))}>
        <DialogContent className="bg-zinc-900 border-t1-red/20">
          <DialogHeader>
            <DialogTitle className="text-t1-cream font-cinzel">Edit Date/Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-t1-cream">Date</Label>
              <Input
                type="date"
                value={editDateTimeModal.date}
                onChange={(e) => setEditDateTimeModal(prev => ({ ...prev, date: e.target.value }))}
                className="bg-zinc-800 border-t1-red/20 text-t1-cream"
              />
            </div>
            <div>
              <Label className="text-t1-cream">Time</Label>
              <Input
                type="time"
                value={editDateTimeModal.time}
                onChange={(e) => setEditDateTimeModal(prev => ({ ...prev, time: e.target.value }))}
                className="bg-zinc-800 border-t1-red/20 text-t1-cream"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDateTimeModal({ open: false, assessment: null, date: '', time: '' })}
              className="border-t1-red/20 text-t1-cream"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (editDateTimeModal.assessment) {
                  await supabase.from('assessment_sessions').update({ 
                    preferred_date: editDateTimeModal.date || null, 
                    preferred_time: editDateTimeModal.time || null 
                  }).eq('id', editDateTimeModal.assessment.id)
                  loadData()
                  setEditDateTimeModal({ open: false, assessment: null, date: '', time: '' })
                }
              }}
              className="bg-gradient-t1 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}