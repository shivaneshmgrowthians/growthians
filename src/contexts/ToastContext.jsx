import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
    setTimeout(() => setToast(null), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 text-sm font-medium shadow-2xl z-[100] animate-slide-up ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-black text-white'
          }`}
          style={{ animation: 'slideUp 0.3s ease-out' }}
        >
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }
      `}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
