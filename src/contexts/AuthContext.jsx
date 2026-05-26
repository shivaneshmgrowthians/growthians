import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { creditMonthlyLeaves } from '../lib/leaveCredit'
import { getCurrentTime, todayISO } from '../lib/helpers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clockedIn, setClockedIn] = useState(false)
  const [clockedOut, setClockedOut] = useState(false)
  const [clockInTime, setClockInTime] = useState(null)
  const [clockOutTime, setClockOutTime] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        fetchProfile(data.session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (newSession) {
        fetchProfile(newSession.user.id)
      } else {
        setProfile(null)
        setClockedIn(false)
        setClockedOut(false)
        setClockInTime(null)
        setClockOutTime(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

   if (!error && data) {
      setProfile(data)
      // Credit leaves in background — don't block profile load
      creditMonthlyLeaves(userId).then(async (result) => {
        if (result?.credited > 0) {
          const { data: updated } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()
          if (updated) setProfile(updated)
        }
      })
    }

      // Load today's clock status
      const today = todayISO()
      const { data: taskData } = await supabase
        .from('daily_tasks')
        .select('clocked_in, clocked_out, clock_in_time, clock_out_time')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()

      if (taskData) {
        setClockedIn(taskData.clocked_in || false)
        setClockedOut(taskData.clocked_out || false)
        setClockInTime(taskData.clock_in_time || null)
        setClockOutTime(taskData.clock_out_time || null)
      } else {
        setClockedIn(false)
        setClockedOut(false)
        setClockInTime(null)
        setClockOutTime(null)
      }
    }
    setLoading(false)
  }

  const refreshProfile = async () => {
    if (session?.user?.id) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (data) setProfile(data)
    }
  }

  const handleClockIn = async () => {
    if (!profile?.id) return
    const today = todayISO()
    const time = getCurrentTime()

    // Check if daily_task exists for today
    const { data: existing } = await supabase
      .from('daily_tasks')
      .select('id')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      await supabase.from('daily_tasks')
        .update({ clocked_in: true, clock_in_time: time, login_time: time })
        .eq('id', existing.id)
    } else {
      await supabase.from('daily_tasks')
        .insert({ user_id: profile.id, date: today, status: 'draft', clocked_in: true, clock_in_time: time, login_time: time })
    }

    setClockedIn(true)
    setClockInTime(time)
    return time
  }

  const handleClockOut = async () => {
    if (!profile?.id) return
    const today = todayISO()
    const time = getCurrentTime()

    await supabase.from('daily_tasks')
      .update({ clocked_out: true, clock_out_time: time })
      .eq('user_id', profile.id)
      .eq('date', today)

    setClockedOut(true)
    setClockOutTime(time)
    return time
  }

  const signIn = async (email, password, expectedRole) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single()
    if (userProfile?.role !== expectedRole) {
      await supabase.auth.signOut()
      return {
        error: {
          message: expectedRole === 'ceo'
            ? 'This account is not a CEO account. Use Team Member sign-in.'
            : 'This account is a CEO account. Use CEO sign-in.',
        },
      }
    }
    return { data }
  }

  const signUp = async (email, password, name) => {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    if (count > 0) {
      return { error: { message: 'A CEO account already exists. Please sign in instead.' } }
    }
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    setClockedIn(false)
    setClockedOut(false)
    setClockInTime(null)
    setClockOutTime(null)
  }

  const verifyPassword = async (currentPassword) => {
    if (!session?.user?.email) return { error: { message: 'No user session' } }
    const { data, error } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword })
    return { data, error }
  }

  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    return { data, error }
  }

  return (
    <AuthContext.Provider
      value={{
        session, profile, loading,
        clockedIn, clockedOut, clockInTime, clockOutTime,
        handleClockIn, handleClockOut,
        signIn, signUp, signOut, refreshProfile, verifyPassword, updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}