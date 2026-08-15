import { ArrowLeft } from 'lucide-react'

type Member = {
  id: string
  member_id: string
  full_name: string
  phone: string
}

type ManualPayment = {
  id: string
  member_id: string
  amount: number
  payment_type: string
  description: string | null
  payment_date: string
}

type PaymentsPageProps = {
  member: Member
  payments: ManualPayment[]
  onBack: () => void
}

export function PaymentsPage({ member, payments, onBack }: PaymentsPageProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

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
        <div>
          <h2 className="text-2xl font-cinzel font-bold">Payment History</h2>
          <p className="text-muted-foreground">{member.full_name}</p>
        </div>

        {/* Summary Card */}
        <div className="bg-secondary rounded-2xl p-6 border border-t1-red/10">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Payments</p>
              <p className="text-3xl font-cinzel font-bold text-emerald-400">{payments.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-3xl font-cinzel font-bold text-t1-gold">{totalAmount} EGP</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Payment</p>
              <p className="text-3xl font-cinzel font-bold">
                {payments.length > 0 ? Math.round(totalAmount / payments.length) : 0} EGP
              </p>
            </div>
          </div>
        </div>

        {/* Payments List */}
        {payments.length > 0 ? (
          <div className="space-y-3">
            {payments.map(payment => (
              <div
                key={payment.id}
                className="bg-secondary rounded-xl p-4 border border-t1-red/10 hover:border-t1-red/30 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <span className="text-lg font-semibold text-emerald-400">₹</span>
                    </div>
                    <div>
                      <p className="font-semibold capitalize">{payment.payment_type}</p>
                      {payment.description && (
                        <p className="text-xs text-muted-foreground">{payment.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-cinzel font-bold text-emerald-400">{payment.amount} EGP</p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.payment_date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-secondary rounded-2xl p-12 border border-t1-red/10 text-center">
            <p className="text-muted-foreground">No payments recorded yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
