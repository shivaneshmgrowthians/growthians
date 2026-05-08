import { useEffect, useState } from 'react'
import { Users, UserX, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Modal, Loader, Button } from '../components/ui'
import { getAvatar } from '../lib/avatars'

export default function CEOTeam() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', designation: '' })

  useEffect(() => {
    if (profile?.id) loadTeam()
  }, [profile?.id])

  const loadTeam = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('role', { ascending: true })
      .order('created_at', { ascending: true })
    setTeam(data || [])
    setLoading(false)
  }

  const handleInvite = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.designation.trim()) {
      showToast('Please fill all fields', 'error')
      return
    }
    setInviting(true)
    try {
      const res = await fetch(
        'https://wsjebagxvcbxowcuelny.supabase.co/auth/v1/invite',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': 'Bearer ' + import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            email: form.email.trim(),
            data: {
              name: form.name.trim(),
              designation: form.designation.trim(),
              role: 'employee',
            },
            redirect_to: 'https://growthians.vercel.app/auth/set-password',
          }),
        }
      )

      const resData = await res.json()
      if (!res.ok) throw new Error(resData.msg || resData.message || resData.error_description || 'Invite failed')

      const { error: dbError } = await supabase.from('users').insert({
        id: resData.id,
        email: form.email.trim(),
        name: form.name.trim(),
        designation: form.designation.trim(),
        role: 'employee',
        active: true,
        leave_balance: 12,
      })

      if (dbError) throw dbError

      showToast('Invite sent to ' + form.email.trim() + '!', 'success')
      setForm({ name: '', email: '', designation: '' })
      setShowInvite(false)
      loadTeam()
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Failed to send invite', 'error')
    } finally {
      setInviting(false)
    }
  }

  const toggleActive = async (user) => {
    if (user.id === profile.id) {
      showToast("You can't deactivate yourself", 'error')
      return
    }
    const { error } = await supabase
      .from('users')
      .update({ active: !user.active })
      .eq('id', user.id)
    if (error) {
      showToast('Failed to update', 'error')
      return
    }
    showToast(user.name + (user.active ? ' deactivated' : ' reactivated'))
    loadTeam()
  }

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Team Members"
        subtitle="Invite and manage your team directly from here."
        action={
          <Button variant="primary" onClick={() => setShowInvite(true)}>
            <Users className="w-4 h-4" strokeWidth={2} />
            Invite Member
          </Button>
        }
      />

      {loading ? (
        <Loader />
      ) : (
        <div className="bg-white border border-black/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-black text-white">
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">Member</th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">Designation</th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">Email</th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">Leaves</th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {team.map((u) => {
                const avatar = getAvatar(u.avatar_id)
                return (
                  <tr key={u.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: avatar.bg }}>
                          {avatar.emoji}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{u.name}</div>
                          <div className="text-[10px] uppercase tracking-widest font-semibold text-black/50">{u.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.designation}</td>
                    <td className="px-4 py-3 text-sm text-black/60">{u.email}</td>
                    <td className="px-4 py-3 text-sm">{u.leave_balance} / 12</td>
                    <td className="px-4 py-3">
                      {u.active ? (
                        <span className="text-[10px] uppercase tracking-widest font-semibold bg-[#C5F542] text-black px-2 py-1">Active</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest font-semibold bg-black/10 text-black/50 px-2 py-1">Inactive</span>
                      )}
                    </td>
                    <td className="px-2">
                      {u.id !== profile.id && (
                        <button onClick={() => toggleActive(u)} className="p-2 text-black/40 hover:text-black" title={u.active ? 'Deactivate' : 'Reactivate'}>
                          {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <Modal title="Invite New Team Member" onClose={() => setShowInvite(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1">Full Name</label>
              <input
                type="text"
                className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black"
                placeholder="e.g. Priya Sharma"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1">Work Email</label>
              <input
                type="email"
                className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black"
                placeholder="e.g. priya@growthians.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest font-semibold mb-1">Designation</label>
              <input
                type="text"
                className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:border-black"
                placeholder="e.g. Social Media Executive"
                value={form.designation}
                onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" onClick={handleInvite} disabled={inviting} className="flex-1">
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
              <Button variant="secondary" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}