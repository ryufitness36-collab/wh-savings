// ログイン・新規登録（メールアドレス + パスワード）
import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { errorMessage, isConfigured, supabase } from '../lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(errorMessage(error))
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin + window.location.pathname },
      })
      if (error) setError(errorMessage(error))
      else if (!data.session) setInfo('確認メールを送信しました。メール内のリンクを開いてから、ログインしてください。')
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 dark:bg-[#111113]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <CheckSquare size={22} />
          </span>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="text-sm text-gray-500">個人とチームのタスクをひとつに</p>
        </div>

        {!isConfigured && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            Supabase の接続設定がありません。<code>.env.local</code> に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。
          </p>
        )}

        <form onSubmit={submit} className="card space-y-4 p-6 shadow-sm">
          <div className="seg w-full" role="group">
            <button type="button" className="flex-1" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>
              ログイン
            </button>
            <button type="button" className="flex-1" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
              新規登録
            </button>
          </div>
          {mode === 'signup' && (
            <div>
              <label className="label" htmlFor="name">表示名</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：山田 花子" required maxLength={50} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">メールアドレス</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">パスワード（6文字以上）</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? '処理中…' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
          </button>
        </form>
      </div>
    </div>
  )
}
