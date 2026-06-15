import { useEffect, useState, useRef, useCallback } from 'react'
import { Check, Trash2, ListTodo, BookOpen, Highlighter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Loader } from '../components/ui'

const HIGHLIGHT_COLORS = [
  { label: 'Yellow',  value: '#FEF08A' },
  { label: 'Green',   value: '#BBF7D0' },
  { label: 'Blue',    value: '#BFDBFE' },
  { label: 'Pink',    value: '#FBCFE8' },
  { label: 'Orange',  value: '#FED7AA' },
  { label: 'Purple',  value: '#E9D5FF' },
  { label: 'Red',     value: '#FECACA' },
  { label: 'Lime',    value: '#C5F542' },
]

export default function EmployeeLists() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [todos, setTodos] = useState([])
  const [todoInput, setTodoInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [notepadContent, setNotepadContent] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })
  const [savedRange, setSavedRange] = useState(null)

  const notepadRef = useRef(null)
  const notepadTimer = useRef(null)
  const colorPickerRef = useRef(null)
  const today = todayISO()

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

  // Set notepad content AFTER loading is done and ref is mounted
  useEffect(() => {
    if (!loading && notepadRef.current && notepadContent) {
      notepadRef.current.innerHTML = notepadContent
    }
  }, [loading, notepadContent])

  // Close color picker on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [todosRes, notepadRes] = await Promise.all([
      supabase.from('todos').select('*').eq('user_id', profile.id).eq('date', today).order('created_at', { ascending: true }),
      supabase.from('notepads').select('content').eq('user_id', profile.id).maybeSingle(),
    ])
    setTodos(todosRes.data || [])
    setNotepadContent(notepadRes.data?.content || '')
    setLoading(false)
  }

  // ============ TODOS ============
  const addTodo = async () => {
    if (!todoInput.trim()) return
    const { data, error } = await supabase.from('todos').insert({
      user_id: profile.id, text: todoInput.trim(), done: false, date: today,
    }).select().single()
    if (error) { showToast('Failed to add todo', 'error'); return }
    setTodos([...todos, data])
    setTodoInput('')
  }

  const toggleTodo = async (todo) => {
    const { error } = await supabase.from('todos').update({ done: !todo.done }).eq('id', todo.id)
    if (!error) setTodos(todos.map((t) => t.id === todo.id ? { ...t, done: !t.done } : t))
  }

  const deleteTodo = async (id) => {
    await supabase.from('todos').delete().eq('id', id)
    setTodos(todos.filter((t) => t.id !== id))
  }

  // ============ NOTEPAD ============
  const saveNotepad = useCallback((html) => {
    clearTimeout(notepadTimer.current)
    notepadTimer.current = setTimeout(async () => {
      await supabase.from('notepads').upsert({
        user_id: profile.id,
        content: html,
        updated_at: new Date().toISOString(),
      })
    }, 800)
  }, [profile?.id])

  const handleNotepadInput = () => {
    if (notepadRef.current) saveNotepad(notepadRef.current.innerHTML)
  }

  // Show color picker on text selection
  const handleMouseUp = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setShowColorPicker(false)
      return
    }
    if (!notepadRef.current?.contains(selection.anchorNode)) return

    const range = selection.getRangeAt(0)
    setSavedRange(range.cloneRange())

    const rect = range.getBoundingClientRect()
    const notepadRect = notepadRef.current.getBoundingClientRect()
    setPickerPos({
      top: rect.top - notepadRect.top - 52,
      left: Math.min(Math.max(0, rect.left - notepadRect.left), notepadRect.width - 244),
    })
    setShowColorPicker(true)
  }

  const applyHighlight = (color) => {
    if (!savedRange) return
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(savedRange)
    document.execCommand('hiliteColor', false, color)
    setShowColorPicker(false)
    setSavedRange(null)
    selection.removeAllRanges()
    if (notepadRef.current) saveNotepad(notepadRef.current.innerHTML)
  }

  const removeHighlight = () => {
    if (!savedRange) return
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(savedRange)
    document.execCommand('removeFormat', false, null)
    setShowColorPicker(false)
    setSavedRange(null)
    if (notepadRef.current) saveNotepad(notepadRef.current.innerHTML)
  }

  if (loading) return <Loader label="Loading lists" />

  return (
    <div>
      <PageHeader
        eyebrow="Personal"
        title="My Lists"
        subtitle="Daily to-dos reset overnight · Notepad stays forever"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Todos */}
        <div className="bg-white border border-black/10 overflow-hidden">
          <div className="bg-black text-white px-5 py-4 flex items-center gap-3">
            <ListTodo className="w-5 h-5" style={{ color: '#C5F542' }} strokeWidth={1.8} />
            <div>
              <div className="font-semibold">Today's To-dos</div>
              <div className="text-xs text-white/60">Resets every morning</div>
            </div>
          </div>
          <div className="p-5">
            <div className="flex gap-2 mb-4">
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                className="flex-1 px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none text-sm"
                placeholder="Quick task..."
              />
              <button onClick={addTodo} className="px-4 bg-[#C5F542] hover:bg-[#B8E83A] text-black font-semibold text-sm transition-colors">
                Add
              </button>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {todos.length === 0 ? (
                <p className="text-sm text-black/40 text-center py-8">No tasks yet. Add one above.</p>
              ) : (
                todos.map((t) => (
                  <div key={t.id} className={`flex items-center gap-3 px-3 py-2 group hover:bg-black/[0.02] ${t.done ? 'opacity-50' : ''}`}>
                    <button onClick={() => toggleTodo(t)}
                      className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 transition-colors ${t.done ? 'bg-[#C5F542] border-[#C5F542]' : 'border-black/30 hover:border-black'}`}>
                      {t.done && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                    </button>
                    <span className={`flex-1 text-sm ${t.done ? 'line-through' : ''}`}>{t.text}</span>
                    <button onClick={() => deleteTodo(t.id)} className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Notepad */}
        <div className="bg-white border border-black/10 overflow-hidden">
          <div className="bg-black text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5" style={{ color: '#C5F542' }} strokeWidth={1.8} />
              <div>
                <div className="font-semibold">Personal Notepad</div>
                <div className="text-xs text-white/60">Persistent · Auto-saves · Select text to highlight</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Highlighter className="w-3.5 h-3.5 text-white/40" strokeWidth={1.8} />
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Select to color</span>
            </div>
          </div>

          {/* Notepad editor */}
          <div className="relative">
            {/* Color picker popup */}
            {showColorPicker && (
              <div
                ref={colorPickerRef}
                className="absolute z-50 bg-white border border-black/15 shadow-xl p-2 rounded-lg"
                style={{ top: pickerPos.top, left: pickerPos.left }}
              >
                <div className="text-[9px] uppercase tracking-widest text-black/40 font-semibold mb-2 px-1">Highlight color</div>
                <div className="flex gap-1.5 flex-wrap" style={{ maxWidth: 220 }}>
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      title={c.label}
                      onMouseDown={(e) => { e.preventDefault(); applyHighlight(c.value) }}
                      className="w-7 h-7 rounded-md border-2 border-transparent hover:border-black/30 transition-all hover:scale-110 flex-shrink-0"
                      style={{ background: c.value }}
                    />
                  ))}
                  <button
                    title="Remove highlight"
                    onMouseDown={(e) => { e.preventDefault(); removeHighlight() }}
                    className="w-7 h-7 rounded-md border-2 border-black/20 hover:border-black/50 transition-all hover:scale-110 flex-shrink-0 flex items-center justify-center text-black/40 text-xs font-bold"
                    style={{ background: 'white' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div
              ref={notepadRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleNotepadInput}
              onMouseUp={handleMouseUp}
              onKeyUp={() => {
                const sel = window.getSelection()
                if (!sel || sel.isCollapsed) setShowColorPicker(false)
              }}
              className="w-full p-5 min-h-[400px] focus:outline-none text-sm leading-relaxed font-mono"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              data-placeholder="Your notes, contacts, reminders, ideas...&#10;&#10;Anything you want to keep handy."
            />
          </div>
        </div>
      </div>

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: rgba(0,0,0,0.3);
          pointer-events: none;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  )
}
