import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Send, Settings, Trash2, CheckCircle2, Clock, Timer, TrendingUp, ListTodo, Undo2, Eye, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayISO, formatDateLong, calculateHours, getCurrentTime, getWeekMonday } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Loader, Button, Modal } from '../components/ui'
import SlotsManagerModal from '../components/SlotsManagerModal'
import { getAvatar } from '../lib/avatars'
import DailyTaskGrid from '../components/DailyTaskGrid'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'

export default function EmployeeTodaySheet() {
  const { profile, loginTime } = useAuth()
  const { showToast } = useToast()
  const [userSlots, setUserSlots] = useState([])
  const [todaySlots, setTodaySlots] = useState([])
  const [dailyTaskId, setDailyTaskId] = useState(null)
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [showSlotsModal, setShowSlotsModal] = useState(false)
  const [weeklyHours, setWeeklyHours] = useState('0.0')
  const [frozenLoginTime, setFrozenLoginTime] = useState(null)
  const [frozenLogoffTime, setFrozenLogoffTime] = useState(null)
  const [teamToday, setTeamToday] = useState([])
  const [spectateUser, setSpectateUser] = useState(null)
  const [spectateSlots, setSpectateSlots] = useState([])
  const [spectateTask, setSpectateTask] = useState(null)
  const [spectateLoading, setSpectateLoading] = useState(false)
  const autoSaveInterval = useRef(null)
  const spectateTimer = useRef(null)

  // Analytics state
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date())
  const [monthTasks, setMonthTasks] = useState([])
  const [monthLeaves, setMonthLeaves] = useState([])

  const today = todayISO()
  const submitted = status === 'submitted'

  useEffect(() => {
    if (profile?.id) {
      loadData()
      loadTeamToday()
    }
  }, [profile?.id])

  useEffect(() => {
    if (profile?.id) loadAnalytics()
  }, [profile?.id, analyticsMonth])

  useEffect(() => {
    if (!profile?.id || submitted) return
    autoSaveInterval.current = setInterval(() => {
      if (todaySlots.length > 0 && dailyTaskId) {
        autosave(todaySlots)
      }
    }, 5000)
    return () => clearInterval(autoSaveInterval.current)
  }, [profile?.id, submitted, todaySlots, dailyTaskId])

  useEffect(() => {
    return () => { if (spectateTimer.current) clearInterval(spectateTimer.current) }
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: slotsData } = await supabase
      .from('user_slots')
      .select('*')
      .eq('user_id', profile.id)
      .order('slot_index', { ascending: true })
    setUserSlots(slotsData || [])

    const { data: taskData } = await supabase
      .from('daily_tasks')
      .select('*, task_slots(*)')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle()

    if (taskData) {
      setDailyTaskId(taskData.id)
      setStatus(taskData.status)
      setFrozenLoginTime(taskData.login_time || null)
      setFrozenLogoffTime(taskData.logoff_time || null)
    }

    const merged = (slotsData || []).map((us) => {
      const found = taskData?.task_slots?.find((ts) => ts.slot_index === us.slot_index)
      return {
        slot_index: us.slot_index,
        time_slot: us.time_slot,
        tasks_worked_on: found?.tasks_worked_on || '',
        days_agenda: found?.days_agenda || '',
        task_pending: found?.task_pending || '',
      }
    })
    setTodaySlots(merged)

    if (!taskData && loginTime) {
      const { data: newTask } = await supabase
        .from('daily_tasks')
        .insert({ user_id: profile.id, date: today, status: 'draft', login_time: loginTime })
        .select()
        .single()
      if (newTask) {
        setDailyTaskId(newTask.id)
        setFrozenLoginTime(loginTime)
      }
    }

    await loadWeeklyHours()
    setLoading(false)
  }

  const loadAnalytics = async () => {
    const yr = analyticsMonth.getFullYear()
    const mo = analyticsMonth.getMonth()
    const startDate = `${yr}-${String(mo + 1).padStart(2, '0')}-01`
    const endDay = new Date(yr, mo + 1, 0).getDate()
    const endDate = `${yr}-${String(mo + 1).padStart(2, '0')}-${endDay}`

    const [tasksRes, leavesRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('user_id', profile.id).eq('status', 'submitted').gte('date', startDate).lte('date', endDate),
      supabase.from('leave_requests').select('*').eq('user_id', profile.id).eq('status', 'approved').gte('from_date', startDate).lte('to_date', endDate),
    ])
    setMonthTasks(tasksRes.data || [])
    setMonthLeaves(leavesRes.data || [])
  }

  const loadTeamToday = async () => {
    const { data: users } = await supabase
      .from('users')
      .select('id, name, avatar_id, designation')
      .eq('active', true)
      .neq('id', profile.id)
    if (!users?.length) return
    const { data: tasks } = await supabase
      .from('daily_tasks')
      .select('user_id, status, login_time, logoff_time')
      .eq('date', today)
      .in('user_id', users.map(u => u.id))
    const merged = users.map(u => {
      const task = tasks?.find(t => t.user_id === u.id)
      return { ...u, task_status: task?.status || 'not started', login_time: task?.login_time, logoff_time: task?.logoff_time }
    })
    setTeamToday(merged)
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

  const loadWeeklyHours = async () => {
    const monday = getWeekMonday()
    const { data } = await supabase
      .from('daily_tasks')
      .select('total_hours')
      .eq('user_id', profile.id)
      .eq('status', 'submitted')
      .gte('date', monday.toISOString().split('T')[0])
    const total = (data || []).reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)
    setWeeklyHours(total.toFixed(1))
  }

  const autosave = useCallback(
    async (newSlots) => {
      if (!profile?.id || status === 'submitted') return
      let taskId = dailyTaskId
      if (!taskId) {
        const { data, error } = await supabase
          .from('daily_tasks')
          .insert({ user_id: profile.id, date: today, status: 'draft', login_time: loginTime })
          .select()
          .single()
        if (error) return
        taskId = data.id
        setDailyTaskId(taskId)
        setFrozenLoginTime(loginTime)
      }
      await supabase.from('task_slots').delete().eq('daily_task_id', taskId)
      const slotRows = newSlots.map((s) => ({
        daily_task_id: taskId,
        slot_index: s.slot_index,
        time_slot: s.time_slot,
        tasks_worked_on: s.tasks_worked_on,
        days_agenda: s.days_agenda,
        task_pending: s.task_pending,
      }))
      await supabase.from('task_slots').insert(slotRows)
    },
    [profile?.id, dailyTaskId, status, today, loginTime],
  )

  const updateSlot = (slotIndex, field, value) => {
    const newSlots = todaySlots.map((s) =>
      s.slot_index === slotIndex ? { ...s, [field]: value } : s,
    )
    setTodaySlots(newSlots)
  }

  const handleAddSlot = async (timeStr) => {
    const newIndex = userSlots.length > 0 ? Math.max(...userSlots.map((s) => s.slot_index)) + 1 : 0
    const { data, error } = await supabase
      .from('user_slots')
      .insert({ user_id: profile.id, slot_index: newIndex, time_slot: timeStr })
      .select()
      .single()
    if (error) { showToast('Failed to add slot', 'error'); return }
    setUserSlots([...userSlots, data])
    setTodaySlots([...todaySlots, { slot_index: newIndex, time_slot: timeStr, tasks_worked_on: '', days_agenda: '', task_pending: '' }])
    showToast('Slot added')
  }

  const handleRemoveSlot = async (slot) => {
    if (!slot.id) return
    await supabase.from('user_slots').delete().eq('id', slot.id)
    setUserSlots(userSlots.filter((s) => s.id !== slot.id))
    setTodaySlots(todaySlots.filter((s) => s.slot_index !== slot.slot_index))
    if (dailyTaskId) {
      await supabase.from('task_slots').delete().eq('daily_task_id', dailyTaskId).eq('slot_index', slot.slot_index)
    }
  }

  const handleSubmit = async () => {
    const hasContent = todaySlots.some((s) => s.tasks_worked_on?.trim())
    if (!hasContent) { showToast('Please fill at least one time slot', 'error'); return }
    setSubmitting(true)
    await autosave(todaySlots)
    const totalHours = calculateHours(todaySlots)
    const logoffTime = getCurrentTime()
    const { error } = await supabase
      .from('daily_tasks')
      .update({ status: 'submitted', submitted_at: new Date().toISOString(), logoff_time: logoffTime, total_hours: totalHours })
      .eq('id', dailyTaskId)
    if (error) { showToast('Failed to submit', 'error'); setSubmitting(false); return }
    const { data: ceos } = await supabase.from('users').select('id').eq('role', 'ceo').eq('active', true)
    if (ceos?.length) {
      const notifs = ceos.map((ceo) => ({ recipient_id: ceo.id, type: 'task_submitted', message: `${profile.name} submitted daily tasks (${totalHours}h)`, related_id: dailyTaskId }))
      await supabase.from('notifications').insert(notifs)
    }
    setStatus('submitted')
    setFrozenLogoffTime(logoffTime)
    showToast(`Day submitted · ${totalHours} hours logged`)
    setSubmitting(false)
    loadWeeklyHours()
    loadAnalytics()
  }

  const handleRevert = async () => {
    setReverting(true)
    const { error } = await supabase
      .from('daily_tasks')
      .update({ status: 'draft', submitted_at: null, logoff_time: null, total_hours: null })
      .eq('id', dailyTaskId)
    if (error) { showToast('Failed to revert', 'error'); setReverting(false); return }
    setStatus('draft')
    setFrozenLogoffTime(null)
    showToast('Reverted to draft — you can edit again')
    setReverting(false)
  }

  if (loading) return <Loader label="Loading today's sheet" />

  const todayHours = calculateHours(todaySlots)
  const filledCount = todaySlots.filter((s) => s.tasks_worked_on?.trim()).length
  const displayLoginTime = frozenLoginTime || loginTime || '—'

  // === ANALYTICS ===
  const aYear = analyticsMonth.getFullYear()
  const aMonth = analyticsMonth.getMonth()
  const aMonthName = analyticsMonth.toLocaleString('default', { month: 'long' })
  const aDaysInMonth = new Date(aYear, aMonth + 1, 0).getDate()

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
  const daysSubmitted = monthTasks.length
  const attendanceRate = workingDays > 0 ? Math.round((daysSubmitted / workingDays) * 100) : 0
  const totalMonthHours = monthTasks.reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)
  const leavesTaken = monthLeaves.reduce((sum, l) => sum + (l.days_requested || 0), 0)

  // Daily hours chart
  const dailyHoursData = (() => {
    const data = []
    const todayDate = new Date()
    for (let d = 1; d <= aDaysInMonth; d++) {
      const date = new Date(aYear, aMonth, d)
      if (date > todayDate) break
      const day = date.getDay()
      if (day === 0 || day === 6) continue
      const ds = `${aYear}-${String(aMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const task = monthTasks.find(t => t.date === ds)
      data.push({ day: d, hours: task ? Math.round(parseFloat(task.total_hours || 0) * 10) / 10 : 0 })
    }
    return data
  })()

  // Weekly hours chart
  const weeklyHoursData = (() => {
    const weeks = []
    let weekStart = 1
    while (weekStart <= aDaysInMonth) {
      const weekEnd = Math.min(weekStart + 6, aDaysInMonth)
      const hours = monthTasks
        .filter(t => {
          const day = parseInt(t.date.split('-')[2])
          return day >= weekStart && day <= weekEnd
        })
        .reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)
      weeks.push({ week: `${weekStart}-${weekEnd}`, hours: Math.round(hours * 10) / 10 })
      weekStart += 7
    }
    return weeks
  })()

  // Attendance donut
  const attendanceDonut = [
    { name: 'Present', value: daysSubmitted, color: '#C5F542' },
    { name: 'Absent', value: Math.max(0, workingDays - daysSubmitted - leavesTaken), color: '#E5E5E5' },
    { name: 'Leave', value: leavesTaken, color: '#F59E0B' },
  ].filter(d => d.value > 0)

  return (
    <div>
      <PageHeader
        eyebrow={formatDateLong(today)}
        title="Today's Sheet"
        subtitle="Fill in your work hour by hour. Auto-saves every 5 seconds."
        action={
          <div className="flex items-center gap-2">
            {submitted && (
              <Button variant="secondary" onClick={handleRevert} disabled={reverting}>
                <Undo2 className="w-4 h-4" strokeWidth={2} />
                {reverting ? 'Reverting...' : 'Undo Submit'}
              </Button>
            )}
            {!submitted && (
              <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                <Send className="w-4 h-4" strokeWidth={2} />
                {submitting ? 'Submitting...' : 'Submit Day'}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatBlock icon={Clock} label="Login Time" value={displayLoginTime} />
        <StatBlock icon={Timer} label="Today's Hours" value={`${todayHours} h`} accent />
        <StatBlock icon={TrendingUp} label="Weekly Total" value={`${weeklyHours} h`} subtitle="resets Monday" />
        <StatBlock icon={ListTodo} label="Slots Used" value={`${filledCount}/${todaySlots.length}`} />
      </div>

      {submitted && (
        <div className="mb-6 bg-[#C5F542] p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-black" strokeWidth={2} />
          <div className="flex-1">
            <div className="font-semibold text-black">Day submitted · {todayHours} hours logged</div>
            <div className="text-xs text-black/70">
              Login: {displayLoginTime} · Logoff: {frozenLogoffTime || '—'} · CEO has been notified
            </div>
          </div>
        </div>
      )}

      {/* Task Sheet */}
      <div className="border-2 border-black/20 overflow-hidden mb-6">
        <div className="grid grid-cols-3 bg-black text-white divide-x divide-white/10">
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider">Tasks Worked On</h3>
            {!submitted && (
              <button
                onClick={() => setShowSlotsModal(true)}
                className="text-[10px] uppercase tracking-wider bg-white/10 hover:bg-white/20 px-2 py-1 transition-colors flex items-center gap-1"
              >
                <Settings className="w-3 h-3" strokeWidth={2} />
                Slots
              </button>
            )}
          </div>
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Day's Agenda</h3>
          </div>
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Task Pending</h3>
          </div>
        </div>

        {todaySlots.map((slot) => (
          <div key={slot.slot_index} className="grid grid-cols-3 border-t border-black/10 divide-x divide-black/10 group">
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/5 border-b border-black/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">{slot.time_slot}</span>
                {!submitted && todaySlots.length > 1 && (
                  <button
                    onClick={() => handleRemoveSlot(userSlots.find((s) => s.slot_index === slot.slot_index))}
                    className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-black transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <textarea
                disabled={submitted}
                value={slot.tasks_worked_on}
                onChange={(e) => updateSlot(slot.slot_index, 'tasks_worked_on', e.target.value)}
                className="flex-1 w-full px-3 py-2 text-sm bg-white focus:outline-none disabled:text-black resize-none"
                style={{ minHeight: '90px' }}
                placeholder="What did you work on?"
              />
            </div>
            <div className="flex flex-col">
              <div className="px-3 py-1.5 bg-black/5 border-b border-black/10"><span className="text-[10px] invisible">x</span></div>
              <textarea
                disabled={submitted}
                value={slot.days_agenda}
                onChange={(e) => updateSlot(slot.slot_index, 'days_agenda', e.target.value)}
                className="flex-1 w-full px-3 py-2 text-sm bg-white focus:outline-none disabled:text-black resize-none"
                style={{ minHeight: '90px' }}
                placeholder="—"
              />
            </div>
            <div className="flex flex-col">
              <div className="px-3 py-1.5 bg-black/5 border-b border-black/10"><span className="text-[10px] invisible">x</span></div>
              <textarea
                disabled={submitted}
                value={slot.task_pending}
                onChange={(e) => updateSlot(slot.slot_index, 'task_pending', e.target.value)}
                className="flex-1 w-full px-3 py-2 text-sm bg-white focus:outline-none disabled:text-black resize-none"
                style={{ minHeight: '90px' }}
                placeholder="—"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Team Today */}
      {teamToday.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm uppercase tracking-widest font-semibold text-black/50 mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" strokeWidth={1.8} />
            Team's Today
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {teamToday.map((u) => {
              const avatar = getAvatar(u.avatar_id)
              return (
                <button key={u.id} onClick={() => openSpectate(u)} className="bg-white border border-black/10 p-4 text-left hover:border-black/30 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: avatar.bg }}>{avatar.emoji}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{u.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-black/50">{u.designation}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${
                    u.task_status === 'submitted' ? 'bg-[#C5F542] text-black' :
                    u.task_status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-black/5 text-black/40'
                  }`}>
                    {u.task_status === 'submitted' ? 'Submitted' : u.task_status === 'draft' ? 'In Progress' : 'Not Started'}
                  </span>
                  {u.login_time && <div className="text-[10px] text-black/40 mt-1">In: {u.login_time}</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* === MY ANALYTICS === */}
      <div className="border-t-2 border-black/10 pt-8 mt-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-black/50 mb-1 font-semibold">My Analytics</div>
            <h3 className="text-xl font-bold">{aMonthName} {aYear}</h3>
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

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-black text-white p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">Total Hours</div>
            <div className="text-3xl font-bold" style={{ color: '#C5F542' }}>{Math.round(totalMonthHours * 10) / 10}h</div>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1">Attendance</div>
            <div className="text-3xl font-bold">{attendanceRate}%</div>
            <div className="text-[10px] text-black/40">{daysSubmitted} / {workingDays} days</div>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1">Leaves Taken</div>
            <div className="text-3xl font-bold">{leavesTaken}</div>
            <div className="text-[10px] text-black/40">Balance: {profile?.leave_balance || 0}</div>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1">Avg Hours/Day</div>
            <div className="text-3xl font-bold">{daysSubmitted > 0 ? Math.round((totalMonthHours / daysSubmitted) * 10) / 10 : 0}h</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Hours */}
          <div className="bg-white border border-black/10 p-5">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Daily Hours</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyHoursData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 12 }} formatter={(v) => [`${v}h`, 'Hours']} />
                <Bar dataKey="hours" fill="#C5F542" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly Hours */}
          <div className="bg-white border border-black/10 p-5">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Weekly Hours</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyHoursData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 12 }} formatter={(v) => [`${v}h`, 'Hours']} />
                <Bar dataKey="hours" fill="#000" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Donut */}
        <div className="bg-white border border-black/10 p-5">
          <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Attendance Breakdown</h4>
          <div className="flex items-center gap-8 flex-wrap">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={attendanceDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {attendanceDonut.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {attendanceDonut.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-sm">{d.name}: <strong>{d.value} days</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                    }`}>{spectateTask.status}</span>
                    <span className="text-[10px] text-black/30 animate-pulse">● Live</span>
                  </div>
                )}
                <DailyTaskGrid slots={spectateSlots} date={today} />
              </div>
            )
          )}
        </Modal>
      )}

      {showSlotsModal && (
        <SlotsManagerModal
          slots={userSlots}
          onAddSlot={handleAddSlot}
          onRemoveSlot={handleRemoveSlot}
          onClose={() => setShowSlotsModal(false)}
        />
      )}
    </div>
  )
}

function StatBlock({ icon: Icon, label, value, subtitle, accent }) {
  return (
    <div className={`p-4 border ${accent ? 'bg-black text-white border-black' : 'bg-white border-black/10'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent ? '' : 'text-black/40'}`} style={accent ? { color: '#C5F542' } : {}} strokeWidth={1.8} />
        <span className={`text-[10px] uppercase tracking-widest font-semibold ${accent ? 'text-white/60' : 'text-black/50'}`}>{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className={`text-[10px] mt-1 ${accent ? 'text-white/50' : 'text-black/50'}`}>{subtitle}</div>}
    </div>
  )
}