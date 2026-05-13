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
    <div className="p-2">
      {dateStr && <p className="text-xs text-black/60 mb-3 font-medium">{dateStr}</p>}
      <div className="border border-black/20 overflow-hidden">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-black text-white">
              <th className="text-left text-[10px] uppercase tracking-wider font-bold px-3 py-2.5 border-r border-white/10" style={{ width: '40%' }}>Tasks Worked On</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-bold px-3 py-2.5 border-r border-white/10" style={{ width: '30%' }}>Day's Agenda</th>
              <th className="text-left text-[10px] uppercase tracking-wider font-bold px-3 py-2.5" style={{ width: '30%' }}>Task Pending</th>
            </tr>
          </thead>
          <tbody>
            {sortedSlots.map((s, i) => (
              <tr key={i} className="border-t border-black/10">
                <td className="px-3 py-2 border-r border-black/10 align-top">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-black/40 mb-1">{s.time_slot}</div>
                  <div className="text-xs text-black break-words">{s.tasks_worked_on || '—'}</div>
                </td>
                <td className="px-3 py-2 border-r border-black/10 align-top">
                  <div className="text-xs text-black break-words">{s.days_agenda || '—'}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="text-xs text-black break-words">{s.task_pending || '—'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}