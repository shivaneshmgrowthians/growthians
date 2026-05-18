import { useEffect, useState, useRef } from 'react'
import { Users, CheckCircle2, AlertCircle, Clock, Eye, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { todayISO, formatDate } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { PageHeader, Loader, Modal } from '../components/ui'
import { getAvatar } from '../lib/avatars'
import DailyTaskGrid from '../components/DailyTaskGrid'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'

const COLORS = ['#C5F542', '#000000', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']

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
  const spectateTimer = useRef(null)

  // Analytics state
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date())
  const [monthTasks, setMonthTasks] = useState([])
  const [monthLeaves, setMonthLeaves] = useState([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const today = todayISO()

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

  useEffect(() => {
    if (profile?.id && users.length > 0) loadAnalytics()
  }, [profile?.id, users, analyticsMonth])

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

  useEffect(() => {
    return () => { if (spectateTimer.current) clearInterval(spectateTimer.current) }
  }, [])

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

  const loadAnalytics = async () => {
    setAnalyticsLoading(true)
    const yr = analyticsMonth.getFullYear()
    const mo = analyticsMonth.getMonth()
    const startDate = `${yr}-${String(mo + 1).padStart(2, '0')}-01`
    const endDay = new Date(yr, mo + 1, 0).getDate()
    const endDate = `${yr}-${String(mo + 1).padStart(2, '0')}-${endDay}`

    const [tasksRes, leavesRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('status', 'submitted').gte('date', startDate).lte('date', endDate),
      supabase.from('leave_requests').select('*').eq('status', 'approved').gte('from_date', startDate).lte('to_date', endDate),
    ])
    setMonthTasks(tasksRes.data || [])
    setMonthLeaves(leavesRes.data || [])
    setAnalyticsLoading(false)
  }

  const refreshSpectate = async (userId) => {
    const { data } = await supabase
      .from('daily_tasks')
      .select('*, task_slots(*)')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
    setSpectateTask(data)
    setSpectateSlots(data?.task_slots || [])
  }

  const openSpectate = async (user) => {
    setSpectateUser(user)
    setSpectateLoading(true)
    await refreshSpectate(user.id)
    setSpectateLoading(false)
    if (spectateTimer.current) clearInterval(spectateTimer.current)
    spectateTimer.current = setInterval(() => refreshSpectate(user.id), 5000)
  }

  const closeSpectate = () => {
    if (spectateTimer.current) clearInterval(spectateTimer.current)
    setSpectateUser(null)
    setSpectateSlots([])
    setSpectateTask(null)
  }

  if (loading) return <Loader label="Loading dashboard" />

  const submittedIds = new Set(todayTasks.filter(t => t.status === 'submitted').map(t => t.user_id))
  const draftIds = new Set(todayTasks.filter(t => t.status === 'draft').map(t => t.user_id))

  // === ANALYTICS DATA ===
  const aYear = analyticsMonth.getFullYear()
  const aMonth = analyticsMonth.getMonth()
  const aMonthName = analyticsMonth.toLocaleString('default', { month: 'long' })
  const aDaysInMonth = new Date(aYear, aMonth + 1, 0).getDate()

  // Count working days (Mon-Fri) in the month up to today or end of month
  const countWorkingDays = () => {
    const todayDate = new Date()
    let count = 0
    for (let d = 1; d <= aDaysInMonth; d++) {
      const date = new Date(aYear, aMonth, d)
      if (date > todayDate) break
      const day = date.getDay()
      if (day !== 0 && day !== 6) count++
    }
    return count
  }
  const workingDays = countWorkingDays()

  // 1. Hours per employee (bar chart)
  const hoursPerEmployee = users.map(u => {
    const tasks = monthTasks.filter(t => t.user_id === u.id)
    const totalHours = tasks.reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)
    return { name: u.name.split(' ')[0], hours: Math.round(totalHours * 10) / 10, fullName: u.name }
  })

  // 2. Attendance rate per employee (bar chart)
  const attendancePerEmployee = users.map(u => {
    const daysSubmitted = monthTasks.filter(t => t.user_id === u.id).length
    const rate = workingDays > 0 ? Math.round((daysSubmitted / workingDays) * 100) : 0
    return { name: u.name.split(' ')[0], rate, days: daysSubmitted, fullName: u.name }
  })

  // 3. Leave overview (pie chart)
  const leaveOverview = users.map((u, i) => {
    const taken = monthLeaves.filter(l => l.user_id === u.id).reduce((sum, l) => sum + (l.days_requested || 0), 0)
    return { name: u.name.split(' ')[0], taken, balance: u.leave_balance || 0, color: COLORS[i % COLORS.length] }
  })

  // 4. Weekly hours trend (line chart)
  const weeklyTrend = (() => {
    const weeks = []
    let weekStart = 1
    while (weekStart <= aDaysInMonth) {
      const weekEnd = Math.min(weekStart + 6, aDaysInMonth)
      const weekLabel = `${weekStart}-${weekEnd}`
      const weekData = { week: weekLabel }

      users.forEach(u => {
        const hours = monthTasks
          .filter(t => {
            if (t.user_id !== u.id) return false
            const day = parseInt(t.date.split('-')[2])
            return day >= weekStart && day <= weekEnd
          })
          .reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)
        weekData[u.name.split(' ')[0]] = Math.round(hours * 10) / 10
      })

      weeks.push(weekData)
      weekStart += 7
    }
    return weeks
  })()

  // 5. Daily submission count (line chart)
  const dailySubmissions = (() => {
    const data = []
    const todayDate = new Date()
    for (let d = 1; d <= aDaysInMonth; d++) {
      const date = new Date(aYear, aMonth, d)
      if (date > todayDate) break
      const day = date.getDay()
      if (day === 0 || day === 6) continue
      const ds = `${aYear}-${String(aMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const count = monthTasks.filter(t => t.date === ds).length
      data.push({ day: d, count, total: users.length })
    }
    return data
  })()

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
        <StatCard icon={CheckCircle2} label="Submitted Today" value={`${submittedIds.size} / ${users.length}`} accent />
        <StatCard icon={AlertCircle} label="Leave Pending" value={pendingLeave} to="/approvals" />
        <StatCard icon={Clock} label="Logoff Pending" value={pendingLogoff} to="/approvals" />
      </div>

      {/* Today's submissions */}
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
            <div key={u.id} className={`bg-white border p-4 transition-colors ${isSubmitted ? 'border-[#C5F542]/40' : 'border-black/10'}`}>
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
                      <span className="text-[10px] uppercase tracking-widest font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5">In Progress</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest font-semibold bg-black/5 text-black/40 px-2 py-0.5">Not Started</span>
                    )}
                  </div>
                  {task?.login_time && (
                    <div className="text-[10px] text-black/40 mt-1">In: {task.login_time}{task.logoff_time ? ` · Out: ${task.logoff_time}` : ''}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => openSpectate(u)} className="p-2 text-black/30 hover:text-black hover:bg-black/5 transition-colors" title="Live view">
                    <Eye className="w-4 h-4" strokeWidth={1.8} />
                  </button>
                  <Link to={`/team/${u.id}`} className="text-[10px] uppercase tracking-widest text-black/40 hover:text-black text-center">History</Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* === ANALYTICS SECTION === */}
      <div className="border-t-2 border-black/10 pt-10 mt-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-black/50 mb-2 font-semibold">Analytics</div>
            <h2 className="text-2xl font-bold">{aMonthName} {aYear}</h2>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setAnalyticsMonth(new Date(aYear, aMonth - 1))} className="p-2 border border-black/10 hover:bg-black/5">
              <ChevronRight className="w-4 h-4 rotate-180" strokeWidth={2} />
            </button>
            <button onClick={() => setAnalyticsMonth(new Date())} className="px-3 py-1 border border-black/10 hover:bg-black/5 text-xs uppercase tracking-widest">This Month</button>
            <button onClick={() => setAnalyticsMonth(new Date(aYear, aMonth + 1))} className="p-2 border border-black/10 hover:bg-black/5">
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {analyticsLoading ? <Loader label="Loading analytics" /> : (
          <div className="space-y-8">

            {/* Row 1: Hours + Attendance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Hours per Employee */}
              <div className="bg-white border border-black/10 p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Hours Logged Per Employee</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hoursPerEmployee}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ border: '1px solid #eee', fontSize: 12 }}
                      formatter={(value) => [`${value}h`, 'Hours']}
                    />
                    <Bar dataKey="hours" fill="#C5F542" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Attendance Rate */}
              <div className="bg-white border border-black/10 p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">
                  Attendance Rate ({workingDays} working days)
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={attendancePerEmployee}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{ border: '1px solid #eee', fontSize: 12 }}
                      formatter={(value, name) => {
                        if (name === 'rate') return [`${value}%`, 'Attendance']
                        return [value, name]
                      }}
                    />
                    <Bar dataKey="rate" fill="#000" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 2: Daily Submissions + Weekly Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Daily Submissions */}
              <div className="bg-white border border-black/10 p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Daily Submissions This Month</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailySubmissions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, users.length]} />
                    <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="#C5F542" strokeWidth={2} dot={{ fill: '#C5F542', r: 3 }} name="Submitted" />
                    <Line type="monotone" dataKey="total" stroke="#ddd" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Team Size" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Weekly Hours Trend */}
              <div className="bg-white border border-black/10 p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Weekly Hours Trend</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {users.map((u, i) => (
                      <Line
                        key={u.id}
                        type="monotone"
                        dataKey={u.name.split(' ')[0]}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 3: Leave Overview */}
            <div className="bg-white border border-black/10 p-5">
              <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Leave Overview</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={leaveOverview.filter(l => l.taken > 0)}
                      dataKey="taken"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, taken }) => `${name}: ${taken}d`}
                      labelLine={{ stroke: '#999' }}
                    >
                      {leaveOverview.filter(l => l.taken > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {leaveOverview.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-black/[0.02] border border-black/5">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 flex-shrink-0" style={{ background: u.color }} />
                        <span className="text-sm font-semibold">{u.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-black/50">Taken: <strong className="text-black">{u.taken}</strong></span>
                        <span className="text-black/50">Balance: <strong className="text-black">{u.balance}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Spectate Modal */}
      {spectateUser && (
        <Modal title={`${spectateUser.name}'s Today Sheet (Live)`} onClose={closeSpectate} wide>
          {spectateLoading ? <Loader /> : (
            spectateSlots.length === 0 ? (
              <div className="text-center text-black/50 py-8 text-sm">No tasks filled yet today</div>
            ) : (
              <div>
                {spectateTask && (
                  <div className="flex items-center gap-4 mb-3 text-xs text-black/50 flex-wrap">
                    {spectateTask.login_time && <span>Login: <strong className="text-black">{spectateTask.login_time}</strong></span>}
                    {spectateTask.logoff_time && <span>Logoff: <strong className="text-black">{spectateTask.logoff_time}</strong></span>}
                    {spectateTask.total_hours && <span>Hours: <strong className="text-black">{spectateTask.total_hours}h</strong></span>}
                    <span className={`uppercase tracking-widest font-semibold px-2 py-0.5 ${
                      spectateTask.status === 'submitted' ? 'bg-[#C5F542] text-black' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {spectateTask.status}
                    </span>
                    <span className="text-[10px] text-black/30 animate-pulse">● Live</span>
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