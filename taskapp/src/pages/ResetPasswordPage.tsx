// 新しいパスワードの設定
// 再設定メールのリンクを開いたとき（＝一時的にログインした状態）に表示されます
import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { errorMessage, supabase } from '../lib/supabase'

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) return setError('確認用のパスワードが一致しません')
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    // URL に残った再設定用の情報を消してからアプリへ
    window.history.replaceState(null, '', '/')
    onDone()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 dark:bg-[#111113]">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <KeyRound size={22} />
          </span>
          <h1 className="text-base font-semibold">新しいパスワードを設定</h1>
          <p className="text-xs text-gray-500">設定後、そのままアプリを使えます。</p>
        </div>
        <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={busy || !password}>
          {busy ? '保存中…' : 'パスワードを変更する'}
        </button>
      </form>
    </div>
  )
}

/** 新しいパスワード + 確認用の入力欄（設定画面のパスワード変更でも使う） */
export function PasswordFields({
  password,
  setPassword,
  confirm,
  setConfirm,
}: {
  password: string
  setPassword: (v: string) => void
  confirm: string
  setConfirm: (v: string) => void
}) {
  return (
    <>
      <div>
        <label className="label" htmlFor="new-password">新しいパスワード（6文字以上）</label>
        <input id="new-password" type="password" className="input" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">確認のためもう一度入力</label>
        <input id="confirm-password" type="password" className="input" autoComplete="new-password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
    </>
  )
}
