import { X } from 'lucide-react'

export function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-black text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      {label && (
        <label className="block text-[10px] uppercase tracking-widest text-black/60 mb-1.5 font-semibold">
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <Field label={label}>
      <input
        className="w-full px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none transition-colors"
        {...props}
      />
    </Field>
  )
}

export function Textarea({ label, ...props }) {
  return (
    <Field label={label}>
      <textarea
        className="w-full px-3 py-2.5 border border-black/15 focus:border-black focus:outline-none transition-colors resize-none"
        {...props}
      />
    </Field>
  )
}

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
      <div>
        {eyebrow && (
          <div className="text-xs uppercase tracking-widest text-black/50 mb-2 font-semibold">
            {eyebrow}
          </div>
        )}
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-black/60 mt-2 text-sm max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-[#C5F542] text-black',
    rejected: 'bg-red-100 text-red-700',
    submitted: 'bg-black text-white',
    draft: 'bg-gray-100 text-gray-700',
  }
  return (
    <span
      className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 ${
        styles[status] || styles.pending
      }`}
    >
      {status}
    </span>
  )
}

export function EmptyState({ message, icon: Icon }) {
  return (
    <div className="bg-white border border-black/10 p-12 text-center">
      {Icon && <Icon className="w-10 h-10 text-black/20 mx-auto mb-3" strokeWidth={1.5} />}
      <div className="text-black/40 text-sm">{message}</div>
    </div>
  )
}

export function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-2 border-black/20 border-t-[#C5F542] rounded-full animate-spin"></div>
        <div className="text-xs uppercase tracking-widest text-black/50 mt-4 font-semibold">{label}</div>
      </div>
    </div>
  )
}

export function Button({ variant = 'primary', children, className = '', ...props }) {
  const variants = {
    primary: 'bg-[#C5F542] hover:bg-[#B8E83A] text-black font-semibold',
    dark: 'bg-black hover:bg-black/80 text-white',
    outline: 'bg-white text-black border border-black/15 hover:border-black',
    danger: 'bg-white text-red-700 border border-red-300 hover:bg-red-50',
    success: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    ghost: 'text-black/60 hover:text-black',
  }
  return (
    <button
      className={`px-5 py-2.5 text-sm transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
