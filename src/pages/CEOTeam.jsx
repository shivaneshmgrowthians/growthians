import { useEffect, useState } from 'react'
import { Users, UserX, UserCheck, ExternalLink } from 'lucide-react'
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
  const [showInviteHelp, setShowInviteHelp] = useState(false)

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
    showToast(`${user.name} ${user.active ? 'deactivated' : 'reactivated'}`)
    loadTeam()
  }

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Team Members"
        subtitle="Manage your team. New members are invited via Supabase."
        action={
          <Button variant="primary" onClick={() => setShowInviteHelp(true)}>
            <Users className="w-4 h-4" strokeWidth={2} />
            How to Invite
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
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">
                  Member
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">
                  Designation
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">
                  Email
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">
                  Leaves
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest font-semibold px-4 py-3">
                  Status
                </th>
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
                        <div
                          className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                          style={{ background: avatar.bg }}
                        >
                          {avatar.emoji}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{u.name}</div>
                          <div className="text-[10px] uppercase tracking-widest font-semibold text-black/50">
                            {u.role}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.designation}</td>
                    <td className="px-4 py-3 text-sm text-black/60">{u.email}</td>
                    <td className="px-4 py-3 text-sm">{u.leave_balance} / 12</td>
                    <td className="px-4 py-3">
                      {u.active ? (
                        <span className="text-[10px] uppercase tracking-widest font-semibold bg-[#C5F542] text-black px-2 py-1">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest font-semibold bg-black/10 text-black/50 px-2 py-1">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-2">
                      {u.id !== profile.id && (
                        <button
                          onClick={() => toggleActive(u)}
                          className="p-2 text-black/40 hover:text-black"
                          title={u.active ? 'Deactivate' : 'Reactivate'}
                        >
                          {u.active ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
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

      {/* Invite Help Modal */}
      {showInviteHelp && (
        <Modal title="How to Invite a New Team Member" onClose={() => setShowInviteHelp(false)}>
          <div className="space-y-4 text-sm">
            <p className="text-black/70">
              For security, team members are added through Supabase directly. Here's the process:
            </p>

            <ol className="space-y-3 list-decimal list-inside">
              <li>
                Go to your{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Supabase dashboard
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Open your project → <strong>Authentication</strong> → <strong>Users</strong>
              </li>
              <li>
                Click <strong>"Invite User"</strong> (top right)
              </li>
              <li>Enter the team member's email and click Send</li>
              <li>
                They'll receive an email with a link to set their password
              </li>
              <li>
                Once they sign up, they appear in this Team list automatically with role "Employee"
              </li>
              <li>
                You can then click their row to edit their designation/details if needed
              </li>
            </ol>

            <div className="bg-yellow-50 border border-yellow-200 p-3 text-xs">
              <strong>Note:</strong> Make sure you've configured your Supabase email templates and
              site URL in Authentication → URL Configuration before sending invites.
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
