import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const NotifContext = createContext(null)

export function NotifProvider({ children }) {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!profile) return
    fetchNotifications()

    const channel = supabase
      .channel('notifications-' + profile.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev])
          if (Notification.permission === 'granted') {
            new Notification('Axis', { body: payload.new.message })
          }
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.id])

  const fetchNotifications = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifications(data)
  }

  const markRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', profile.id)
      .eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, fetchNotifications }}>
      {children}
    </NotifContext.Provider>
  )
}

export const useNotifications = () => {
  const ctx = useContext(NotifContext)
  if (!ctx) throw new Error('useNotifications must be used within NotifProvider')
  return ctx
}
