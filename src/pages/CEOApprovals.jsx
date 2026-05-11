import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock as ClockIcon, Calendar as CalIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatRelative } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Modal, Textarea, StatusBadge, EmptyState, Loader, Button } from '../components/ui'
import { getAvatar } from '../lib/avatars'

export default function CEOApprovals() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [leaves, setLeaves] = useState([])
  const [logoffs, setLogoffs] = useState([])
  const [comps, setComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [reviewModal, setReviewModal] = useState(null)
  const [comment, setComment] = useState('')
  const [reviewing, setReviewing] = useState(false)

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel('ceo-approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logoff_requests' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compensatory_dates' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const loadData = async () => {
    setLoading(true)
    const [leavesRes, logoffsRes, compsRes] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('*, users(name, designation, avatar_id, leave_balance)')
        .order('created_at', { ascending: false }),
      supabase
        .from('logoff_requests')
        .select('*, users(name, designation, avatar_id)')
        .order('created_at', { ascending: false }),
      supabase
        .from('compensatory_dates')
        .select('*, users(name, designation, avatar_id)')
        .order('created_at', { ascending: false }),
    ])
    setLeaves(leavesRes.data || [])
    setLogoffs(logoffsRes.data || [])
    setComps(compsRes.data || [])
    setLoading(false)
  }

  const openReview = (req, type, action) => {
    setReviewModal({ req, type, action })
    setComment('')
  }

  const submitReview = async () => {
    if (!reviewModal) return
    const { req, type, action } = reviewModal
    setReviewing(true)

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    if (type === 'comp') {
      const { error } = await supabase
        .from('compensatory_dates')
        .update({
          status: newStatus,
          ceo_comment: comment.trim() || null,
          reviewer_id: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id)

      if (error) {
        showToast('Failed to update', 'error')
        setReviewing(false)
        return
      }

      await supabase.from('notifications').insert({
        recipient_id: req.user_id,
        type: 'comp_' + newStatus,
        message: `Your compensatory date (${formatDate(req.comp_date)}) was ${newStatus}`,
        related_id: req.id,
      })

      showToast('Compensatory date ' + newStatus)
      setReviewModal(null)
      setComment('')
      loadData()
      setReviewing(false)
      return
    }

    const table = type === 'leave' ? 'leave_requests' : 'logoff_requests'

    const { error } = await supabase
      .from(table)
      .update({
        status: newStatus,
        ceo_comment: comment.trim() || null,
        reviewer_id: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.id)

    if (error) {
      showToast('Failed to update', 'error')
      setReviewing(false)
      return
    }

    if (type === 'leave' && action === 'approve' && req.leave_type === 'full' && req.days_requested > 0) {
      const deduct = req.days_requested - (req.lop_days || 0)
      if (deduct > 0) {
        const newBalance = Math.max(0, (req.users.leave_balance || 0) - deduct)
        await supabase.from('users').update({ leave_balance: newBalance }).eq('id', req.user_id)
      }
    }

    await supabase.from('notifications').insert({
      recipient_id: req.user_id,
      type: type + '_' + newStatus,
      message: `Your ${type} request was ${newStatus}`,
      related_id: req.id,
    })

    showToast(`${type === 'leave' ? 'Leave' : 'Logoff'} ${newStatus}`)
    setReviewModal(null)
    setComment('')
    loadData()
    setReviewing(false)
  }

  const filteredLeaves = leaves.filter((l) => filter === 'all' ? true : l.status === filter)
  const filteredLogoffs = logoffs.filter((l) => filter === 'all' ? true : l.status === filter)
  const filteredComps = comps.filter((c) => filter === 'all' ? true : c.status === filter)

  const pendingCount = leaves.filter(l => l.status === 'pending').length +
    logoffs.filter(l => l.status === 'pending').length +
    comps.filter(c => c.status === 'pending').length

  return (
    <div>
      <PageHeader
        eyebrow="Pending Actions"
        title="Approvals"
        subtitle="Review leave, logoff and compensatory requests"
        action={
          pendingCount > 0 && (
            <span className="text-xs uppercase tracking-widest font-semibold px-3 py-1 bg-red-100 text-red-700">
              {pendingCount} pending
            </span>
          )
        }
      />

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-semibold transition-colors ${
              filter === f ? 'bg-black text-white' : 'bg-white text-black/60 border border-black/15'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <div className="space-y-8">

          {/* LEAVE REQUESTS */}
          <div>
            <h3 className="text-sm uppercase tracking-widest font-semibold text-black/60 mb-3 flex items-center gap-2">
              <CalIcon className="w-4 h-4" strokeWidth={1.8} />
              Leave Requests ({filteredLeaves.length})
            </h3>
            {filteredLeaves.length === 0 ? <EmptyState message="No leave requests in this filter" /> : (
              <div className="space-y-3">
                {filteredLeaves.map((req) => {
                  const avatar = getAvatar(req.users?.avatar_id)
                  return (
                    <div key={req.id} className="bg-white border border-black/10 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0" style={{ background: avatar.bg }}>
                          {avatar.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-1">
                            <span className="font-semibold">{req.users?.name}</span>
                            <StatusBadge status={req.status} />
                            {req.lop_days > 0 && (
                              <span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 bg-orange-100 text-orange-700">
                                {req.lop_days} LOP
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-black/50 mb-2">
                            {req.users?.designation} · Submitted {formatRelative(req.created_at)}
                          </div>
                          <div className="text-sm">
                            <strong>
                              {formatDate(req.from_date)}
                              {req.to_date !== req.from_date ? ` → ${formatDate(req.to_date)}` : ''}
                            </strong>
                            <span className="text-black/60 ml-2">
                              · {req.leave_type === 'half' ? 'Half day' : `${req.days_requested} day${req.days_requested > 1 ? 's' : ''}`}
                            </span>
                          </div>
                          <p className="text-sm mt-2">{req.reason}</p>
                          {req.ceo_comment && (
                            <div className="mt-3 pt-3 border-t border-black/10">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-black/50 mb-1">Your Note</div>
                              <p className="text-sm italic text-black/70">{req.ceo_comment}</p>
                            </div>
                          )}
                        </div>
                        {req.status === 'pending' && (
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button variant="success" onClick={() => openReview(req, 'leave', 'approve')} className="!px-3 !py-2 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Approve
                            </Button>
                            <Button variant="danger" onClick={() => openReview(req, 'leave', 'reject')} className="!px-3 !py-2 text-xs">
                              <XCircle className="w-3.5 h-3.5" strokeWidth={2} /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* COMPENSATORY DATES */}
          <div>
            <h3 className="text-sm uppercase tracking-widest font-semibold text-black/60 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />
              Compensatory Dates ({filteredComps.length})
            </h3>
            {filteredComps.length === 0 ? <EmptyState message="No compensatory requests in this filter" /> : (
              <div className="space-y-3">
                {filteredComps.map((req) => {
                  const avatar = getAvatar(req.users?.avatar_id)
                  return (
                    <div key={req.id} className="bg-white border border-black/10 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0" style={{ background: avatar.bg }}>
                          {avatar.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-1">
                            <span className="font-semibold">{req.users?.name}</span>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="text-xs text-black/50 mb-2">
                            {req.users?.designation} · Submitted {formatRelative(req.created_at)}
                          </div>
                          <div className="text-sm">
                            Will work on <strong>{formatDate(req.comp_date)}</strong> as compensation
                          </div>
                          {req.reason && <p className="text-sm mt-2 text-black/60">{req.reason}</p>}
                          {req.ceo_comment && (
                            <div className="mt-3 pt-3 border-t border-black/10">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-black/50 mb-1">Your Note</div>
                              <p className="text-sm italic text-black/70">{req.ceo_comment}</p>
                            </div>
                          )}
                        </div>
                        {req.status === 'pending' && (
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button variant="success" onClick={() => openReview(req, 'comp', 'approve')} className="!px-3 !py-2 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Approve
                            </Button>
                            <Button variant="danger" onClick={() => openReview(req, 'comp', 'reject')} className="!px-3 !py-2 text-xs">
                              <XCircle className="w-3.5 h-3.5" strokeWidth={2} /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* LOGOFF REQUESTS */}
          <div>
            <h3 className="text-sm uppercase tracking-widest font-semibold text-black/60 mb-3 flex items-center gap-2">
              <ClockIcon className="w-4 h-4" strokeWidth={1.8} />
              Early Logoff ({filteredLogoffs.length})
            </h3>
            {filteredLogoffs.length === 0 ? <EmptyState message="No logoff requests in this filter" /> : (
              <div className="space-y-3">
                {filteredLogoffs.map((req) => {
                  const avatar = getAvatar(req.users?.avatar_id)
                  return (
                    <div key={req.id} className="bg-white border border-black/10 p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0" style={{ background: avatar.bg }}>
                          {avatar.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-1">
                            <span className="font-semibold">{req.users?.name}</span>
                            <StatusBadge status={req.status} />
                          </div>
                          <div className="text-xs text-black/50 mb-2">
                            {req.users?.designation} · Submitted {formatRelative(req.created_at)}
                          </div>
                          <div className="text-sm">
                            <strong>{formatDate(req.logoff_date)}</strong>
                            <span className="text-black/60 ml-2">· Leave by {req.logoff_time}</span>
                          </div>
                          <p className="text-sm mt-2">{req.reason}</p>
                          {req.ceo_comment && (
                            <div className="mt-3 pt-3 border-t border-black/10">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-black/50 mb-1">Your Note</div>
                              <p className="text-sm italic text-black/70">{req.ceo_comment}</p>
                            </div>
                          )}
                        </div>
                        {req.status === 'pending' && (
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Button variant="success" onClick={() => openReview(req, 'logoff', 'approve')} className="!px-3 !py-2 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Approve
                            </Button>
                            <Button variant="danger" onClick={() => openReview(req, 'logoff', 'reject')} className="!px-3 !py-2 text-xs">
                              <XCircle className="w-3.5 h-3.5" strokeWidth={2} /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {reviewModal && (
        <Modal
          title={`${reviewModal.action === 'approve' ? 'Approve' : 'Reject'} ${
            reviewModal.type === 'comp' ? 'Compensatory Date' : reviewModal.type === 'leave' ? 'Leave' : 'Logoff'
          }`}
          onClose={() => setReviewModal(null)}
        >
          <div className="space-y-4">
            <Textarea
              label="Comment (Optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Add a note for the employee..."
            />
            <Button
              variant={reviewModal.action === 'approve' ? 'success' : 'danger'}
              onClick={submitReview}
              disabled={reviewing}
              className="w-full justify-center !py-3"
            >
              {reviewing ? 'Processing...' : `Confirm ${reviewModal.action === 'approve' ? 'Approval' : 'Rejection'}`}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}