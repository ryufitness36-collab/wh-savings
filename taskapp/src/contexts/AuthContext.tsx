import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthValue {
  session: Session | null
  userId: string | null
  loading: boolean
  /** パスワード再設定メールのリンクから開いたとき true（新しいパスワードの入力画面を出す） */
  recovery: boolean
  finishRecovery: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // メールのリンクの URL に type=recovery が含まれていれば再設定モード（イベントの取りこぼし対策）
  const [recovery, setRecovery] = useState(() => /type=recovery/.test(window.location.hash + window.location.search))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value: AuthValue = {
    session,
    userId: session?.user.id ?? null,
    loading,
    recovery,
    finishRecovery: () => setRecovery(false),
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth は AuthProvider の中で使ってください')
  return ctx
}
