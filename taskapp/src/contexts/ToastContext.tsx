import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type ToastKind = 'info' | 'error'
interface Toast {
  id: number
  kind: ToastKind
  text: string
}

const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { id, kind, text }])
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg ${
              t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
