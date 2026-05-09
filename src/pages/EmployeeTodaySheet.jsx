import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Send, Settings, Trash2, CheckCircle2, Clock, Timer, TrendingUp, ListTodo,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayISO, formatDateLong, calculateHours, getCurrentTime, getWeekMonday } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Loader, Button } from '../components/ui'
import SlotsManagerModal from '../components/SlotsManagerModal'

export default function EmployeeTodaySheet() {
  const { profile, loginTime } = useAuth()
  const { showToast } = useToast()
  const [userSlots, setUserSlots] = useState([])
  const [todaySlots, setTodaySlots] = useState([])
  const [dailyTaskId, setDailyTaskId] = useState(null)
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSlotsModal, setShowSlotsModal] = useState(false)
  const [weeklyHours, setWeeklyHours] = useState('0.0')
  const saveTimer = useRef(null)

  const today = todayISO()
  const submitted = status === 'submitted'

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

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
    await loadWeeklyHours()
    setLoading(false)
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
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => autosave(newSlots), 1200)
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
    showToast(`Day submitted · ${totalHours} hours logged`)
    setSubmitting(false)
    loadWeeklyHours()
  }

  if (loading) return <Loader label="Loading today's sheet" />

  const todayHours = calculateHours(todaySlots)
  const filledCount = todaySlots.filter((s) => s.tasks_worked_on?.trim()).length

  return (
    <div>
      <PageHeader
        eyebrow={formatDateLong(today)}
        title="Today's Sheet"
        subtitle="Fill in your work hour by hour. Submit at end of day."
        action={
          !submitted && (
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              <Send className="w-4 h-4" strokeWidth={2} />
              {submitting ? 'Submitting...' : 'Submit Day'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatBlock icon={Clock} label="Login Time" value={loginTime || '—'} />
        <StatBlock icon={Timer} label="Today's Hours" value={`${todayHours} h`} accent />
        <StatBlock icon={TrendingUp} label="Weekly Total" value={`${weeklyHours} h`} subtitle="resets Monday" />
        <StatBlock icon={ListTodo} label="Slots Used" value={`${filledCount}/${todaySlots.length}`} />
      </div>

      {submitted && (
        <div className="mb-6 bg-[#C5F542] p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-black" strokeWidth={2} />
          <div className="flex-1">
            <div className="font-semibold text-black">Day submitted · {todayHours} hours logged</div>
            <div className="text-xs text-black/70">CEO has been notified · Sheet is now locked</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Table 1: Tasks Worked On */}
        <div className="bg-white border-2 border-black overflow-hidden flex flex-col">
          <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
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
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {todaySlots.map((slot) => (
              <div key={slot.slot_index} className="bg-white border border-black/10 group">
                <div className="px-3 py-2 bg-black flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{slot.time_slot}</span>
                  {!submitted && todaySlots.length > 1 && (
                    <button
                      onClick={() => handleRemoveSlot(userSlots.find((s) => s.slot_index === slot.slot_index))}
                      className="opacity-0 group-hover:opacity-100 text-white/70 hover:text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <textarea
                  disabled={submitted}
                  value={slot.tasks_worked_on}
                  onChange={(e) => updateSlot(slot.slot_index, 'tasks_worked_on', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-white focus:outline-none disabled:text-black resize-none"
                  placeholder="What did you work on?"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Table 2: Day's Agenda */}
        <div className="bg-white border-2 border-black overflow-hidden flex flex-col">
          <div className="bg-black text-white px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Day's Agenda</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full border-collapse">
              <tbody>
                {todaySlots.map((slot) => (
                  <tr key={slot.slot_index} className="border-b-2 last:border-b-0" style={{ borderColor: '#fbfbfb' }}>
                    <td className="bg-white">
                      <textarea
                        disabled={submitted}
                        value={slot.days_agenda}
                        onChange={(e) => updateSlot(slot.slot_index, 'days_agenda', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-3 text-sm bg-white focus:outline-none disabled:text-black resize-none"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 3: Task Pending */}
        <div className="bg-white border-2 border-black overflow-hidden flex flex-col">
          <div className="bg-black text-white px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Task Pending</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            <table className="w-full border-collapse">
              <tbody>
                {todaySlots.map((slot) => (
                  <tr key={slot.slot_index} className="border-b-2 last:border-b-0" style={{ borderColor: '#fbfbfb' }}>
                    <td className="bg-white">
                      <textarea
                        disabled={submitted}
                        value={slot.task_pending}
                        onChange={(e) => updateSlot(slot.slot_index, 'task_pending', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-3 text-sm bg-white focus:outline-none disabled:text-black resize-none"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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