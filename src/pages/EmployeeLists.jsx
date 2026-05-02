import { useEffect, useState, useRef } from 'react'
import { Check, Trash2, ListTodo, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/helpers'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { PageHeader, Loader } from '../components/ui'

export default function EmployeeLists() {
  const { profile } = useAuth()
  const { showToast } = useToast()
  const [todos, setTodos] = useState([])
  const [todoInput, setTodoInput] = useState('')
  const [notepad, setNotepad] = useState('')
  const [loading, setLoading] = useState(true)
  const notepadTimer = useRef(null)
  const today = todayISO()

  useEffect(() => {
    if (profile?.id) loadData()
  }, [profile?.id])

  const loadData = async () => {
    setLoading(true)
    const [todosRes, notepadRes] = await Promise.all([
      supabase
        .from('todos')
        .select('*')
        .eq('user_id', profile.id)
        .eq('date', today)
        .order('created_at', { ascending: true }),
      supabase
        .from('notepads')
        .select('content')
        .eq('user_id', profile.id)
        .maybeSingle(),
    ])

    setTodos(todosRes.data || [])
    setNotepad(notepadRes.data?.content || '')
    setLoading(false)
  }

  // ============ TODOS ============
  const addTodo = async () => {
    if (!todoInput.trim()) return

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: profile.id,
        text: todoInput.trim(),
        done: false,
        date: today,
      })
      .select()
      .single()

    if (error) {
      showToast('Failed to add todo', 'error')
      return
    }
    setTodos([...todos, data])
    setTodoInput('')
  }

  const toggleTodo = async (todo) => {
    const { error } = await supabase
      .from('todos')
      .update({ done: !todo.done })
      .eq('id', todo.id)

    if (!error) {
      setTodos(todos.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)))
    }
  }

  const deleteTodo = async (id) => {
    await supabase.from('todos').delete().eq('id', id)
    setTodos(todos.filter((t) => t.id !== id))
  }

  // ============ NOTEPAD ============
  const updateNotepad = (text) => {
    setNotepad(text)
    clearTimeout(notepadTimer.current)
    notepadTimer.current = setTimeout(async () => {
      // Upsert notepad
      await supabase
        .from('notepads')
        .upsert({
          user_id: profile.id,
          content: text,
          updated_at: new Date().toISOString(),
        })
    }, 800)
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
              <button
                onClick={addTodo}
                className="px-4 bg-[#C5F542] hover:bg-[#B8E83A] text-black font-semibold text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {todos.length === 0 ? (
                <p className="text-sm text-black/40 text-center py-8">
                  No tasks yet. Add one above.
                </p>
              ) : (
                todos.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-3 py-2 group hover:bg-black/[0.02] ${
                      t.done ? 'opacity-50' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleTodo(t)}
                      className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        t.done
                          ? 'bg-[#C5F542] border-[#C5F542]'
                          : 'border-black/30 hover:border-black'
                      }`}
                    >
                      {t.done && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                    </button>
                    <span className={`flex-1 text-sm ${t.done ? 'line-through' : ''}`}>
                      {t.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-black/30 hover:text-red-600"
                    >
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
          <div className="bg-black text-white px-5 py-4 flex items-center gap-3">
            <BookOpen className="w-5 h-5" style={{ color: '#C5F542' }} strokeWidth={1.8} />
            <div>
              <div className="font-semibold">Personal Notepad</div>
              <div className="text-xs text-white/60">Persistent · Auto-saves</div>
            </div>
          </div>
          <textarea
            value={notepad}
            onChange={(e) => updateNotepad(e.target.value)}
            className="w-full p-5 min-h-[400px] focus:outline-none resize-none text-sm leading-relaxed font-mono"
            placeholder="Your notes, contacts, reminders, ideas...&#10;&#10;Anything you want to keep handy."
          />
        </div>
      </div>
    </div>
  )
}
