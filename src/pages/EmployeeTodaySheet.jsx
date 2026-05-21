import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Send, Settings, Trash2, CheckCircle2, Clock, Timer, TrendingUp, ListTodo, Undo2, Eye, ChevronRight, ChevronDown, BarChart3,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayISO, formatDateLong, calculateHours, getWeekMonday } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Loader, Button, Modal } from '../components/ui'
import SlotsManagerModal from '../components/SlotsManagerModal'
import { getAvatar } from '../lib/avatars'
import DailyTaskGrid from '../components/DailyTaskGrid'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

function calcWorkHours(inTime, outTime) {
  if (!inTime || !outTime) return 0
  const parse = (t) => {
    const match = t.match(/(\d+):(\d+)\s*(am|pm)/i)
    if (!match) return 0
    let h = parseInt(match[1]); const m = parseInt(match[2]); const p = match[3].toLowerCase()
    if (p === 'pm' && h !== 12) h += 12
    if (p === 'am' && h === 12) h = 0
    return h * 60 + m
  }
  const diff = parse(outTime) - parse(inTime)
  return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0
}

export default function EmployeeTodaySheet() {
  const { profile, clockedIn, clockedOut, clockInTime, clockOutTime } = useAuth()
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
  const [teamToday, setTeamToday] = useState([])
  const [spectateUser, setSpectateUser] = useState(null)
  const [spectateSlots, setSpectateSlots] = useState([])
  const [spectateTask, setSpectateTask] = useState(null)
  const [spectateLoading, setSpectateLoading] = useState(false)
  const [mobileTab, setMobileTab] = useState('tasks')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const autoSaveInterval = useRef(null)
  const spectateTimer = useRef(null)

  const [analyticsMonth, setAnalyticsMonth] = useState(new Date())
  const [monthTasks, setMonthTasks] = useState([])
  const [monthLeaves, setMonthLeaves] = useState([])

  const today = todayISO()
  const submitted = status === 'submitted'
  const totalWorkHours = calcWorkHours(clockInTime, clockOutTime)

  useEffect(() => {
    if (profile?.id && clockedIn) { loadData(); loadTeamToday() }
  }, [profile?.id, clockedIn])

  useEffect(() => {
    if (profile?.id) loadAnalytics()
  }, [profile?.id, analyticsMonth])

  useEffect(() => {
    if (!profile?.id || submitted || !clockedIn) return
    autoSaveInterval.current = setInterval(() => {
      if (todaySlots.length > 0 && dailyTaskId) autosave(todaySlots)
    }, 5000)
    return () => clearInterval(autoSaveInterval.current)
  }, [profile?.id, submitted, todaySlots, dailyTaskId, clockedIn])

  useEffect(() => {
    return () => { if (spectateTimer.current) clearInterval(spectateTimer.current) }
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: slotsData } = await supabase.from('user_slots').select('*').eq('user_id', profile.id).order('slot_index', { ascending: true })
    setUserSlots(slotsData || [])
    const { data: taskData } = await supabase.from('daily_tasks').select('*, task_slots(*)').eq('user_id', profile.id).eq('date', today).maybeSingle()
    if (taskData) { setDailyTaskId(taskData.id); setStatus(taskData.status) }
    const merged = (slotsData || []).map((us) => {
      const found = taskData?.task_slots?.find((ts) => ts.slot_index === us.slot_index)
      return { slot_index: us.slot_index, time_slot: us.time_slot, tasks_worked_on: found?.tasks_worked_on || '', days_agenda: found?.days_agenda || '', task_pending: found?.task_pending || '' }
    })
    setTodaySlots(merged)
    await loadWeeklyHours()
    setLoading(false)
  }

  const loadAnalytics = async () => {
    const yr = analyticsMonth.getFullYear(); const mo = analyticsMonth.getMonth()
    const startDate = `${yr}-${String(mo + 1).padStart(2, '0')}-01`
    const endDay = new Date(yr, mo + 1, 0).getDate()
    const endDate = `${yr}-${String(mo + 1).padStart(2, '0')}-${endDay}`
    const [tasksRes, leavesRes] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('user_id', profile.id).eq('status', 'submitted').gte('date', startDate).lte('date', endDate),
      supabase.from('leave_requests').select('*').eq('user_id', profile.id).eq('status', 'approved').gte('from_date', startDate).lte('to_date', endDate),
    ])
    setMonthTasks(tasksRes.data || []); setMonthLeaves(leavesRes.data || [])
  }

  const loadTeamToday = async () => {
    const { data: users } = await supabase.from('users').select('id, name, avatar_id, designation').eq('active', true).neq('id', profile.id)
    if (!users?.length) return
    const { data: tasks } = await supabase.from('daily_tasks').select('user_id, status, clock_in_time, clock_out_time').eq('date', today).in('user_id', users.map(u => u.id))
    setTeamToday(users.map(u => { const task = tasks?.find(t => t.user_id === u.id); return { ...u, task_status: task?.status || 'not started', clock_in_time: task?.clock_in_time, clock_out_time: task?.clock_out_time } }))
  }

  const refreshSpectate = async (userId) => {
    const { data } = await supabase.from('daily_tasks').select('*, task_slots(*)').eq('user_id', userId).eq('date', today).maybeSingle()
    setSpectateTask(data); setSpectateSlots(data?.task_slots || [])
  }
  const openSpectate = async (user) => {
    setSpectateUser(user); setSpectateLoading(true); await refreshSpectate(user.id); setSpectateLoading(false)
    if (spectateTimer.current) clearInterval(spectateTimer.current)
    spectateTimer.current = setInterval(() => refreshSpectate(user.id), 5000)
  }
  const closeSpectate = () => { if (spectateTimer.current) clearInterval(spectateTimer.current); setSpectateUser(null); setSpectateSlots([]); setSpectateTask(null) }

  const loadWeeklyHours = async () => {
    const monday = getWeekMonday()
    const { data } = await supabase.from('daily_tasks').select('total_hours').eq('user_id', profile.id).eq('status', 'submitted').gte('date', monday.toISOString().split('T')[0])
    setWeeklyHours(((data || []).reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)).toFixed(1))
  }

  const autosave = useCallback(async (newSlots) => {
    if (!profile?.id || status === 'submitted') return
    let taskId = dailyTaskId
    if (!taskId) return
    await supabase.from('task_slots').delete().eq('daily_task_id', taskId)
    await supabase.from('task_slots').insert(newSlots.map((s) => ({ daily_task_id: taskId, slot_index: s.slot_index, time_slot: s.time_slot, tasks_worked_on: s.tasks_worked_on, days_agenda: s.days_agenda, task_pending: s.task_pending })))
  }, [profile?.id, dailyTaskId, status])

  const updateSlot = (slotIndex, field, value) => { setTodaySlots(todaySlots.map((s) => s.slot_index === slotIndex ? { ...s, [field]: value } : s)) }

  const handleAddSlot = async (timeStr) => {
    const newIndex = userSlots.length > 0 ? Math.max(...userSlots.map((s) => s.slot_index)) + 1 : 0
    const { data, error } = await supabase.from('user_slots').insert({ user_id: profile.id, slot_index: newIndex, time_slot: timeStr }).select().single()
    if (error) { showToast('Failed to add slot', 'error'); return }
    setUserSlots([...userSlots, data]); setTodaySlots([...todaySlots, { slot_index: newIndex, time_slot: timeStr, tasks_worked_on: '', days_agenda: '', task_pending: '' }]); showToast('Slot added')
  }

  const handleRemoveSlot = async (slot) => {
    if (!slot.id) return
    await supabase.from('user_slots').delete().eq('id', slot.id)
    setUserSlots(userSlots.filter((s) => s.id !== slot.id)); setTodaySlots(todaySlots.filter((s) => s.slot_index !== slot.slot_index))
    if (dailyTaskId) await supabase.from('task_slots').delete().eq('daily_task_id', dailyTaskId).eq('slot_index', slot.slot_index)
  }

  const handleSubmit = async () => {
    if (!todaySlots.some((s) => s.tasks_worked_on?.trim())) { showToast('Please fill at least one time slot', 'error'); return }
    setSubmitting(true); await autosave(todaySlots)
    const totalHours = totalWorkHours || calculateHours(todaySlots)
    const { error } = await supabase.from('daily_tasks').update({
      status: 'submitted', submitted_at: new Date().toISOString(),
      logoff_time: clockOutTime || null, total_hours: totalHours,
    }).eq('id', dailyTaskId)
    if (error) { showToast('Failed to submit', 'error'); setSubmitting(false); return }
    const { data: ceos } = await supabase.from('users').select('id').eq('role', 'ceo').eq('active', true)
    if (ceos?.length) await supabase.from('notifications').insert(ceos.map((ceo) => ({ recipient_id: ceo.id, type: 'task_submitted', message: `${profile.name} submitted daily tasks (${totalHours}h)`, related_id: dailyTaskId })))
    setStatus('submitted'); showToast(`Day submitted · ${totalHours} hours logged`); setSubmitting(false); loadWeeklyHours(); loadAnalytics()
  }

  const handleRevert = async () => {
    setReverting(true)
    const { error } = await supabase.from('daily_tasks').update({ status: 'draft', submitted_at: null, total_hours: null }).eq('id', dailyTaskId)
    if (error) { showToast('Failed to revert', 'error'); setReverting(false); return }
    setStatus('draft'); showToast('Reverted to draft'); setReverting(false)
  }

  if (loading) return <Loader label="Loading today's sheet" />

  const todayHours = calculateHours(todaySlots)
  const filledCount = todaySlots.filter((s) => s.tasks_worked_on?.trim()).length

  // Analytics
  const aYear = analyticsMonth.getFullYear(); const aMonth = analyticsMonth.getMonth()
  const aMonthName = analyticsMonth.toLocaleString('default', { month: 'long' })
  const aDaysInMonth = new Date(aYear, aMonth + 1, 0).getDate()
  const countWorkingDays = () => { const td = new Date(); let c = 0; for (let d = 1; d <= aDaysInMonth; d++) { const dt = new Date(aYear, aMonth, d); if (dt > td) break; const dy = dt.getDay(); if (dy !== 0 && dy !== 6) c++ } return c }
  const workingDays = countWorkingDays()
  const daysSubmitted = monthTasks.length
  const attendanceRate = workingDays > 0 ? Math.round((daysSubmitted / workingDays) * 100) : 0
  const totalMonthHours = monthTasks.reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)
  const leavesTaken = monthLeaves.reduce((sum, l) => sum + (l.days_requested || 0), 0)
  const dailyHoursData = (() => { const data = []; const td = new Date(); for (let d = 1; d <= aDaysInMonth; d++) { const dt = new Date(aYear, aMonth, d); if (dt > td) break; if (dt.getDay() === 0 || dt.getDay() === 6) continue; const ds = `${aYear}-${String(aMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; const task = monthTasks.find(t => t.date === ds); data.push({ day: d, hours: task ? Math.round(parseFloat(task.total_hours || 0) * 10) / 10 : 0 }) } return data })()
  const weeklyHoursData = (() => { const weeks = []; let ws = 1; while (ws <= aDaysInMonth) { const we = Math.min(ws + 6, aDaysInMonth); const hrs = monthTasks.filter(t => { const dy = parseInt(t.date.split('-')[2]); return dy >= ws && dy <= we }).reduce((s, t) => s + parseFloat(t.total_hours || 0), 0); weeks.push({ week: `${ws}-${we}`, hours: Math.round(hrs * 10) / 10 }); ws += 7 } return weeks })()
  const attendanceDonut = [{ name: 'Present', value: daysSubmitted, color: '#C5F542' }, { name: 'Absent', value: Math.max(0, workingDays - daysSubmitted - leavesTaken), color: '#E5E5E5' }, { name: 'Leave', value: leavesTaken, color: '#F59E0B' }].filter(d => d.value > 0)

  const mobileTabField = mobileTab === 'tasks' ? 'tasks_worked_on' : mobileTab === 'agenda' ? 'days_agenda' : 'task_pending'
  const mobileTabPlaceholder = mobileTab === 'tasks' ? 'What did you work on?' : '—'

  return (
    <div>
      <PageHeader
        eyebrow={formatDateLong(today)}
        title="Today's Sheet"
        subtitle="Auto-saves every 5 seconds."
        action={
          <div className="flex items-center gap-2">
            {submitted && <Button variant="secondary" onClick={handleRevert} disabled={reverting}><Undo2 className="w-4 h-4" strokeWidth={2} />{reverting ? 'Reverting...' : 'Undo'}</Button>}
            {!submitted && <Button variant="primary" onClick={handleSubmit} disabled={submitting}><Send className="w-4 h-4" strokeWidth={2} />{submitting ? 'Submitting...' : 'Submit'}</Button>}
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="p-3 sm:p-4 bg-white border border-black/10 relative overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3.5 h-3.5 text-black/40" strokeWidth={1.8} />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-black/50">Clock In</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold">{clockInTime || '—'}</div>
          {clockedIn && !clockedOut && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#C5F542] animate-pulse" />}
        </div>
        <div className="p-3 sm:p-4 bg-white border border-black/10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3.5 h-3.5 text-black/40" strokeWidth={1.8} />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-black/50">Clock Out</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold">{clockOutTime || '—'}</div>
        </div>
        <div className="p-3 sm:p-4 bg-black text-white border border-black">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Timer className="w-3.5 h-3.5" style={{ color: '#C5F542' }} strokeWidth={1.8} />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-white/60">Work Hours</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold" style={{ color: '#C5F542' }}>{totalWorkHours > 0 ? `${totalWorkHours}h` : `${todayHours}h`}</div>
        </div>
        <div className="p-3 sm:p-4 bg-white border border-black/10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ListTodo className="w-3.5 h-3.5 text-black/40" strokeWidth={1.8} />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-black/50">Slots</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold">{filledCount}<span className="text-base text-black/30">/{todaySlots.length}</span></div>
        </div>
      </div>

      {/* Submitted Banner */}
      {submitted && (
        <div className="mb-6 bg-[#C5F542] p-3 sm:p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-black text-sm">Submitted · {totalWorkHours > 0 ? totalWorkHours : todayHours}h logged</div>
            <div className="text-xs text-black/70 truncate">In: {clockInTime || '—'} · Out: {clockOutTime || '—'}</div>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block border-2 border-black/20 overflow-hidden mb-6">
        <div className="h-1" style={{ background: '#C5F542' }} />
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-black text-white">
              <th className="text-left text-sm font-bold uppercase tracking-wider px-4 py-3 border-r border-white/10" style={{ width: '40%' }}>
                <div className="flex items-center justify-between">
                  <span>Tasks Worked On</span>
                  {!submitted && (
                    <button onClick={() => setShowSlotsModal(true)} className="text-[10px] uppercase tracking-wider bg-white/10 hover:bg-white/20 px-2 py-1 flex items-center gap-1 font-medium">
                      <Settings className="w-3 h-3" strokeWidth={2} />Slots
                    </button>
                  )}
                </div>
              </th>
              <th className="text-left text-sm font-bold uppercase tracking-wider px-4 py-3 border-r border-white/10" style={{ width: '30%' }}>Day's Agenda</th>
              <th className="text-left text-sm font-bold uppercase tracking-wider px-4 py-3" style={{ width: '30%' }}>Task Pending</th>
            </tr>
          </thead>
          <tbody>
            {todaySlots.map((slot) => (
              <tr key={slot.slot_index} className="border-t border-black/10 group">
                <td className="border-r border-black/10 align-top p-0">
                  <div className="px-3 py-1.5 bg-black/[0.06] border-b border-black/10 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-black/50">{slot.time_slot}</span>
                    {!submitted && todaySlots.length > 1 && (
                      <button onClick={() => handleRemoveSlot(userSlots.find((s) => s.slot_index === slot.slot_index))} className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-black">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <textarea disabled={submitted} value={slot.tasks_worked_on} onChange={(e) => updateSlot(slot.slot_index, 'tasks_worked_on', e.target.value)} className="w-full px-3 py-2 text-sm bg-white focus:outline-none disabled:text-black resize-none min-h-[70px]" placeholder="What did you work on?" />
                </td>
                <td className="border-r border-black/10 align-top p-0">
                  <textarea disabled={submitted} value={slot.days_agenda} onChange={(e) => updateSlot(slot.slot_index, 'days_agenda', e.target.value)} className="w-full px-3 py-2 text-sm bg-white focus:outline-none disabled:text-black resize-none min-h-[96px]" placeholder="—" />
                </td>
                <td className="align-top p-0">
                  <textarea disabled={submitted} value={slot.task_pending} onChange={(e) => updateSlot(slot.slot_index, 'task_pending', e.target.value)} className="w-full px-3 py-2 text-sm bg-white focus:outline-none disabled:text-black resize-none min-h-[96px]" placeholder="—" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden mb-6">
        <div className="flex bg-black text-white">
          {[{ key: 'tasks', label: 'Tasks' }, { key: 'agenda', label: 'Agenda' }, { key: 'pending', label: 'Pending' }].map(tab => (
            <button key={tab.key} onClick={() => setMobileTab(tab.key)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center transition-colors ${mobileTab === tab.key ? 'bg-white/10 text-[#C5F542]' : 'text-white/60'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {mobileTab === 'tasks' && !submitted && (
          <div className="flex justify-end p-2 bg-black/5 border-x-2 border-black/20">
            <button onClick={() => setShowSlotsModal(true)} className="text-[10px] uppercase tracking-wider bg-black/10 px-2 py-1 flex items-center gap-1"><Settings className="w-3 h-3" strokeWidth={2} />Slots</button>
          </div>
        )}
        <div className="border-2 border-t-0 border-black/20 divide-y divide-black/10">
          {todaySlots.map((slot) => (
            <div key={slot.slot_index} className="group">
              <div className="flex items-center justify-between px-3 py-2 bg-black/[0.06] border-b border-black/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">{slot.time_slot}</span>
                {mobileTab === 'tasks' && !submitted && todaySlots.length > 1 && <button onClick={() => handleRemoveSlot(userSlots.find((s) => s.slot_index === slot.slot_index))} className="text-black/30"><Trash2 className="w-3 h-3" /></button>}
              </div>
              <textarea disabled={submitted} value={slot[mobileTabField]} onChange={(e) => updateSlot(slot.slot_index, mobileTabField, e.target.value)} className="w-full px-3 py-3 text-sm bg-white focus:outline-none disabled:text-black resize-none" rows={3} placeholder={mobileTabPlaceholder} />
            </div>
          ))}
        </div>
      </div>

      {/* Team Today */}
      {teamToday.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm uppercase tracking-widest font-semibold text-black/50 mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" strokeWidth={1.8} />Team's Today
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {teamToday.map((u) => {
              const avatar = getAvatar(u.avatar_id)
              const isSubmitted = u.task_status === 'submitted'
              const isDraft = u.task_status === 'draft'
              return (
                <button key={u.id} onClick={() => openSpectate(u)}
                  className={`bg-white border p-4 text-left hover:border-black/30 transition-colors ${isSubmitted ? 'border-l-4 border-l-[#C5F542] border-t border-r border-b border-t-black/10 border-r-black/10 border-b-black/10' : 'border-black/10'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: avatar.bg }}>{avatar.emoji}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{u.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-black/50">{u.designation}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 ${isSubmitted ? 'bg-[#C5F542] text-black' : isDraft ? 'bg-yellow-100 text-yellow-700' : 'bg-black/5 text-black/40'}`}>
                    {isSubmitted ? 'Submitted' : isDraft ? 'In Progress' : 'Not Started'}
                  </span>
                  {u.clock_in_time && <div className="text-[10px] text-black/40 mt-1">In: {u.clock_in_time}{u.clock_out_time ? ` · Out: ${u.clock_out_time}` : ''}</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Collapsible Analytics */}
      <div className="border-t-2 border-black/10 pt-6 mt-4">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="flex items-center justify-between w-full mb-4 group"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-black/40" strokeWidth={1.8} />
            <span className="text-xs uppercase tracking-widest font-semibold text-black/50">My Analytics</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-black/30 transition-transform ${showAnalytics ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>

        {showAnalytics && (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h3 className="text-xl font-bold">{aMonthName} {aYear}</h3>
              <div className="flex gap-1">
                <button onClick={() => setAnalyticsMonth(new Date(aYear, aMonth - 1))} className="p-2 border border-black/10 hover:bg-black/5"><ChevronRight className="w-4 h-4 rotate-180" strokeWidth={2} /></button>
                <button onClick={() => setAnalyticsMonth(new Date())} className="px-3 py-1 border border-black/10 hover:bg-black/5 text-xs uppercase tracking-widest">Now</button>
                <button onClick={() => setAnalyticsMonth(new Date(aYear, aMonth + 1))} className="p-2 border border-black/10 hover:bg-black/5"><ChevronRight className="w-4 h-4" strokeWidth={2} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-black text-white p-4">
                <div className="text-[10px] uppercase tracking-widest text-white/50 font-semibold mb-1">Total Hours</div>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#C5F542' }}>{Math.round(totalMonthHours * 10) / 10}h</div>
              </div>
              <div className="bg-white border border-black/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1">Attendance</div>
                <div className="text-2xl sm:text-3xl font-bold">{attendanceRate}%</div>
                <div className="text-[10px] text-black/40">{daysSubmitted}/{workingDays} days</div>
              </div>
              <div className="bg-white border border-black/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1">Leaves</div>
                <div className="text-2xl sm:text-3xl font-bold">{leavesTaken}</div>
                <div className="text-[10px] text-black/40">Bal: {profile?.leave_balance || 0}</div>
              </div>
              <div className="bg-white border border-black/10 p-4">
                <div className="text-[10px] uppercase tracking-widest text-black/50 font-semibold mb-1">Avg/Day</div>
                <div className="text-2xl sm:text-3xl font-bold">{daysSubmitted > 0 ? Math.round((totalMonthHours / daysSubmitted) * 10) / 10 : 0}h</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-black/10 p-4 sm:p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Daily Hours</h4>
                {dailyHoursData.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-black/30">No data yet — start submitting tasks!</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyHoursData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 11 }} formatter={(v) => [`${v}h`, 'Hours']} />
                      <Bar dataKey="hours" fill="#C5F542" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="bg-white border border-black/10 p-4 sm:p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Weekly Hours</h4>
                {weeklyHoursData.every(w => w.hours === 0) ? (
                  <div className="flex items-center justify-center h-[200px] text-sm text-black/30">No hours logged yet this month</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyHoursData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 11 }} formatter={(v) => [`${v}h`, 'Hours']} />
                      <Bar dataKey="hours" fill="#000" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white border border-black/10 p-4 sm:p-5">
              <h4 className="text-xs uppercase tracking-widest font-semibold text-black/50 mb-4">Attendance</h4>
              {attendanceDonut.length === 0 ? (
                <div className="flex items-center justify-center h-[160px] text-sm text-black/30">No attendance data yet</div>
              ) : (
                <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={attendanceDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                        {attendanceDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ border: '1px solid #eee', fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {attendanceDonut.map((d, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-sm">{d.name}: <strong>{d.value}d</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Spectate Modal */}
      {spectateUser && (
        <Modal title={`${spectateUser.name}'s Sheet (Live)`} onClose={closeSpectate} wide>
          {spectateLoading ? <Loader /> : spectateSlots.length === 0 ? (
            <div className="text-center text-black/50 py-8 text-sm">No tasks yet</div>
          ) : (
            <div>
              {spectateTask && (
                <div className="flex items-center gap-3 mb-3 text-xs text-black/50 flex-wrap">
                  {spectateTask.clock_in_time && <span>In: <strong className="text-black">{spectateTask.clock_in_time}</strong></span>}
                  {spectateTask.clock_out_time && <span>Out: <strong className="text-black">{spectateTask.clock_out_time}</strong></span>}
                  {spectateTask.total_hours && <span>{spectateTask.total_hours}h</span>}
                  <span className={`uppercase tracking-widest font-semibold px-2 py-0.5 ${spectateTask.status === 'submitted' ? 'bg-[#C5F542] text-black' : 'bg-yellow-100 text-yellow-700'}`}>{spectateTask.status}</span>
                  <span className="text-[10px] text-black/30 animate-pulse">● Live</span>
                </div>
              )}
              <DailyTaskGrid slots={spectateSlots} date={today} />
            </div>
          )}
        </Modal>
      )}

      {showSlotsModal && <SlotsManagerModal slots={userSlots} onAddSlot={handleAddSlot} onRemoveSlot={handleRemoveSlot} onClose={() => setShowSlotsModal(false)} />}
    </div>
  )
}