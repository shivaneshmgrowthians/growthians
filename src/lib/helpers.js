// ============ DATE & TIME HELPERS ============

export const todayISO = () => new Date().toISOString().split('T')[0]

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatDateLong = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export const formatRelative = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 1000 / 60
  if (diff < 1) return 'just now'
  if (diff < 60) return `${Math.floor(diff)}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return formatDate(dateStr)
}

export const getCurrentTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

export const daysBetween = (from, to) => {
  if (!from || !to) return 0
  const d1 = new Date(from)
  const d2 = new Date(to)
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
}

// Parse "10:00 AM" to minutes since midnight
export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return 0
  let [, h, m, p] = match
  h = parseInt(h)
  m = parseInt(m)
  if (p.toUpperCase() === 'PM' && h !== 12) h += 12
  if (p.toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + m
}

// Calculate hours from a list of slots that have content
export const calculateHours = (slots) => {
  if (!slots) return '0.0'
const filledSlots = slots.filter((s) => s.is_lunch || (s.tasks_worked_on && s.tasks_worked_on.trim()))
  let totalMinutes = 0
  filledSlots.forEach((slot) => {
    const match = slot.time_slot.match(/(\d+):(\d+)\s*(AM|PM).*?(\d+):(\d+)\s*(AM|PM)/i)
    if (match) {
      let [, h1, m1, p1, h2, m2, p2] = match
      h1 = parseInt(h1)
      m1 = parseInt(m1)
      h2 = parseInt(h2)
      m2 = parseInt(m2)
      if (p1.toUpperCase() === 'PM' && h1 !== 12) h1 += 12
      if (p1.toUpperCase() === 'AM' && h1 === 12) h1 = 0
      if (p2.toUpperCase() === 'PM' && h2 !== 12) h2 += 12
      if (p2.toUpperCase() === 'AM' && h2 === 12) h2 = 0
      totalMinutes += h2 * 60 + m2 - (h1 * 60 + m1)
    }
  })
  return (totalMinutes / 60).toFixed(1)
}

// Generate 30-minute interval times for full 24 hours
export const generateTimeOptions = () => {
  const options = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const period = h < 12 ? 'AM' : 'PM'
      const minStr = m.toString().padStart(2, '0')
      const hourStr = hour12.toString().padStart(2, '0')
      options.push(`${hourStr}:${minStr} ${period}`)
    }
  }
  return options
}

export const getInitials = (name) =>
  (name || '')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()

// Get the Monday of the current week
export const getWeekMonday = () => {
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}
