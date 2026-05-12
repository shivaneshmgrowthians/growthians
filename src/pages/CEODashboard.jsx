import { useEffect, useState } from 'react'
import { Users, CheckCircle2, AlertCircle, Clock, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayISO, formatDate } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader, Loader, Modal } from '../components/ui'
import { getAvatar } from '../lib/avatars'
import DailyTaskGrid from '../components/DailyTaskGrid'

export default function CEODashboard() {
  const { profile } = useAuth()
  const [users, setUsers] = useState([])
  const [todayTasks, setTodayTasks] = useState([])
  const [pendingLeave, setPendingLeave] = useState(0)
  const [pendingLogoff, setPendingLogoff] = useState(0)
  const [loading, setLoading] = useState(true)
  const [spectateUser, setSpectateUser] = useState(null)
  const [spectateSlots, setSpectateSlots] = useState([])
  const [spectateTask, setSpectateTask] = useState(null)
  const [spectateLoading, setSpectateLoading] = useState(false)

  const today = todayISO()

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

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
      supabase.from('daily_tasks').select('*, users(name, avatar_id)').eq('date', today),
      supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('logoff_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setUsers(usersRes.data || [])
    setTodayTasks(tasksRes.data || [])
    setPendingLeave(leaveRes.count || 0)
    setPendingLogoff(logoffRes.count || 0)
    setLoading(false)
  }

  const openSpectate = async (user) => {
    setSpectateUser(user)
    setSpectateLoading(true)
    const { data } = await supabase
      .from('daily_tasks')
      .select('*, task_slots(*)')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()
    setSpectateTask(data)
    setSpectateSlots(data?.task_slots || [])
    setSpectateLoading(false)
  }

  if (loading) return <Loader label="Loading dashboard" />

  const submittedIds = new Set(todayTasks.filter(t => t.status === 'submitted').map(t => t.user_id))
  const draftIds = new Set(todayTasks.filter(t => t.status === 'draft').map(t => t.user_id))

  return (
    <div>
      <PageHeader
        eyebrow="Executive Overview"
        title="Dashboard"
        subtitle="Team activity at a glance"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <StatCard icon={Users} label="Team Members" value={users.length} />
        <StatCard icon={CheckCircle2} label="Submitted Today" value={`${submittedIds.size} / ${users.length}`} accent />
        <StatCard icon={AlertCircle} label="Leave Pending" value={pendingLeave} to="/approvals" />
        <StatCard icon={Clock} label="Logoff Pending" value={pendingLogoff} to="/approvals" />
      </div>

      <h3 className="text-sm uppercase tracking-widest font-semibold text-black/60 mb-4">
        Today's Submissions ({formatDate(today)})
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
        {users.map((u) => {
          const isSubmitted = submittedIds.has(u.id)
          const isDraft = draftIds.has(u.id)
          const task = todayTasks.find((t) => t.user_id === u.id)
          const avatar = getAvatar(u.avatar_id)
          return (
            <div
              key={u.id}
              className={`bg-white border p-4 transition-colors ${
                isSubmitted ? 'border-[#C5F542]/40' : 'border-black/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 flex items-center justify-center text-lg flex-shrink-0" style={{ background: avatar.bg }}>
                  {avatar.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u.name}</div>
                  <div className="text-xs text-black/50 truncate">{u.designation}</div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold bg-[#C5F542] text-black px-2 py-0.5">
                        <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                        {task?.total_hours || 0}h logged
                      </span>
                    ) : isDraft ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5">
                        In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold bg-black/5 text-black/40 px-2 py-0.5">
                        Not Started
                      </span>
                    )}
                  </div>
                  {task?.login_time && (
                    <div className="text-[10px] text-black/40 mt-1">
                      In: {task.login_time}{task.logoff_time ? ` · Out: ${task.logoff_time}` : ''}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => openSpectate(u)}
                    className="p-2 text-black/30 hover:text-black hover:bg-black/5 transition-colors"
                    title="View today's sheet"
                  >
                    <Eye className="w-4 h-4" strokeWidth={1.8} />
                  </button>
                  <Link
                    to={`/team/${u.id}`}
                    className="text-[10px] uppercase tracking-widest text-black/40 hover:text-black text-center"
                  >
                    History
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Spectate Modal */}
      {spectateUser && (
        <Modal title={`${spectateUser.name}'s Today Sheet`} onClose={() => { setSpectateUser(null); setSpectateSlots([]); setSpectateTask(null) }}>
          {spectateLoading ? <Loader /> : (
            spectateSlots.length === 0 ? (
              <div className="text-center text-black/50 py-8 text-sm">No tasks filled yet today</div>
            ) : (
              <div>
                {spectateTask && (
                  <div className="flex items-center gap-4 mb-3 text-xs text-black/50">
                    {spectateTask.login_time && <span>Login: <strong className="text-black">{spectateTask.login_time}</strong></span>}
                    {spectateTask.logoff_time && <span>Logoff: <strong className="text-black">{spectateTask.logoff_time}</strong></span>}
                    {spectateTask.total_hours && <span>Hours: <strong className="text-black">{spectateTask.total_hours}h</strong></span>}
                    <span className={`uppercase tracking-widest font-semibold px-2 py-0.5 ${
                      spectateTask.status === 'submitted' ? 'bg-[#C5F542] text-black' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {spectateTask.status}
                    </span>
                  </div>
                )}
                <DailyTaskGrid slots={spectateSlots} date={today} />
              </div>
            )
          )}
        </Modal>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent, to }) {
  const content = (
    <div className={`p-5 border ${accent ? 'bg-black text-white border-black' : 'bg-white border-black/10'} ${to ? 'hover:bg-black/[0.02] transition-colors cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ? '' : 'text-black/40'}`} style={accent ? { color: '#C5F542' } : {}} strokeWidth={1.8} />
        <span className={`text-[10px] uppercase tracking-widest font-semibold ${accent ? 'text-white/60' : 'text-black/50'}`}>{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}