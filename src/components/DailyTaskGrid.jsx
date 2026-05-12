export default function DailyTaskGrid({ slots, date }) {
  const dateStr = date
    ? new Date(date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''
  const sortedSlots = [...slots].sort((a, b) => (a.slot_index || 0) - (b.slot_index || 0))

  return (
    <div className="p-4">
      {dateStr && <p className="text-xs text-black/60 mb-3 font-medium">{dateStr}</p>}
      <div className="border-2 border-black/20 overflow-hidden">
        <div className="grid grid-cols-3 bg-black text-white divide-x divide-white/10">
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Tasks Worked On</h3>
          </div>
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Day's Agenda</h3>
          </div>
          <div className="px-4 py-3">
            <h3 className="text-sm font-bold uppercase tracking-wider">Task Pending</h3>
          </div>
        </div>
        {sortedSlots.map((s, i) => (
          <div key={i} className="grid grid-cols-3 border-t border-black/10 divide-x divide-black/10">
            <div>
              <div className="px-3 py-1.5 bg-black/5 border-b border-black/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">{s.time_slot}</span>
              </div>
              <div className="px-3 py-3 text-sm min-h-[80px] bg-white">{s.tasks_worked_on || '—'}</div>
            </div>
            <div>
              <div className="px-3 py-1.5 bg-black/5 border-b border-black/10">
                <span className="text-[10px] invisible">x</span>
              </div>
              <div className="px-3 py-3 text-sm min-h-[80px] bg-white">{s.days_agenda || '—'}</div>
            </div>
            <div>
              <div className="px-3 py-1.5 bg-black/5 border-b border-black/10">
                <span className="text-[10px] invisible">x</span>
              </div>
              <div className="px-3 py-3 text-sm min-h-[80px] bg-white">{s.task_pending || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}