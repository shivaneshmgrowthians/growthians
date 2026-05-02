import { useEffect, useState } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader, EmptyState, Loader } from '../components/ui'
import DailyTaskGrid from '../components/DailyTaskGrid'

export default function EmployeeHistory() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    if (profile?.id) loadTasks()
  }, [profile?.id])

  const loadTasks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('daily_tasks')
      .select('*, task_slots(*)')
      .eq('user_id', profile.id)
      .eq('status', 'submitted')
      .order('date', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Archive"
        title="Submitted Days"
        subtitle="Your submitted daily sheets with auto-tracked hours"
      />
      {loading ? (
        <Loader />
      ) : tasks.length === 0 ? (
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
