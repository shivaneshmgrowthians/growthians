import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { creditMonthlyLeaves } from '../lib/leaveCredit'
import { getCurrentTime } from '../lib/helpers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginTime, setLoginTime] = useState(null)

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
        if (event === 'SIGNED_IN') {
          setLoginTime(getCurrentTime())
        }
      } else {
        setProfile(null)
        setLoginTime(null)
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
      // Trigger auto-credit on sign-in
      await creditMonthlyLeaves(userId)
      // Refetch after credit
      const { data: updated } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(updated || data)
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

  // Sign in with role validation
  const signIn = async (email, password, expectedRole) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    // Verify role matches expected
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

  // Sign up — only allowed for CEO (first user). Employees are invited.
  const signUp = async (email, password, name) => {
    // Check if any user already exists
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (count > 0) {
      return {
        error: {
          message: 'A CEO account already exists. Please sign in instead.',
        },
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    setLoginTime(null)
  }

  // Verify current password by trying to sign in with it
  const verifyPassword = async (currentPassword) => {
    if (!session?.user?.email) return { error: { message: 'No user session' } }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    })
    return { data, error }
  }

  // Update password (requires user to be signed in)
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    return { data, error }
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, loginTime, signIn, signUp, signOut, refreshProfile, verifyPassword, updatePassword }}
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
