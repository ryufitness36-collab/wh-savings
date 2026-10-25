import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** PC では中央のダイアログ、スマホでは下から出るシート */
export function Modal({ open, title, onClose, children, footer, wide }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl md:rounded-2xl dark:bg-[#1a1a1d] ${
          wide ? 'md:max-w-2xl' : 'md:max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-white/10">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn-ghost -mr-2 p-1.5" onClick={onClose} aria-label="閉じる">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe border-t border-gray-100 px-5 py-3 dark:border-white/10">{footer}</div>}
      </div>
    </div>
  )
}
