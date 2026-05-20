import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Bell, LogOut, Home, ClipboardList, Calendar, Clock, FileText,
  CheckCircle2, Users, X, Menu, ListTodo, CalendarDays, User as UserIcon,
  LogIn, LogOut as LogOutIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotifContext'
import { useToast } from '../contexts/ToastContext'
import { getAvatar } from '../lib/avatars'
import { formatRelative } from '../lib/helpers'

export default function Layout({ children }) {
  const {
    profile, signOut, clockedIn, clockedOut, clockInTime, clockOutTime,
    handleClockIn, handleClockOut,
  } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [clockingIn, setClockingIn] = useState(false)
  const [clockingOut, setClockingOut] = useState(false)

  if (!profile) return null
  const isCEO = profile.role === 'ceo'
  const avatar = getAvatar(profile.avatar_id)

  const employeeNav = [
    { to: '/', label: "Today's Sheet", icon: ClipboardList, end: true },
    { to: '/lists', label: 'My Lists', icon: ListTodo },
    { to: '/leave', label: 'Leave', icon: Calendar },
    { to: '/logoff', label: 'Early Logoff', icon: Clock },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/history', label: 'History', icon: FileText },
    { to: '/profile', label: 'Profile', icon: UserIcon },
  ]

  const ceoNav = [
    { to: '/', label: 'Dashboard', icon: Home, end: true },
    { to: '/approvals', label: 'Approvals', icon: CheckCircle2 },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/team', label: 'Team', icon: Users },
    { to: '/profile', label: 'Profile', icon: UserIcon },
  ]

  const navItems = isCEO ? ceoNav : employeeNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const onClockIn = async () => {
    setClockingIn(true)
    await handleClockIn()
    setClockingIn(false)
  }

  const onClockOut = async () => {
    // Check if today's task sheet is submitted
    const today = todayISO()
    const { data } = await supabase
      .from('daily_tasks')
      .select('status')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle()

    if (!data || data.status !== 'submitted') {
      showToast('Please submit your task sheet before clocking out', 'error')
      return
    }

    setClockingOut(true)
    await handleClockOut()
    setClockingOut(false)
  }

  return (
    <div className="min-h-screen bg-[#F8F8F6]">
      {/* HEADER */}
      <header className="bg-black text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <button
                className="md:hidden -ml-2 p-2 hover:bg-white/10"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="text-2xl font-bold tracking-tight">
                <span style={{ color: '#C5F542' }}>A</span>xis
              </div>
              <div className="hidden md:block w-px h-6 bg-white/20" />
              <div className="hidden md:block text-xs text-white/60 uppercase tracking-widest font-medium">
                {isCEO ? 'Executive Panel' : 'Employee Panel'}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Clock In/Out buttons — employees only */}
              {!isCEO && (
                <div className="flex items-center gap-2">
                  {!clockedIn && (
                    <button
                      onClick={onClockIn}
                      disabled={clockingIn}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors bg-[#C5F542] text-black hover:bg-[#B8E83A] disabled:opacity-50"
                    >
                      <LogIn className="w-3.5 h-3.5" strokeWidth={2} />
                      <span className="hidden sm:inline">{clockingIn ? 'Clocking...' : 'Clock In'}</span>
                      <span className="sm:hidden">{clockingIn ? '...' : 'In'}</span>
                    </button>
                  )}
                  {clockedIn && !clockedOut && (
                    <>
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#C5F542' }} />
                        <span className="text-white/60">In since</span>
                        <span className="font-medium">{clockInTime}</span>
                      </div>
                      <button
                        onClick={onClockOut}
                        disabled={clockingOut}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        <LogOutIcon className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="hidden sm:inline">{clockingOut ? 'Clocking...' : 'Clock Out'}</span>
                        <span className="sm:hidden">{clockingOut ? '...' : 'Out'}</span>
                      </button>
                    </>
                  )}
                  {clockedIn && clockedOut && (
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-xs">
                      <CheckCircle2 className="w-3 h-3" style={{ color: '#C5F542' }} strokeWidth={2} />
                      <span className="text-white/60">In: {clockInTime}</span>
                      <span className="text-white/30">·</span>
                      <span className="text-white/60">Out: {clockOutTime}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative p-2 hover:bg-white/5 transition-colors"
                >
                  <Bell className="w-5 h-5" strokeWidth={1.8} />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-0.5 right-0.5 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center"
                      style={{ background: '#C5F542', color: '#000' }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white text-black shadow-2xl border border-black/10 z-40 overflow-hidden">
                      <div className="px-4 py-3 bg-black text-white flex items-center justify-between">
                        <span className="text-xs uppercase tracking-widest font-medium">Notifications</span>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-xs hover:underline" style={{ color: '#C5F542' }}>Mark all read</button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-black/40 text-sm">No notifications</div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => markRead(n.id)}
                              className={`w-full text-left p-4 border-b border-black/5 hover:bg-black/[0.02] transition-colors ${!n.is_read ? 'bg-[#C5F542]/[0.08]' : ''}`}
                            >
                              <div className="flex items-start gap-3">
                                {!n.is_read && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#C5F542' }} />}
                                <div className={`flex-1 ${n.is_read ? 'ml-5' : ''}`}>
                                  <p className="text-sm">{n.message}</p>
                                  <p className="text-xs text-black/40 mt-1">{formatRelative(n.created_at)}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Profile */}
              <NavLink to="/profile" className="flex items-center gap-2 hover:bg-white/5 p-1 pr-3 transition-colors">
                <div className="w-9 h-9 flex items-center justify-center text-base flex-shrink-0" style={{ background: avatar.bg }}>
                  {avatar.emoji}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium leading-tight">{profile.name}</div>
                  <div className="text-[10px] text-white/60 leading-tight">{profile.designation}</div>
                </div>
              </NavLink>

              <button onClick={handleSignOut} className="p-2 hover:bg-white/5 transition-colors" title="Sign out">
                <LogOut className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:block border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-1 overflow-x-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 ${
                      isActive ? 'border-[#C5F542] text-white' : 'border-transparent text-white/60 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" strokeWidth={1.8} />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-black">
            <nav className="flex flex-col">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-4 text-sm border-l-4 ${
                      isActive ? 'border-[#C5F542] bg-white/5 text-white' : 'border-transparent text-white/60'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" strokeWidth={1.8} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* LOCK SCREEN — Employee must clock in first */}
      {!isCEO && !clockedIn ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-black flex items-center justify-center">
              <LogIn className="w-8 h-8" style={{ color: '#C5F542' }} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Clock In to Start</h2>
            <p className="text-black/60 text-sm mb-8">
              Please click the <strong>Clock In</strong> button in the header to begin your workday. Your task sheet will be available after clocking in.
            </p>
            <button
              onClick={onClockIn}
              disabled={clockingIn}
              className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold bg-[#C5F542] text-black hover:bg-[#B8E83A] transition-colors disabled:opacity-50"
            >
              <LogIn className="w-5 h-5" strokeWidth={2} />
              {clockingIn ? 'Clocking In...' : 'Clock In Now'}
            </button>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      )}
    </div>
  )
}