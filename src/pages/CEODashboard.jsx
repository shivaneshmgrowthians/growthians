import { useEffect, useState } from 'react'
import { Users, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayISO, formatDate } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader, Loader } from '../components/ui'
import { getAvatar } from '../lib/avatars'

export default function CEODashboard() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [todayTasks, setTodayTasks] = useState([])
  const [pendingLeave, setPendingLeave] = useState(0)
  const [pendingLogoff, setPendingLogoff] = useState(0)
  const [loading, setLoading] = useState(true)

  const today = todayISO()

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

  // Real-time subscription for new submissions/requests
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel('ceo-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_tasks' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logoff_requests' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const loadData = async () => {
    setLoading(true)

    const [usersRes, tasksRes, leaveRes, logoffRes] = await Promise.all([
      supabase.from('users').select('*').eq('role', 'employee').eq('active', true).order('name'),
      supabase
        .from('daily_tasks')
        .select('*, users(name, avatar_id)')
        .eq('date', today)
        .eq('status', 'submitted'),
      supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('logoff_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    setUsers(usersRes.data || [])
    setTodayTasks(tasksRes.data || [])
    setPendingLeave(leaveRes.count || 0)
    setPendingLogoff(logoffRes.count || 0)
    setLoading(false)
  }

  if (loading) return <Loader label="Loading dashboard" />

  const submittedUserIds = new Set(todayTasks.map((t) => t.user_id))

  return (
    <div>
      <PageHeader
        eyebrow="Executive Overview"
        title="Dashboard"
        subtitle="Team activity at a glance"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <StatCard icon={Users} label="Team Members" value={users.length} />
        <StatCard
          icon={CheckCircle2}
          label="Submitted Today"
          value={`${todayTasks.length} / ${users.length}`}
          accent
        />
        <StatCard
          icon={AlertCircle}
          label="Leave Pending"
          value={pendingLeave}
          to="/approvals"
        />
        <StatCard
          icon={Clock}
          label="Logoff Pending"
          value={pendingLogoff}
          to="/approvals"
        />
      </div>

      {/* Team submissions today */}
      <h3 className="text-sm uppercase tracking-widest font-semibold text-black/60 mb-4">
        Today's Submissions ({formatDate(today)})
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {users.map((u) => {
          const submitted = submittedUserIds.has(u.id)
          const task = todayTasks.find((t) => t.user_id === u.id)
          const avatar = getAvatar(u.avatar_id)
          return (
            <Link
              key={u.id}
              to={`/team/${u.id}`}
              className={`bg-white border p-4 hover:bg-black/[0.02] transition-colors ${
                submitted ? 'border-[#C5F542]/40' : 'border-black/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: avatar.bg }}
                >
                  {avatar.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u.name}</div>
                  <div className="text-xs text-black/50 truncate">{u.designation}</div>
                  <div className="mt-2">
                    {submitted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold bg-[#C5F542] text-black px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                        {task?.total_hours || 0}h logged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent, to }) {
  const content = (
    <div
      className={`p-5 border ${
        accent ? 'bg-black text-white border-black' : 'bg-white border-black/10'
      } ${to ? 'hover:bg-black/[0.02] transition-colors cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={`w-4 h-4 ${accent ? '' : 'text-black/40'}`}
          style={accent ? { color: '#C5F542' } : {}}
          strokeWidth={1.8}
        />
        <span
          className={`text-[10px] uppercase tracking-widest font-semibold ${
            accent ? 'text-white/60' : 'text-black/50'
          }`}
        >
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}
