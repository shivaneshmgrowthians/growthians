import { useState, useRef } from 'react'
import { Trash2, Plus, GripVertical, Coffee, Pencil, Check, X } from 'lucide-react'
import { Modal, Field } from './ui'
import { generateTimeOptions, timeToMinutes } from '../lib/helpers'

export default function SlotsManagerModal({ slots, onAddSlot, onRemoveSlot, onReorderSlots, onToggleLunch, onEditSlotTime, onClose }) {
  const [fromTime, setFromTime] = useState('10:00 AM')
  const [toTime, setToTime] = useState('11:00 AM')
  const [error, setError] = useState('')
  const [editingSlotId, setEditingSlotId] = useState(null)
  const [editFrom, setEditFrom] = useState('')
  const [editTo, setEditTo] = useState('')
  const [editError, setEditError] = useState('')
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragIndexRef = useRef(null)
  const timeOptions = generateTimeOptions()

  const handleAdd = async () => {
    setError('')
    const fromMin = timeToMinutes(fromTime)
    const toMin = timeToMinutes(toTime)
    if (toMin <= fromMin) { setError('"To" time must be after "From" time'); return }
    const newSlotStr = `${fromTime} – ${toTime}`
    if (slots.some((s) => s.time_slot === newSlotStr)) { setError('This time slot already exists'); return }
    await onAddSlot(newSlotStr)
  }

  const startEdit = (s) => {
    const parts = s.time_slot.split(' – ')
    setEditFrom(parts[0] || '10:00 AM')
    setEditTo(parts[1] || '11:00 AM')
    setEditingSlotId(s.id || s.slot_index)
    setEditError('')
  }

  const confirmEdit = async (s) => {
    setEditError('')
    const fromMin = timeToMinutes(editFrom)
    const toMin = timeToMinutes(editTo)
    if (toMin <= fromMin) { setEditError('"To" must be after "From"'); return }
    const newSlotStr = `${editFrom} – ${editTo}`
    await onEditSlotTime(s, newSlotStr)
    setEditingSlotId(null)
  }

  const cancelEdit = () => { setEditingSlotId(null); setEditError('') }

  // Drag handlers
  const handleDragStart = (e, idx) => {
    dragIndexRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(idx)
  }

  const handleDrop = (e, idx) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === idx) { setDragOverIndex(null); return }
    const reordered = [...slots]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(idx, 0, moved)
    onReorderSlots(reordered)
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  const handleDragEnd = () => { dragIndexRef.current = null; setDragOverIndex(null) }

  return (
    <Modal title="Manage Hour Slots" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-black/60">
          Drag to reorder · Click <Pencil className="inline w-3 h-3" /> to edit time · Click <Coffee className="inline w-3 h-3" /> to mark lunch break
        </p>

        {/* Current slots list */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {slots.map((s, idx) => {
            const slotKey = s.id || s.slot_index
            const isEditing = editingSlotId === slotKey
            const isLunch = s.is_lunch

            return (
              <div
                key={slotKey}
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`border transition-all ${
                  dragOverIndex === idx ? 'border-[#C5F542] bg-[#C5F542]/10' : 'border-transparent'
                } ${isLunch ? 'bg-amber-50' : 'bg-black/5'}`}
              >
                {isEditing ? (
                  <div className="px-3 py-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-black/40 mb-1">From</div>
                        <select value={editFrom} onChange={(e) => setEditFrom(e.target.value)}
                          className="w-full px-2 py-1.5 border border-black/15 focus:border-black focus:outline-none text-xs bg-white">
                          {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-black/40 mb-1">To</div>
                        <select value={editTo} onChange={(e) => setEditTo(e.target.value)}
                          className="w-full px-2 py-1.5 border border-black/15 focus:border-black focus:outline-none text-xs bg-white">
                          {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    {editError && <p className="text-xs text-red-600">{editError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => confirmEdit(s)} className="flex items-center gap-1 px-3 py-1.5 bg-[#C5F542] text-black text-xs font-semibold">
                        <Check className="w-3 h-3" strokeWidth={2.5} /> Save
                      </button>
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 bg-black/10 text-black text-xs font-semibold">
                        <X className="w-3 h-3" strokeWidth={2.5} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-black/20 cursor-grab active:cursor-grabbing flex-shrink-0" strokeWidth={1.5} />
                      <div>
                        <span className="text-sm font-medium">{s.time_slot}</span>
                        {isLunch && <span className="ml-2 text-[10px] uppercase tracking-widest font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5">Lunch</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(s)} title="Edit time" className="p-1.5 text-black/30 hover:text-black transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onToggleLunch(s)} title="Toggle lunch" className={`p-1.5 transition-colors ${isLunch ? 'text-amber-500' : 'text-black/30 hover:text-amber-500'}`}>
                        <Coffee className="w-3.5 h-3.5" />
                      </button>
                      {slots.length > 1 && (
                        <button onClick={() => onRemoveSlot(s)} className="p-1.5 text-black/30 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add new slot */}
        <div className="border-t border-black/10 pt-4">
          <div className="text-xs uppercase tracking-widest text-black/60 font-semibold mb-3">Add New Slot</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="From">
              <select value={fromTime} onChange={(e) => { setFromTime(e.target.value); setError('') }}
                className="w-full px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none text-sm bg-white">
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="To">
              <select value={toTime} onChange={(e) => { setToTime(e.target.value); setError('') }}
                className="w-full px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none text-sm bg-white">
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="text-xs text-black/50 mb-3">
            Preview: <span className="font-semibold text-black">{fromTime} – {toTime}</span>
          </div>
          <button onClick={handleAdd}
            className="w-full bg-[#C5F542] hover:bg-[#B8E83A] text-black font-semibold py-2.5 text-sm transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Add Time Slot
          </button>
        </div>
      </div>
    </Modal>
  )
}
