import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Send, Settings, Trash2, CheckCircle2, Clock, Timer, TrendingUp, ListTodo, Undo2, Eye, ChevronRight, ChevronDown, BarChart3, Coffee,
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

// Default slots structure starting from 10 AM
const DEFAULT_SLOTS = [
  { slot_index: 0, time_slot: '10:00 AM – 11:00 AM', is_lunch: false },
  { slot_index: 1, time_slot: '11:00 AM – 12:00 PM', is_lunch: false },
  { slot_index: 2, time_slot: '12:00 PM – 01:00 PM', is_lunch: false },
  { slot_index: 3, time_slot: '01:00 PM – 02:00 PM', is_lunch: false },
  { slot_index: 4, time_slot: '02:00 PM – 03:00 PM', is_lunch: false },
  { slot_index: 5, time_slot: '03:00 PM – 04:00 PM', is_lunch: false },
  { slot_index: 6, time_slot: '04:00 PM – 05:00 PM', is_lunch: false },
  { slot_index: 7, time_slot: '05:00 PM – 06:00 PM', is_lunch: false },
]

function calcWorkHours(inTime, outTime) {
  if (!inTime || !outTime) return 0
  const parse = (t) => {
    const match = t.match(/(\d+):(\d+)\s*(am|pm)/i)
    if (!match) return 0
    let h = parseInt(match[1])
    const m = parseInt(match[2])
    const p = match[3].toLowerCase()
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
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date())
  const [monthTasks, setMonthTasks] = useState([])
  const [monthLeaves, setMonthLeaves] = useState([])
  const [undoStack, setUndoStack] = useState([])

  const autoSaveInterval = useRef(null)
  const spectateTimer = useRef(null)

  const today = todayISO()
  const submitted = status === 'submitted'
  const totalWorkHours = calcWorkHours(clockInTime, clockOutTime)
  const isCEO = profile?.role === 'ceo'

  const pushUndo = useCallback((slots) => {
    setUndoStack((prev) => [...prev.slice(-19), JSON.parse(JSON.stringify(slots))])
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !submitted) {
        e.preventDefault()
        setUndoStack((prev) => {
          if (prev.length === 0) return prev
          const last = prev[prev.length - 1]
          setTodaySlots(last)
          showToast('Undone ↩')
          return prev.slice(0, -1)
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [submitted, showToast])

  useEffect(() => {
    if (profile?.id && (clockedIn || isCEO)) {
      loadData()
      loadTeamToday()
      loadAnalytics()
    }
  }, [profile?.id, clockedIn])

  useEffect(() => {
    if (profile?.id && (clockedIn || isCEO)) loadAnalytics()
  }, [analyticsMonth])

  useEffect(() => {
    if (!profile?.id || submitted) return
    if (!clockedIn && !isCEO) return
    autoSaveInterval.current = setInterval(() => {
      if (todaySlots.length > 0 && dailyTaskId) autosave(todaySlots)
    }, 5000)
    return () => clearInterval(autoSaveInterval.current)
  }, [profile?.id, submitted, todaySlots, dailyTaskId, clockedIn])

  useEffect(() => {
    return () => {
      if (spectateTimer.current) clearInterval(spectateTimer.current)
    }
  }, [])

  // ─── DAILY RESET: resets both content AND slot timings to default ───
  const checkAndResetSlots = async (slotsData) => {
    const lastDate = localStorage.getItem(`axis_slots_date_${profile.id}`)
    if (lastDate && lastDate !== today) {
      // Reset slot timings to default AND clear content
      const defaultTimings = DEFAULT_SLOTS
      // Update DB slots back to default timings
      for (let i = 0; i < slotsData.length; i++) {
        const defaultSlot = defaultTimings[i] || defaultTimings[defaultTimings.length - 1]
        if (slotsData[i]?.id) {
          await supabase.from('user_slots').update({
            time_slot: defaultTimings[i]?.time_slot || slotsData[i].time_slot,
            is_lunch: false,
          }).eq('id', slotsData[i].id)
        }
      }
      // Return reset slots with default timings and empty content
      const resetSlots = slotsData.map((us, i) => ({
        ...us,
        slot_index: i,
        time_slot: defaultTimings[i]?.time_slot || us.time_slot,
        is_lunch: false,
        tasks_worked_on: '',
        days_agenda: '',
        task_pending: '',
      }))
      localStorage.setItem(`axis_slots_date_${profile.id}`, today)
      return resetSlots
    }
    localStorage.setItem(`axis_slots_date_${profile.id}`, today)
    return null
  }

  const loadData = async () => {
    setLoading(true)
    const [slotsRes, taskRes] = await Promise.all([
      supabase.from('user_slots').select('*').eq('user_id', profile.id).order('slot_index', { ascending: true }),
      supabase.from('daily_tasks').select('*, task_slots(*)').eq('user_id', profile.id).eq('date', today).maybeSingle(),
    ])
    let slotsData = slotsRes.data || []
    const taskData = taskRes.data

    if (taskData) {
      setDailyTaskId(taskData.id)
      setStatus(taskData.status)
    }

    if (!taskData && isCEO) {
      const { data: newTask } = await supabase.from('daily_tasks').insert({
        user_id: profile.id, date: today, status: 'draft',
        clock_in_time: clockInTime || null, clocked_in: clockedIn || false,
      }).select().single()
      if (newTask) setDailyTaskId(newTask.id)
    }

    if (slotsData.length === 0) {
      const newSlots = DEFAULT_SLOTS.map((s) => ({ ...s, user_id: profile.id }))
      const { data: createdSlots } = await supabase.from('user_slots').insert(newSlots).select()
      if (createdSlots) {
        slotsData = createdSlots
        setUserSlots(createdSlots)
        setTodaySlots(createdSlots.map((s) => ({
          ...s, tasks_worked_on: '', days_agenda: '', task_pending: '',
        })))
        localStorage.setItem(`axis_slots_date_${profile.id}`, today)
        await loadWeeklyHours()
        setLoading(false)
        return
      }
    }

    setUserSlots(slotsData)

    // Check daily reset
    const resetSlots = await checkAndResetSlots(slotsData)
    if (resetSlots) {
      setUserSlots(resetSlots)
      setTodaySlots(resetSlots)
      showToast('Slots reset for today 🌅')
    } else {
      setTodaySlots(slotsData.map((us) => {
        const found = taskData?.task_slots?.find((ts) => ts.slot_index === us.slot_index)
        return {
          ...us,
          is_lunch: us.is_lunch || false,
          tasks_worked_on: found?.tasks_worked_on || '',
          days_agenda: found?.days_agenda || '',
          task_pending: found?.task_pending || '',
        }
      }))
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
    const { data: users } = await supabase.from('users').select('id, name, avatar_id, designation').eq('active', true).eq('role', 'employee').neq('id', profile.id)
    if (!users?.length) return
    const { data: tasks } = await supabase.from('daily_tasks').select('user_id, status, clock_in_time, clock_out_time').eq('date', today).in('user_id', users.map((u) => u.id))
    setTeamToday(users.map((u) => {
      const task = tasks?.find((t) => t.user_id === u.id)
      return { ...u, task_status: task?.status || 'not started', clock_in_time: task?.clock_in_time, clock_out_time: task?.clock_out_time }
    }))
  }

  const refreshSpectate = async (userId) => {
    const { data } = await supabase.from('daily_tasks').select('*, task_slots(*)').eq('user_id', userId).eq('date', today).maybeSingle()
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
    const { data } = await supabase.from('daily_tasks').select('total_hours').eq('user_id', profile.id).eq('status', 'submitted').gte('date', monday.toISOString().split('T')[0])
    setWeeklyHours(((data || []).reduce((sum, t) => sum + parseFloat(t.total_hours || 0), 0)).toFixed(1))
  }

  const autosave = useCallback(async (newSlots) => {
    if (!profile?.id || status === 'submitted') return
    const taskId = dailyTaskId
    if (!taskId) return
    await supabase.from('task_slots').delete().eq('daily_task_id', taskId)
    await supabase.from('task_slots').insert(newSlots.map((s) => ({
      daily_task_id: taskId, slot_index: s.slot_index, time_slot: s.time_slot,
      tasks_worked_on: s.tasks_worked_on, days_agenda: s.days_agenda, task_pending: s.task_pending,
    })))
  }, [profile?.id, dailyTaskId, status])

  const updateSlot = (slotIndex, field, value) => {
    pushUndo(todaySlots)
    setTodaySlots(todaySlots.map((s) => s.slot_index === slotIndex ? { ...s, [field]: value } : s))
  }

  const handleAddSlot = async (timeStr) => {
    const newIndex = userSlots.length > 0 ? Math.max(...userSlots.map((s) => s.slot_index)) + 1 : 0
    const { data, error } = await supabase.from('user_slots').insert({ user_id: profile.id, slot_index: newIndex, time_slot: timeStr, is_lunch: false }).select().single()
    if (error) { showToast('Failed to add slot', 'error'); return }
    setUserSlots([...userSlots, data])
    setTodaySlots([...todaySlots, { ...data, tasks_worked_on: '', days_agenda: '', task_pending: '' }])
    showToast('Slot added')
  }

  const handleRemoveSlot = async (slot) => {
    if (!slot.id) return
    pushUndo(todaySlots)
    await supabase.from('user_slots').delete().eq('id', slot.id)
    setUserSlots(userSlots.filter((s) => s.id !== slot.id))
    setTodaySlots(todaySlots.filter((s) => s.slot_index !== slot.slot_index))
    if (dailyTaskId) await supabase.from('task_slots').delete().eq('daily_task_id', dailyTaskId).eq('slot_index', slot.slot_index)
  }

  const handleReorderSlots = async (reordered) => {
    pushUndo(todaySlots)
    const updated = reordered.map((s, idx) => ({ ...s, slot_index: idx }))
    setUserSlots(updated)
    setTodaySlots((prev) => {
      const contentMap = {}
      prev.forEach((s) => { contentMap[s.slot_index] = s })
      return updated.map((s, idx) => {
        const old = reordered[idx]
        const content = contentMap[old.slot_index] || {}
        return { ...s, slot_index: idx, tasks_worked_on: content.tasks_worked_on || '', days_agenda: content.days_agenda || '', task_pending: content.task_pending || '' }
      })
    })
    for (const s of updated) {
      if (s.id) await supabase.from('user_slots').update({ slot_index: s.slot_index }).eq('id', s.id)
    }
    showToast('Slots reordered')
  }

  const handleToggleLunch = async (slot) => {
    if (!slot.id) return
    const newVal = !slot.is_lunch
    await supabase.from('user_slots').update({ is_lunch: newVal }).eq('id', slot.id)
    setUserSlots(userSlots.map((s) => s.id === slot.id ? { ...s, is_lunch: newVal } : s))
    setTodaySlots(todaySlots.map((s) => s.slot_index === slot.slot_index ? { ...s, is_lunch: newVal } : s))
    showToast(newVal ? '☕ Marked as lunch break' : 'Lunch break removed')
  }

  const handleEditSlotTime = async (slot, newTimeStr) => {
    if (!slot.id) return
    pushUndo(todaySlots)
    await supabase.from('user_slots').update({ time_slot: newTimeStr }).eq('id', slot.id)
    setUserSlots(userSlots.map((s) => s.id === slot.id ? { ...s, time_slot: newTimeStr } : s))
    setTodaySlots(todaySlots.map((s) => s.slot_index === slot.slot_index ? { ...s, time_slot: newTimeStr } : s))
    showToast('Time updated')
  }

  const handleSubmit = async () => {
    if (!todaySlots.some((s) => s.tasks_worked_on?.trim())) { showToast('Please fill at least one time slot', 'error'); return }
    setSubmitting(true)
    await autosave(todaySlots)
    // Use raw clock time (clock out - clock in) as total hours
    const totalHours = totalWorkHours || calculateHours(todaySlots)
    const { error } = await supabase.from('daily_tasks').update({
      status: 'submitted', submitted_at: new Date().toISOString(),
      logoff_time: clockOutTime || null, total_hours: totalHours,
    }).eq('id', dailyTaskId)
    if (error) { showToast('Failed to submit', 'error'); setSubmitting(false); return }
    if (!isCEO) {
      const { data: ceos } = await supabase.from('users').select('id').eq('role', 'ceo').eq('active', true)
      if (ceos?.length) {
        await supabase.from('notifications').insert(ceos.map((c) => ({
          recipient_id: c.id, type: 'task_submitted',
          message: `${profile.name} submitted daily tasks (${totalHours}h)`, related_id: dailyTaskId,
        })))
      }
    }
    setStatus('submitted')
    showToast(`Day submitted · ${totalHours} hours logged`)
    setSubmitting(false)
    loadWeeklyHours()
    loadAnalytics()
  }

  const handleRevert = async () => {
    setReverting(true)
    const { error } = await supabase.from('daily_tasks').update({ status: 'draft', submitted_at: null, total_hours: null }).eq('id', dailyTaskId)
    if (error) { showToast('Failed to revert', 'error'); setReverting(false); return }
    setStatus('draft')
    showToast('Reverted to draft')
    setReverting(false)
  }

  if (loading) return <Loader label="Loading today's sheet" />

  const todayHours = calculateHours(todaySlots)
  const filledCount = todaySlots.filter((s) => s.tasks_worked_on?.trim()).length

  const aYear = analyticsMonth.getFullYear()
  const aMonth = analyticsMonth.getMonth()
  const aMonthName = analyticsMonth.toLocaleString('default', { month: 'long' })
  const aDaysInMonth = new Date(aYear, aMonth + 1, 0).getDate()
  const countWD = () => {
    const td = new Date(); let c = 0
    for (let d = 1; d <= aDaysInMonth; d++) {
      const dt = new Date(aYear, aMonth, d); if (dt > td) break
      const dy = dt.getDay(); if (dy !== 0 && dy !== 6) c++
    }
    return c
  }
  const workingDays = countWD()
  const daysSubmitted = monthTasks.length
  const attendanceRate = workingDays > 0 ? Math.round((daysSubmitted / workingDays) * 100) : 0
  const totalMonthHours = monthTasks.reduce((s, t) => s + parseFloat(t.total_hours || 0), 0)
  const leavesTaken = monthLeaves.reduce((s, l) => s + (l.days_requested || 0), 0)
  const dailyHoursData = (() => {
    const data = []; const td = new Date()
    for (let d = 1; d <= aDaysInMonth; d++) {
      const dt = new Date(aYear, aMonth, d); if (dt > td) break; if (dt.getDay() === 0 || dt.getDay() === 6) continue
      const ds = `${aYear}-${String(aMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const task = monthTasks.find((t) => t.date === ds)
      data.push({ day: d, hours: task ? Math.round(parseFloat(task.total_hours || 0) * 10) / 10 : 0 })
    }
    return data
  })()
  const weeklyHoursData = (() => {
    const weeks = []; let ws = 1
    while (ws <= aDaysInMonth) {
      const we = Math.min(ws + 6, aDaysInMonth)
      const hrs = monthTasks.filter((t) => { const dy = parseInt(t.date.split('-')[2]); return dy >= ws && dy <= we }).reduce((s, t) => s + parseFloat(t.total_hours || 0), 0)
      weeks.push({ week: `${ws}-${we}`, hours: Math.round(hrs * 10) / 10 }); ws += 7
    }
    return weeks
  })()
  const attendanceDonut = [
    { name: 'Present', value: daysSubmitted, color: '#C5F542' },
    { name: 'Absent', value: Math.max(0, workingDays - daysSubmitted - leavesTaken), color: '#E5E5E5' },
    { name: 'Leave', value: leavesTaken, color: '#F59E0B' },
  ].filter((d) => d.value > 0)

  const mobileTabField = mobileTab === 'tasks' ? 'tasks_worked_on' : mobileTab === 'agenda' ? 'days_agenda' : 'task_pending'
  const mobileTabPlaceholder = mobileTab === 'tasks' ? 'What did you work on?' : '—'

  return (
    <div>
      <PageHeader eyebrow={formatDateLong(today)} title="Today's Sheet" subtitle="Auto-saves every 5 seconds · Ctrl+Z to undo"
        action={
          <div className="flex items-center gap-2">
            {undoStack.length > 0 && !submitted && (
              <Button variant="secondary" onClick={() => {
                setUndoStack((prev) => {
                  if (prev.length === 0) return prev
                  const last = prev[prev.length - 1]
                  setTodaySlots(last)
                  showToast('Undone ↩')
                  return prev.slice(0, -1)
                })
              }}><Undo2 className="w-4 h-4" strokeWidth={2} />Undo</Button>
            )}
            {submitted && <Button variant="secondary" onClick={handleRevert} disabled={reverting}><Undo2 className="w-4 h-4" strokeWidth={2} />{reverting ? 'Reverting...' : 'Revert'}</Button>}
            {!submitted && <Button variant="primary" onClick={handleSubmit} disabled={submitting}><Send className="w-4 h-4" strokeWidth={2} />{submitting ? 'Submitting...' : 'Submit'}</Button>}
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'linear-gradient(135deg, #111 0%, #1a1a2e 100%)' }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-white/40" strokeWidth={2} />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-white/40">Clock in</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">{clockInTime || '—'}</div>
            <div className="mt-2 h-[2px] rounded-full" style={{ background: 'rgba(197,245,66,0.2)' }}>
              <div className="h-full rounded-full" style={{ width: clockInTime ? '100%' : '0%', background: '#C5F542' }} />
            </div>
            {clockedIn && !clockedOut && <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#C5F542', boxShadow: '0 0 8px rgba(197,245,66,0.5)' }} />}
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-white/40" strokeWidth={2} />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-white/40">Clock out</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">{clockOutTime || '—'}</div>
            <div className="mt-2 h-[2px] rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ width: clockOutTime ? '100%' : '0%', background: '#ef4444' }} />
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'rgba(197,245,66,0.1)', border: '1px solid rgba(197,245,66,0.15)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Timer className="w-3.5 h-3.5" style={{ color: 'rgba(197,245,66,0.6)' }} strokeWidth={2} />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(197,245,66,0.6)' }}>Work hours</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: '#C5F542' }}>{totalWorkHours > 0 ? `${totalWorkHours}h` : `${todayHours}h`}</div>
            <div className="mt-2 h-[2px] rounded-full" style={{ background: 'rgba(197,245,66,0.2)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((totalWorkHours || todayHours) / 9) * 100)}%`, background: '#C5F542' }} />
            </div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <ListTodo className="w-3.5 h-3.5 text-white/40" strokeWidth={2} />
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-white/40">Slots</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">{filledCount}<span className="text-base text-white/20 font-normal">/{todaySlots.length}</span></div>
            <div className="mt-2 h-[2px] rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: todaySlots.length > 0 ? `${(filledCount / todaySlots.length) * 100}%` : '0%', background: filledCount === todaySlots.length ? '#C5F542' : '#fff' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Submitted Banner */}
      {submitted && (
        <div className="mb-6 bg-[#C5F542] p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-black" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-black text-sm">Submitted · {totalWorkHours > 0 ? totalWorkHours : todayHours}h logged</div>
            <div className="text-xs text-black/60 truncate">In: {clockInTime || '—'} · Out: {clockOutTime || '—'}</div>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl overflow-hidden shadow-sm border border-black/[0.06] mb-6">
        <div className="h-[3px] rounded-t-xl" style={{ background: 'linear-gradient(90deg, #C5F542 0%, #8BC34A 50%, #4CAF50 100%)' }} />
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111 100%)' }}>
              <th className="text-left text-sm font-bold uppercase tracking-wider px-4 py-3.5 border-r border-white/[0.06]" style={{ width: '40%', color: '#C5F542' }}>
                <div className="flex items-center justify-between">
                  <span>Tasks worked on</span>
                  {!submitted && (
                    <button onClick={() => setShowSlotsModal(true)} className="text-[10px] uppercase tracking-wider bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md flex items-center gap-1 font-medium transition-colors text-white/60">
                      <Settings className="w-3 h-3" strokeWidth={2} />Slots
                    </button>
                  )}
                </div>
              </th>
              <th className="text-left text-sm font-bold uppercase tracking-wider px-4 py-3.5 border-r border-white/[0.06] text-white/60" style={{ width: '30%' }}>Day's agenda</th>
              <th className="text-left text-sm font-bold uppercase tracking-wider px-4 py-3.5 text-white/60" style={{ width: '30%' }}>Task pending</th>
            </tr>
          </thead>
          <tbody>
            {todaySlots.map((slot, idx) => (
              <tr key={slot.slot_index} className={`group ${slot.is_lunch ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                <td className="border-r border-black/[0.06] align-top p-0">
                  <div className="px-3 py-1.5 bg-black/[0.04] border-b border-black/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-black/40">{slot.time_slot}</span>
                      {slot.is_lunch && (
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                          <Coffee className="w-2.5 h-2.5" /> Lunch
                        </span>
                      )}
                    </div>
                    {!submitted && todaySlots.length > 1 && (
                      <button onClick={() => handleRemoveSlot(userSlots.find((s) => s.slot_index === slot.slot_index))} className="opacity-0 group-hover:opacity-100 text-black/20 hover:text-red-500 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    {slot.tasks_worked_on?.trim() && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#C5F542]" />}
                    {slot.is_lunch ? (
                      <div className="px-3 py-4 text-sm text-amber-400 italic flex items-center gap-2">
                        <Coffee className="w-4 h-4" /> Lunch Break
                      </div>
                    ) : (
                      <textarea disabled={submitted} value={slot.tasks_worked_on} onChange={(e) => updateSlot(slot.slot_index, 'tasks_worked_on', e.target.value)} className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none focus:bg-white disabled:text-black resize-none transition-colors min-h-[70px]" placeholder="What did you work on?" />
                    )}
                  </div>
                </td>
                <td className="border-r border-black/[0.06] align-top p-0">
                  {slot.is_lunch ? <div className="min-h-[96px]" /> : (
                    <textarea disabled={submitted} value={slot.days_agenda} onChange={(e) => updateSlot(slot.slot_index, 'days_agenda', e.target.value)} className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none focus:bg-white disabled:text-black resize-none transition-colors min-h-[96px]" placeholder="—" />
                  )}
                </td>
                <td className="align-top p-0">
                  {slot.is_lunch ? <div className="min-h-[96px]" /> : (
                    <textarea disabled={submitted} value={slot.task_pending} onChange={(e) => updateSlot(slot.slot_index, 'task_pending', e.target.value)} className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none focus:bg-white disabled:text-black resize-none transition-colors min-h-[96px]" placeholder="—" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden mb-6">
        <div className="flex bg-black rounded-t-xl overflow-hidden">
          {[{ key: 'tasks', label: 'Tasks' }, { key: 'agenda', label: 'Agenda' }, { key: 'pending', label: 'Pending' }].map((tab) => (
            <button key={tab.key} onClick={() => setMobileTab(tab.key)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider text-center transition-colors ${mobileTab === tab.key ? 'bg-white/10 text-[#C5F542]' : 'text-white/40'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {mobileTab === 'tasks' && !submitted && (
          <div className="flex justify-end p-2 bg-black/[0.03] border-x border-black/[0.06]">
            <button onClick={() => setShowSlotsModal(true)} className="text-[10px] uppercase tracking-wider bg-black/10 px-2 py-1 rounded flex items-center gap-1">
              <Settings className="w-3 h-3" strokeWidth={2} />Slots
            </button>
          </div>
        )}
        <div className="border border-t-0 border-black/[0.06] rounded-b-xl overflow-hidden divide-y divide-black/[0.06]">
          {todaySlots.map((slot) => (
            <div key={slot.slot_index} className={slot.is_lunch ? 'bg-amber-50' : ''}>
              <div className="flex items-center justify-between px-3 py-2 bg-black/[0.03] border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">{slot.time_slot}</span>
                  {slot.is_lunch && <Coffee className="w-3 h-3 text-amber-500" />}
                </div>
                {mobileTab === 'tasks' && !submitted && todaySlots.length > 1 && (
                  <button onClick={() => handleRemoveSlot(userSlots.find((s) => s.slot_index === slot.slot_index))} className="text-black/30">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {slot.is_lunch ? (
                <div className="px-3 py-4 text-sm text-amber-400 italic flex items-center gap-2">
                  <Coffee className="w-4 h-4" /> Lunch Break
                </div>
              ) : (
                <textarea disabled={submitted} value={slot[mobileTabField]} onChange={(e) => updateSlot(slot.slot_index, mobileTabField, e.target.value)} className="w-full px-3 py-3 text-sm bg-white focus:outline-none disabled:text-black resize-none" rows={3} placeholder={mobileTabPlaceholder} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Team Today */}
      {teamToday.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm uppercase tracking-widest font-semibold text-black/40 mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" strokeWidth={1.8} />Team's today
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {teamToday.map((u) => {
              const avatar = getAvatar(u.avatar_id)
              const isSub = u.task_status === 'submitted'
              const isDraft = u.task_status === 'draft'
              const isClocked = !!u.clock_in_time
              return (
                <button key={u.id} onClick={() => openSpectate(u)}
                  className={`bg-white rounded-xl p-4 text-left hover:shadow-md transition-all border ${isSub ? 'border-[#C5F542]/30 shadow-sm' : 'border-black/[0.06] shadow-sm'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="w-9 h-9 flex items-center justify-center text-sm rounded-lg flex-shrink-0" style={{ background: avatar.bg }}>{avatar.emoji}</div>
                      {isClocked && !u.clock_out_time && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#C5F542] border-2 border-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{u.name}</div>
                      <div className="text-[10px] text-black/40">{u.designation}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded ${isSub ? 'bg-[#C5F542]/20 text-[#5a7a00]' : isDraft ? 'bg-yellow-50 text-yellow-700' : 'bg-black/[0.03] text-black/30'}`}>
                    {isSub ? 'Submitted' : isDraft ? 'In Progress' : 'Not Started'}
                  </span>
                  {u.clock_in_time && <div className="text-[10px] text-black/30 mt-2">In: {u.clock_in_time}{u.clock_out_time ? ` · Out: ${u.clock_out_time}` : ''}</div>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Collapsible Analytics */}
      <div className="border-t border-black/[0.06] pt-6 mt-4">
        <button onClick={() => setShowAnalytics(!showAnalytics)} className="flex items-center justify-between w-full mb-4 group">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-black/5 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-black/40" strokeWidth={1.8} />
            </div>
            <span className="text-xs uppercase tracking-widest font-semibold text-black/40">My analytics</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-black/20 transition-transform ${showAnalytics ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>

        {showAnalytics && (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h3 className="text-xl font-bold">{aMonthName} {aYear}</h3>
              <div className="flex gap-1">
                <button onClick={() => setAnalyticsMonth(new Date(aYear, aMonth - 1))} className="p-2 rounded-lg border border-black/[0.06] hover:bg-black/5 transition-colors"><ChevronRight className="w-4 h-4 rotate-180" strokeWidth={2} /></button>
                <button onClick={() => setAnalyticsMonth(new Date())} className="px-3 py-1 rounded-lg border border-black/[0.06] hover:bg-black/5 text-xs uppercase tracking-widest transition-colors">Now</button>
                <button onClick={() => setAnalyticsMonth(new Date(aYear, aMonth + 1))} className="p-2 rounded-lg border border-black/[0.06] hover:bg-black/5 transition-colors"><ChevronRight className="w-4 h-4" strokeWidth={2} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-black rounded-xl p-4 relative overflow-hidden shadow-lg">
                <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at top right, #C5F542 0%, transparent 60%)' }} />
                <div className="relative">
                  <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">Total hours</div>
                  <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#C5F542' }}>{Math.round(totalMonthHours * 10) / 10}h</div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-4">
                <div className="text-[10px] uppercase tracking-widest text-black/40 font-semibold mb-1">Attendance</div>
                <div className="text-2xl sm:text-3xl font-bold">{attendanceRate}%</div>
                <div className="text-[10px] text-black/30">{daysSubmitted}/{workingDays} days</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-4">
                <div className="text-[10px] uppercase tracking-widest text-black/40 font-semibold mb-1">Leaves</div>
                <div className="text-2xl sm:text-3xl font-bold">{leavesTaken}</div>
                <div className="text-[10px] text-black/30">Bal: {profile?.leave_balance || 0}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-4">
                <div className="text-[10px] uppercase tracking-widest text-black/40 font-semibold mb-1">Avg/day</div>
                <div className="text-2xl sm:text-3xl font-bold">{daysSubmitted > 0 ? Math.round((totalMonthHours / daysSubmitted) * 10) / 10 : 0}h</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/40 mb-4">Daily hours</h4>
                {dailyHoursData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-black/20">
                    <BarChart3 className="w-8 h-8 mb-2" strokeWidth={1} />
                    <span className="text-sm">Start submitting to see data</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyHoursData}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C5F542" />
                          <stop offset="100%" stopColor="#a8d935" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#999' }} axisLine={{ stroke: '#eee' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#999' }} axisLine={{ stroke: '#eee' }} />
                      <Tooltip contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} formatter={(v) => [`${v}h`, 'Hours']} />
                      <Bar dataKey="hours" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-5">
                <h4 className="text-xs uppercase tracking-widest font-semibold text-black/40 mb-4">Weekly hours</h4>
                {weeklyHoursData.every((w) => w.hours === 0) ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-black/20">
                    <TrendingUp className="w-8 h-8 mb-2" strokeWidth={1} />
                    <span className="text-sm">No hours logged yet</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyHoursData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#999' }} axisLine={{ stroke: '#eee' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#999' }} axisLine={{ stroke: '#eee' }} />
                      <Tooltip contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} formatter={(v) => [`${v}h`, 'Hours']} />
                      <Bar dataKey="hours" fill="#111" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-black/[0.06] p-5">
              <h4 className="text-xs uppercase tracking-widest font-semibold text-black/40 mb-4">Attendance</h4>
              {attendanceDonut.length === 0 ? (
                <div className="flex items-center justify-center h-[160px] text-sm text-black/20">No data yet</div>
              ) : (
                <div className="flex items-center gap-8 flex-wrap justify-center sm:justify-start">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={attendanceDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                        {attendanceDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {attendanceDonut.map((d, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-sm text-black/60">{d.name}: <strong className="text-black">{d.value}d</strong></span>
                        </div>
                        {d.name === 'Leave' && monthLeaves.length > 0 && (
                          <div className="ml-6 mt-1.5 space-y-1">
                            {monthLeaves.map((l, li) => (
                              <div key={li} className="text-xs text-black/50 flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-[#F59E0B] flex-shrink-0" />
                                {l.from_date === l.to_date
                                  ? new Date(l.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                  : `${new Date(l.from_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → ${new Date(l.to_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                                }
                                <span className="text-black/30">· {l.days_requested}d</span>
                              </div>
                            ))}
                          </div>
                        )}
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
            <div className="text-center text-black/40 py-8 text-sm">No tasks yet</div>
          ) : (
            <div>
              {spectateTask && (
                <div className="flex items-center gap-3 mb-3 text-xs text-black/50 flex-wrap">
                  {spectateTask.clock_in_time && <span>In: <strong className="text-black">{spectateTask.clock_in_time}</strong></span>}
                  {spectateTask.clock_out_time && <span>Out: <strong className="text-black">{spectateTask.clock_out_time}</strong></span>}
                  {spectateTask.total_hours && <span>{spectateTask.total_hours}h</span>}
                  <span className={`uppercase tracking-widest font-semibold px-2 py-0.5 rounded ${spectateTask.status === 'submitted' ? 'bg-[#C5F542]/20 text-[#5a7a00]' : 'bg-yellow-50 text-yellow-700'}`}>{spectateTask.status}</span>
                  <span className="text-[10px] text-[#C5F542] animate-pulse">● Live</span>
                </div>
              )}
              <DailyTaskGrid slots={spectateSlots} date={today} />
            </div>
          )}
        </Modal>
      )}

      {showSlotsModal && (
        <SlotsManagerModal
          slots={userSlots}
          onAddSlot={handleAddSlot}
          onRemoveSlot={handleRemoveSlot}
          onReorderSlots={handleReorderSlots}
          onToggleLunch={handleToggleLunch}
          onEditSlotTime={handleEditSlotTime}
          onClose={() => setShowSlotsModal(false)}
        />
      )}
    </div>
  )
}
