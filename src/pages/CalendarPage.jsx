import { useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Modal, Input, Button } from '../components/ui'

export default function CalendarPage() {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [viewDate, setViewDate] = useState(new Date())
  const [holidays, setHolidays] = useState([])
  const [leaves, setLeaves] = useState([])
  const [satOverrides, setSatOverrides] = useState([])
  const [showAddHoliday, setShowAddHoliday] = useState(false)
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '' })
  const [hoveredDay, setHoveredDay] = useState(null)
  const [loading, setLoading] = useState(true)

  const isCEO = profile?.role === 'ceo'

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

  const loadData = async () => {
    setLoading(true)

    // Load holidays
    const { data: holidaysData } = await supabase
      .from('holidays')
      .select('*')
      .order('date', { ascending: true })
    setHolidays(holidaysData || [])

    // Load approved leaves (CEO sees all, employee sees only their own)
    const leaveQuery = supabase
      .from('leave_requests')
      .select('*, users(name)')
      .eq('status', 'approved')

    if (!isCEO) leaveQuery.eq('user_id', profile.id)

    const { data: leavesData } = await leaveQuery
    setLeaves(leavesData || [])

    // Load Saturday overrides
    const overridesQuery = supabase.from('sat_overrides').select('*, users(name)')
    if (!isCEO) overridesQuery.eq('user_id', profile.id)

    const { data: ovData } = await overridesQuery
    setSatOverrides(ovData || [])

    setLoading(false)
  }

  // Real-time subscription so CEO sees changes immediately
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel('calendar-' + profile.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sat_overrides' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleString('default', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()

  const dateStr = (d) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const isHoliday = (d) => holidays.find((h) => h.date === dateStr(d))
  const isOnLeave = (d) =>
    leaves.find((r) => {
      const date = new Date(year, month, d)
      return date >= new Date(r.from_date) && date <= new Date(r.to_date)
    })
  const isSaturday = (d) => new Date(year, month, d).getDay() === 6
  const isSunday = (d) => new Date(year, month, d).getDay() === 0

  // Employee's own override for a Saturday
  const getMyOverride = (d) => {
    if (isCEO) return null
    return satOverrides.find((o) => o.user_id === profile.id && o.sat_date === dateStr(d))
  }

  // CEO: get all overrides for a Saturday
  const getOverridesForSat = (d) => {
    if (!isCEO) return []
    return satOverrides.filter((o) => o.sat_date === dateStr(d))
  }

  // Toggle Saturday override (employee only)
  const toggleSatOverride = async (d) => {
    if (isCEO) return
    const ds = dateStr(d)
    const existing = satOverrides.find(
      (o) => o.user_id === profile.id && o.sat_date === ds,
    )

    if (existing) {
      if (existing.status === 'off') {
        // Off → Working
        await supabase.from('sat_overrides').update({ status: 'working' }).eq('id', existing.id)
        showToast('Saturday marked as working')
      } else {
        // Working → remove (default)
        await supabase.from('sat_overrides').delete().eq('id', existing.id)
        showToast('Saturday reset to default')
      }
    } else {
      // No override → mark as off
      await supabase.from('sat_overrides').insert({
        user_id: profile.id,
        sat_date: ds,
        status: 'off',
      })
      showToast('Saturday marked as off')
    }

    // Notify CEO of the change
    if (!isCEO) {
      const { data: ceos } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'ceo')
        .eq('active', true)

      if (ceos?.length) {
        const notifs = ceos.map((ceo) => ({
          recipient_id: ceo.id,
          type: 'sat_override',
          message: `${profile.name} updated their Saturday status (${new Date(ds).toLocaleDateString()})`,
        }))
        await supabase.from('notifications').insert(notifs)
      }
    }

    loadData()
  }

  const addHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) return
    const { error } = await supabase.from('holidays').insert(holidayForm)
    if (error) {
      showToast('Failed to add holiday', 'error')
      return
    }
    setShowAddHoliday(false)
    setHolidayForm({ date: '', name: '' })
    showToast('Holiday added')
    loadData()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        subtitle={
          isCEO
            ? 'Team leaves, holidays, and Saturday overrides'
            : 'Click any Saturday to mark it as Working or Off'
        }
        action={
          isCEO && (
            <Button variant="primary" onClick={() => setShowAddHoliday(true)}>
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add Holiday
            </Button>
          )
        }
      />

      {/* Default Saturday toggle (employee only) */}
      {!isCEO && profile && (
        <div className="bg-white border border-black/10 p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold">Default: Saturday is a working day</div>
            <div className="text-xs text-black/60">
              Click individual Saturdays in the calendar below to override per-Saturday
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase
                .from('users')
                .update({ works_on_sat: !profile.works_on_sat })
                .eq('id', profile.id)
              await refreshProfile()
              showToast(`Default Saturday: ${!profile.works_on_sat ? 'working' : 'off'}`)
            }}
            className={`relative w-12 h-6 transition-colors ${
              profile.works_on_sat ? 'bg-[#C5F542]' : 'bg-black/20'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white shadow transition-transform ${
                profile.works_on_sat ? 'left-[26px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      )}

      <div className="bg-white border border-black/10 overflow-hidden">
        <div className="bg-black text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-2xl font-bold">
            {monthName} {year}
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setViewDate(new Date(year, month - 1))}
              className="p-2 hover:bg-white/10"
            >
              <ChevronRight className="w-4 h-4 rotate-180" strokeWidth={2} />
            </button>
            <button
              onClick={() => setViewDate(new Date())}
              className="px-3 py-1 hover:bg-white/10 text-xs uppercase tracking-widest"
            >
              Today
            </button>
            <button
              onClick={() => setViewDate(new Date(year, month + 1))}
              className="p-2 hover:bg-white/10"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-black/10">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              className="text-center text-[10px] uppercase tracking-widest font-semibold text-black/50 py-3"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div
              key={`e-${i}`}
              className="aspect-square border-r border-b border-black/5 last:border-r-0"
            />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const holiday = isHoliday(d)
            const leave = isOnLeave(d)
            const sat = isSaturday(d)
            const sun = isSunday(d)

            const myOverride = sat ? getMyOverride(d) : null
            const ceoOverrides = sat ? getOverridesForSat(d) : []

            let satIsOff = false
            if (sat && !isCEO) {
              if (myOverride?.status === 'off') satIsOff = true
              else if (myOverride?.status === 'working') satIsOff = false
              else satIsOff = !profile.works_on_sat
            }

            const isOff = sun || satIsOff || holiday
            const clickable = !isCEO && sat && !holiday && !leave

            return (
              <div
                key={d}
                onClick={() => clickable && toggleSatOverride(d)}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`aspect-square border-r border-b border-black/5 last:border-r-0 p-1.5 relative ${
                  isOff ? 'bg-black/[0.03]' : ''
                } ${clickable ? 'cursor-pointer hover:bg-[#C5F542]/20' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`text-sm font-semibold ${isOff ? 'text-black/40' : ''}`}>
                    {d}
                  </div>
                  {!isCEO && sat && myOverride && (
                    <div
                      className="w-1.5 h-1.5"
                      style={{ background: '#C5F542' }}
                      title="You overrode this Saturday"
                    />
                  )}
                </div>

                {holiday && (
                  <div className="absolute bottom-1 left-1 right-1 text-[8px] uppercase tracking-wider font-semibold bg-red-100 text-red-700 px-1 py-0.5 truncate">
                    {holiday.name}
                  </div>
                )}
                {leave && !holiday && (
                  <div className="absolute bottom-1 left-1 right-1 text-[8px] uppercase tracking-wider font-semibold bg-[#C5F542] text-black px-1 py-0.5">
                    Leave
                  </div>
                )}

                {/* Employee's own Saturday status */}
                {!isCEO && sat && !holiday && !leave && (
                  <div
                    className={`absolute bottom-1 left-1 right-1 text-[8px] uppercase tracking-wider font-semibold px-1 py-0.5 ${
                      satIsOff ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {satIsOff ? 'Off' : 'Work'}
                  </div>
                )}

                {/* CEO sees Off / Working labels */}
                {isCEO && sat && !holiday && ceoOverrides.length > 0 && (
                  <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
                    {ceoOverrides.some((ov) => ov.status === 'off') && (
                      <div className="text-[9px] uppercase tracking-wider font-bold bg-orange-100 text-orange-800 px-1 py-0.5 text-center">
                        Off
                      </div>
                    )}
                    {ceoOverrides.some((ov) => ov.status === 'working') && (
                      <div className="text-[9px] uppercase tracking-wider font-bold bg-blue-100 text-blue-800 px-1 py-0.5 text-center">
                        Working
                      </div>
                    )}
                  </div>
                )}

                {sun && !holiday && (
                  <div className="absolute bottom-1 left-1 right-1 text-[8px] uppercase tracking-wider text-black/40">
                    Sun
                  </div>
                )}

                {/* CEO Tooltip on hover */}
                {isCEO && hoveredDay === d && ceoOverrides.length > 0 && (
                  <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-xs px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none">
                    <div className="font-semibold mb-1">Saturday Status:</div>
                    {ceoOverrides.some((ov) => ov.status === 'off') && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-400" />
                        <span>Some employees: Off</span>
                      </div>
                    )}
                    {ceoOverrides.some((ov) => ov.status === 'working') && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400" />
                        <span>Some employees: Working</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-100 border border-red-300" />
          Holiday
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3" style={{ background: '#C5F542' }} />
          Approved Leave
        </div>
        {!isCEO && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-300" />
              Sat Working
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-100 border border-orange-300" />
              Sat Off
            </div>
            <div className="text-black/50 italic">Click a Saturday to toggle</div>
          </>
        )}
        {isCEO && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-300" />
              Working Saturday
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-100 border border-orange-300" />
              Off Saturday
            </div>
          </>
        )}
      </div>

      {showAddHoliday && (
        <Modal title="Add Company Holiday" onClose={() => setShowAddHoliday(false)}>
          <div className="space-y-4">
            <Input
              label="Holiday Name"
              type="text"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="e.g. Diwali"
            />
            <Input
              label="Date"
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
            />
            <Button
              variant="primary"
              onClick={addHoliday}
              className="w-full justify-center !py-3"
            >
              Add Holiday
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
