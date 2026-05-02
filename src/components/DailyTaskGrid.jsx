// Read-only 3-column display of a submitted daily task
// Used in History tab and CEO Member view

export default function DailyTaskGrid({ slots, date }) {
  const dateStr = date
    ? new Date(date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  // Sort slots by index
  const sortedSlots = [...slots].sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0))

  return (
    <div className="p-4">
      {dateStr && <p className="text-xs text-black/60 mb-3 font-medium">{dateStr}</p>}
      <div className="grid grid-cols-3 gap-4">
        {/* Tasks Worked On */}
        <div className="bg-white border-2 border-black overflow-hidden flex flex-col">
          <div className="bg-black text-white px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Tasks Worked On</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            {sortedSlots.map((s, i) => (
              <div key={i} className="bg-[#D9EAEA] border-b-2 border-black/20 last:border-b-0">
                <div className="px-3 py-2 bg-black flex items-center">
                  <span className="font-bold text-sm" style={{ color: '#C5F542' }}>
                    {s.time_slot}
                  </span>
                </div>
                <div className="px-3 py-3 text-sm text-black min-h-[60px]">
                  {s.tasks_worked_on || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Day's Agenda */}
        <div className="bg-white border-2 border-black overflow-hidden flex flex-col">
          <div className="bg-black text-white px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Day's Agenda</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            {sortedSlots.map((s, i) => (
              <div
                key={i}
                className="bg-[#D9EAEA] border-b-2 last:border-b-0"
                style={{ borderColor: '#C5F542' }}
              >
                <div className="px-3 py-3 text-sm text-black min-h-[60px]">
                  {s.days_agenda || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Pending */}
        <div className="bg-white border-2 border-black overflow-hidden flex flex-col">
          <div className="bg-black text-white px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Task Pending</h3>
          </div>
          <div className="overflow-y-auto flex-1">
            {sortedSlots.map((s, i) => (
              <div
                key={i}
                className="bg-[#FFFCB0] border-b-2 last:border-b-0"
                style={{ borderColor: '#C5F542' }}
              >
                <div className="px-3 py-3 text-sm text-black min-h-[60px]">
                  {s.task_pending || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
