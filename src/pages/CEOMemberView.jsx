import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, ArrowLeft, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/helpers'
import { PageHeader, Loader, EmptyState } from '../components/ui'
import { getAvatar } from '../lib/avatars'
import DailyTaskGrid from '../components/DailyTaskGrid'

export default function CEOMemberView() {
  const { userId } = useParams()
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    if (userId) loadData()
  }, [userId])

  const loadData = async () => {
    setLoading(true)

    const [userRes, tasksRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase
        .from('daily_tasks')
        .select('*, task_slots(*)')
        .eq('user_id', userId)
        .eq('status', 'submitted')
        .order('date', { ascending: false }),
    ])

    setUser(userRes.data)
    setTasks(tasksRes.data || [])
    setLoading(false)
  }

  if (loading) return <Loader label="Loading member" />
  if (!user) return <div>User not found</div>

  const avatar = getAvatar(user.avatar_id)

  return (
    <div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-black/60 hover:text-black mb-4"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
        Back to Dashboard
      </Link>

      {/* Member header */}
      <div className="bg-black text-white p-6 mb-6 flex items-center gap-4">
        <div
          className="w-16 h-16 flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: avatar.bg }}
        >
          {avatar.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold">{user.name}</h2>
          <p className="text-sm text-white/60">{user.designation}</p>
          <p className="text-xs text-white/40 mt-1">{user.email}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-white/60 font-semibold mb-1">
            Leave Balance
          </div>
          <div className="text-3xl font-bold" style={{ color: '#C5F542' }}>
            {user.leave_balance}
            <span className="text-base text-white/40 font-normal"> / 12</span>
          </div>
        </div>
      </div>

      <PageHeader
        eyebrow="Submitted Days"
        title="Daily History"
        subtitle={`${tasks.length} day${tasks.length !== 1 ? 's' : ''} submitted`}
      />

      {tasks.length === 0 ? (
        <EmptyState message="No submissions yet" icon={FileText} />
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white border border-black/10 overflow-hidden">
              <button
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
                className="w-full p-5 flex items-center justify-between hover:bg-black/[0.02] transition-colors text-left"
              >
                <div>
                  <div className="text-lg font-semibold">{formatDate(t.date)}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    In: {t.login_time || '—'} · Out: {t.logoff_time || '—'} ·{' '}
                    {t.total_hours || 0}h logged
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-black/40 transition-transform ${
                    openId === t.id ? 'rotate-90' : ''
                  }`}
                  strokeWidth={1.8}
                />
              </button>
              {openId === t.id && (
                <div className="border-t border-black/10">
                  <DailyTaskGrid slots={t.task_slots || []} date={t.date} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
