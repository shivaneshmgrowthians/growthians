import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { Modal, Field } from './ui'
import { generateTimeOptions, timeToMinutes } from '../lib/helpers'

export default function SlotsManagerModal({ slots, onAddSlot, onRemoveSlot, onClose }) {
  const [fromTime, setFromTime] = useState('10:00 AM')
  const [toTime, setToTime] = useState('11:00 AM')
  const [error, setError] = useState('')
  const timeOptions = generateTimeOptions()

  const handleAdd = async () => {
    setError('')
    const fromMin = timeToMinutes(fromTime)
    const toMin = timeToMinutes(toTime)

    if (toMin <= fromMin) {
      setError('"To" time must be after "From" time')
      return
    }

    const newSlotStr = `${fromTime} – ${toTime}`

    if (slots.some((s) => s.time_slot === newSlotStr)) {
      setError('This time slot already exists')
      return
    }

    await onAddSlot(newSlotStr)
  }

  return (
    <Modal title="Manage Hour Slots" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-black/60">
          Add or remove your daily time slots. Custom to your work schedule.
        </p>

        {/* Current slots list */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {slots.map((s) => (
            <div
              key={s.id || s.slot_index}
              className="flex items-center justify-between bg-black/5 px-3 py-2"
            >
              <span className="text-sm font-medium">{s.time_slot}</span>
              {slots.length > 1 && (
                <button
                  onClick={() => onRemoveSlot(s)}
                  className="text-black/40 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new slot */}
        <div className="border-t border-black/10 pt-4">
          <div className="text-xs uppercase tracking-widest text-black/60 font-semibold mb-3">
            Add New Slot
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="From">
              <select
                value={fromTime}
                onChange={(e) => {
                  setFromTime(e.target.value)
                  setError('')
                }}
                className="w-full px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none text-sm bg-white"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="To">
              <select
                value={toTime}
                onChange={(e) => {
                  setToTime(e.target.value)
                  setError('')
                }}
                className="w-full px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none text-sm bg-white"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

          <div className="text-xs text-black/50 mb-3">
            Preview:{' '}
            <span className="font-semibold text-black">
              {fromTime} – {toTime}
            </span>
          </div>

          <button
            onClick={handleAdd}
            className="w-full bg-[#C5F542] hover:bg-[#B8E83A] text-black font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Add Time Slot
          </button>
        </div>
      </div>
    </Modal>
  )
}
