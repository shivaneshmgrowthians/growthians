import { useState } from 'react'
import { Edit3, Mail, Briefcase, Save, X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Modal, Input, Button } from '../components/ui'
import { AVATAR_PRESETS, getAvatar } from '../lib/avatars'
import { getNextCreditDate } from '../lib/leaveCredit'

export default function Profile() {
  const { profile, refreshProfile, clockInTime, clockOutTime, verifyPassword, updatePassword } = useAuth()
  const { showToast } = useToast()
  const [showEdit, setShowEdit] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', designation: '', works_on_sat: true })
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  if (!profile) return null
  const avatar = getAvatar(profile.avatar_id)
  const isCEO = profile.role === 'ceo'

  const openEdit = () => {
    setEditForm({
      name: profile.name,
      designation: profile.designation,
      works_on_sat: profile.works_on_sat,
    })
    setShowEdit(true)
  }

  const saveProfile = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({
        name: editForm.name,
        designation: editForm.designation,
        works_on_sat: editForm.works_on_sat,
      })
      .eq('id', profile.id)

    if (error) {
      showToast('Failed to update profile', 'error')
      setSaving(false)
      return
    }

    await refreshProfile()
    setShowEdit(false)
    showToast('Profile updated')
    setSaving(false)
  }

  const setAvatar = async (avatarId) => {
    const { error } = await supabase
      .from('users')
      .update({ avatar_id: avatarId })
      .eq('id', profile.id)

    if (error) {
      showToast('Failed to update avatar', 'error')
      return
    }
    await refreshProfile()
    setShowAvatarPicker(false)
    showToast('Avatar updated')
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()

    if (passwordForm.new.length < 6) {
      showToast('New password must be at least 6 characters', 'error')
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      showToast('New passwords do not match', 'error')
      return
    }
    if (passwordForm.current === passwordForm.new) {
      showToast('New password must be different from current', 'error')
      return
    }

    setChangingPassword(true)

    const { error: verifyError } = await verifyPassword(passwordForm.current)
    if (verifyError) {
      showToast('Current password is incorrect', 'error')
      setChangingPassword(false)
      return
    }

    const { error: updateError } = await updatePassword(passwordForm.new)
    if (updateError) {
      showToast(updateError.message || 'Failed to update password', 'error')
      setChangingPassword(false)
      return
    }

    showToast('Password changed successfully')
    setShowChangePassword(false)
    setPasswordForm({ current: '', new: '', confirm: '' })
    setChangingPassword(false)
  }

  const nextCreditDate = getNextCreditDate(profile.last_credited_month, profile.leave_start_month)
  const nextCreditStr = nextCreditDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        subtitle="Your personal information"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-1">
          <div className="bg-black text-white p-6 relative overflow-hidden">
            <div
              className="absolute -top-20 -right-20 w-48 h-48 rounded-full opacity-20"
              style={{ background: '#C5F542' }}
            />
            <div className="relative">
              <button
                onClick={() => setShowAvatarPicker(true)}
                className="relative group mb-4"
              >
                <div
                  className="w-24 h-24 flex items-center justify-center text-5xl shadow-lg"
                  style={{ background: avatar.bg }}
                >
                  {avatar.emoji}
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <Edit3 className="w-5 h-5 text-white" strokeWidth={1.8} />
                </div>
              </button>
              <h3 className="text-2xl font-bold">{profile.name}</h3>
              <p className="text-sm text-white/60 mb-4">{profile.designation}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-white/80">
                  <Mail className="w-4 h-4" strokeWidth={1.8} />
                  {profile.email}
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <Briefcase className="w-4 h-4" strokeWidth={1.8} />
                  {isCEO ? 'CEO' : 'Employee'}
                </div>
              </div>
              <Button
                variant="primary"
                onClick={openEdit}
                className="mt-6 w-full justify-center"
              >
                <Edit3 className="w-4 h-4" strokeWidth={2} />
                Edit Profile
              </Button>
              <button
                onClick={() => setShowChangePassword(true)}
                className="mt-2 w-full text-xs text-white/60 hover:text-white py-2 transition-colors flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" strokeWidth={1.8} />
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Stats / Info */}
        <div className="lg:col-span-2 space-y-4">
          {!isCEO && (
            <>
              <div className="bg-white border border-black/10 p-6">
                <div className="text-xs uppercase tracking-widest text-black/50 font-semibold mb-4">
                  Leave Balance
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <div className="text-6xl font-bold">{profile.leave_balance}</div>
                  <div className="text-xl text-black/40">/ 12</div>
                </div>
                <div className="w-full bg-black/5 h-2 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      background: '#C5F542',
                      width: `${(profile.leave_balance / 12) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-black/60 mt-3">
                  1 leave credited monthly · Carries forward up to 12 max
                  {profile.last_credited_month && (
                    <> · Next credit: <span className="font-semibold text-black">{nextCreditStr}</span></>
                  )}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white border border-black/10 p-6">
                  <div className="text-xs uppercase tracking-widest text-black/50 font-semibold mb-2">
                    Today's Clock
                  </div>
                  <div className="text-2xl font-bold">{clockInTime || 'Not clocked in'}</div>
                  <div className="text-xs text-black/50 mt-1">
                    {clockOutTime ? `Out: ${clockOutTime}` : 'Not clocked out yet'}
                  </div>
                </div>
                <div className="bg-white border border-black/10 p-6">
                  <div className="text-xs uppercase tracking-widest text-black/50 font-semibold mb-2">
                    Saturday Default
                  </div>
                  <div className="text-2xl font-bold">
                    {profile.works_on_sat ? 'Working' : 'Off'}
                  </div>
                  <div className="text-xs text-black/50 mt-1">
                    Edit profile to change · Override per-day in calendar
                  </div>
                </div>
              </div>
            </>
          )}

          {isCEO && (
            <div className="bg-white border border-black/10 p-6">
              <div className="text-xs uppercase tracking-widest text-black/50 font-semibold mb-3">
                Account Details
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-black/50">Name</div>
                  <div className="text-base font-medium">{profile.name}</div>
                </div>
                <div>
                  <div className="text-xs text-black/50">Designation</div>
                  <div className="text-base font-medium">{profile.designation}</div>
                </div>
                <div>
                  <div className="text-xs text-black/50">Email</div>
                  <div className="text-base font-medium">{profile.email}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEdit && (
        <Modal title="Edit Profile" onClose={() => setShowEdit(false)}>
          <div className="space-y-4">
            <Input
              label="Name"
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <Input
              label="Designation"
              type="text"
              value={editForm.designation}
              onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
            />
            {!isCEO && (
              <label className="flex items-center gap-3 p-3 bg-black/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.works_on_sat}
                  onChange={(e) =>
                    setEditForm({ ...editForm, works_on_sat: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-sm font-medium">Saturday is a working day</div>
                  <div className="text-xs text-black/60">
                    Uncheck if you don't work on Saturdays
                  </div>
                </div>
              </label>
            )}
            <Button
              variant="primary"
              onClick={saveProfile}
              disabled={saving}
              className="w-full justify-center !py-3"
            >
              <Save className="w-4 h-4" strokeWidth={2} />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Avatar Picker */}
      {showAvatarPicker && (
        <Modal title="Choose Avatar" onClose={() => setShowAvatarPicker(false)}>
          <div className="grid grid-cols-4 gap-3">
            {AVATAR_PRESETS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.id)}
                className={`aspect-square flex items-center justify-center text-3xl transition-all ${
                  profile.avatar_id === a.id ? 'ring-4 ring-black' : 'hover:scale-105'
                }`}
                style={{ background: a.bg }}
              >
                {a.emoji}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <Modal title="Change Password" onClose={() => setShowChangePassword(false)}>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-black/60 mb-1.5 font-semibold">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 border border-black/15 focus:border-black focus:outline-none transition-colors"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                  tabIndex={-1}
                >
                  {showCurrentPwd ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-black/60 mb-1.5 font-semibold">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  className="w-full px-3 py-2.5 pr-10 border border-black/15 focus:border-black focus:outline-none transition-colors"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                  tabIndex={-1}
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-black/60 mb-1.5 font-semibold">
                Confirm New Password
              </label>
              <input
                type={showNewPwd ? 'text' : 'password'}
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="w-full px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none transition-colors"
                placeholder="Re-enter new password"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={changingPassword}
              className="w-full justify-center !py-3"
            >
              <KeyRound className="w-4 h-4" strokeWidth={2} />
              {changingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  )
}