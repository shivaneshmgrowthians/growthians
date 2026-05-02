import { useEffect, useState } from 'react'
import { Plus, Clock as ClockIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, todayISO } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  PageHeader, Modal, Input, Textarea, StatusBadge, EmptyState, Loader, Button,
} from '../components/ui'

export default function EmployeeLogoff() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    logoff_date: todayISO(),
    logoff_time: '',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (profile?.id) loadRequests()
  }, [profile?.id])

  const loadRequests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('logoff_requests')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.logoff_time || !form.reason.trim()) {
      showToast('Please fill all fields', 'error')
      return
    }
    setSubmitting(true)

    const { data, error } = await supabase
      .from('logoff_requests')
      .insert({
        user_id: profile.id,
        ...form,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      showToast(error.message || 'Failed to submit', 'error')
      setSubmitting(false)
      return
    }

    const { data: ceos } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'ceo')
      .eq('active', true)

    if (ceos?.length) {
      const notifs = ceos.map((ceo) => ({
        recipient_id: ceo.id,
        type: 'logoff_request',
        message: `${profile.name} requested early logoff on ${formatDate(form.logoff_date)}`,
        related_id: data.id,
      }))
      await supabase.from('notifications').insert(notifs)
    }

    showToast('Early logoff request submitted')
    setModalOpen(false)
    setForm({ logoff_date: todayISO(), logoff_time: '', reason: '' })
    loadRequests()
    setSubmitting(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Time Off"
        title="Early Logoff Requests"
        subtitle="Request to leave before 6:30 PM"
        action={
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" strokeWidth={2} />
            New Request
          </Button>
        }
      />

      {loading ? (
        <Loader />
      ) : requests.length === 0 ? (
        <EmptyState message="No early logoff requests yet" icon={ClockIcon} />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border border-black/10 p-5">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="text-lg font-semibold">{formatDate(req.logoff_date)}</span>
                <StatusBadge status={req.status} />
              </div>
              <div className="text-xs uppercase tracking-widest text-black/50 font-semibold">
                Leave by {req.logoff_time}
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
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title="Request Early Logoff" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Date"
              type="date"
              value={form.logoff_date}
              onChange={(e) => setForm({ ...form, logoff_date: e.target.value })}
              required
            />
            <Input
              label="Logoff Time"
              type="time"
              value={form.logoff_time}
              onChange={(e) => setForm({ ...form, logoff_time: e.target.value })}
              required
            />
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
