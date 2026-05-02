import { useEffect, useState } from 'react'
import { Plus, Calendar as CalendarIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, daysBetween } from '../lib/helpers'
import { getNextCreditDate } from '../lib/leaveCredit'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  PageHeader, Modal, Field, Input, Textarea, StatusBadge, EmptyState, Loader, Button,
} from '../components/ui'

export default function EmployeeLeave() {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    from_date: '',
    to_date: '',
    leave_type: 'full',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (profile?.id) loadRequests()
  }, [profile?.id])

  const loadRequests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.from_date || !form.to_date || !form.reason.trim()) {
      showToast('Please fill all fields', 'error')
      return
    }

    const days = daysBetween(form.from_date, form.to_date)
    const isHalf = form.leave_type === 'half'
    const deductDays = isHalf ? 0 : days
    const lopDays = Math.max(0, deductDays - profile.leave_balance)
    const daysRequested = isHalf ? 0.5 : days

    setSubmitting(true)

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: profile.id,
        from_date: form.from_date,
        to_date: form.to_date,
        leave_type: form.leave_type,
        reason: form.reason.trim(),
        days_requested: daysRequested,
        lop_days: lopDays,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      showToast(error.message || 'Failed to submit', 'error')
      setSubmitting(false)
      return
    }

    // Notify CEOs
    const { data: ceos } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'ceo')
      .eq('active', true)

    if (ceos?.length) {
      const notifs = ceos.map((ceo) => ({
        recipient_id: ceo.id,
        type: 'leave_request',
        message: `${profile.name} requested ${
          isHalf ? 'half-day' : days + '-day'
        } leave${lopDays > 0 ? ` (${lopDays} LOP)` : ''}`,
        related_id: data.id,
      }))
      await supabase.from('notifications').insert(notifs)
    }

    showToast(
      lopDays > 0
        ? `Submitted · ${lopDays} day(s) will be Loss of Pay`
        : 'Leave request submitted',
    )
    setModalOpen(false)
    setForm({ from_date: '', to_date: '', leave_type: 'full', reason: '' })
    loadRequests()
    setSubmitting(false)
  }

  const balance = profile?.leave_balance || 0
  const nextCreditDate = getNextCreditDate(profile?.last_credited_month)
  const nextCreditStr = nextCreditDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const isAtMax = balance >= 12

  return (
    <div>
      <PageHeader
        eyebrow="Time Off"
        title="Leave Requests"
        action={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Request
          </Button>
        }
      />

      {/* Balance card */}
      <div className="bg-black text-white p-6 mb-6 relative overflow-hidden">
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
          style={{ background: '#C5F542' }}
        />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest text-white/60 mb-2 font-semibold">
            Available Balance
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-6xl font-bold" style={{ color: '#C5F542' }}>
              {balance}
            </div>
            <div className="text-2xl text-white/60">/ 12</div>
          </div>
          <div className="text-sm text-white/60 mt-2">
            Leaves credited monthly · Carries forward up to 12 · Half-day is free
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-white/60" strokeWidth={1.8} />
              <span className="text-xs text-white/60">
                {isAtMax ? (
                  <>Balance is at max — no new credits until you take leave</>
                ) : (
                  <>
                    Next credit:{' '}
                    <span className="font-semibold text-white">{nextCreditStr}</span>
                  </>
                )}
              </span>
            </div>
            {profile?.last_credited_month && (
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                Last credited:{' '}
                {new Date(profile.last_credited_month + '-01').toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : requests.length === 0 ? (
        <EmptyState message="No leave requests yet" icon={CalendarIcon} />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border border-black/10 p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-lg font-semibold">
                      {formatDate(req.from_date)}
                      {req.to_date !== req.from_date ? ` → ${formatDate(req.to_date)}` : ''}
                    </span>
                    <StatusBadge status={req.status} />
                    {req.lop_days > 0 && (
                      <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 bg-orange-100 text-orange-700">
                        {req.lop_days} LOP
                      </span>
                    )}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-black/50 font-semibold">
                    {req.leave_type === 'full'
                      ? `${req.days_requested} day${req.days_requested > 1 ? 's' : ''}`
                      : 'Half day (free)'}
                  </div>
                  <p className="text-sm mt-3">{req.reason}</p>
                  {req.ceo_comment && (
                    <div className="mt-3 pt-3 border-t border-black/10">
                      <div
                        className="text-[10px] uppercase tracking-widest font-semibold mb-1"
                        style={{ color: '#888' }}
                      >
                        CEO Note
                      </div>
                      <p className="text-sm italic text-black/70">{req.ceo_comment}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title="Request Leave" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-[#C5F542]/10 border border-[#C5F542]/30 p-3 flex items-center gap-3">
              <div className="text-2xl font-bold">{balance}</div>
              <div>
                <div className="text-xs uppercase tracking-wide text-black/60">
                  Leaves Available
                </div>
                <div className="text-xs text-black/60">
                  If you exceed, days marked as Loss of Pay (LOP)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="From"
                type="date"
                value={form.from_date}
                onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                required
              />
              <Input
                label="To"
                type="date"
                min={form.from_date}
                value={form.to_date}
                onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                required
              />
            </div>

            {form.from_date && form.to_date && (
              <div className="text-xs text-black/60 bg-black/5 p-2.5">
                <strong>
                  {daysBetween(form.from_date, form.to_date)} day
                  {daysBetween(form.from_date, form.to_date) > 1 ? 's' : ''}
                </strong>
                {form.leave_type === 'full' &&
                  daysBetween(form.from_date, form.to_date) > balance && (
                    <span className="text-red-600 ml-2">
                      ⚠ {daysBetween(form.from_date, form.to_date) - balance} day(s) will be LOP
                    </span>
                  )}
                {form.leave_type === 'half' && (
                  <span className="text-[#666] ml-2">
                    Half-day · doesn't deduct from balance
                  </span>
                )}
              </div>
            )}

            <Field label="Type">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'full', label: 'Full Day' },
                  { v: 'half', label: 'Half Day (Free)' },
                ].map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => setForm({ ...form, leave_type: t.v })}
                    className={`py-2.5 text-sm transition-colors ${
                      form.leave_type === t.v
                        ? 'bg-black text-white'
                        : 'bg-black/5 text-black/60 hover:bg-black/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            <Textarea
              label="Reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              placeholder="Brief reason..."
              required
            />

            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="w-full justify-center !py-3"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  )
}
