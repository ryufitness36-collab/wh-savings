// 招待リンク（/join/:token）からチームに参加する画面
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { errorMessage, supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'

export function JoinPage() {
  const { token = '' } = useParams()
  const { team, reload } = useData()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (team) return <Navigate to="/team" replace />

  async function join() {
    setBusy(true)
    setError('')
    const result = await joinWithToken(token)
    if (result.ok) {
      await reload()
      navigate('/team', { replace: true })
    } else {
      setError(result.message)
    }
    setBusy(false)
  }

  return (
    <div className="card mx-auto mt-6 max-w-md p-8 text-center">
      <Users className="mx-auto mb-3 text-indigo-500" size={36} />
      <h2 className="text-lg font-semibold">チームへの招待</h2>
      <p className="mt-1 text-sm text-gray-500">このリンクからチームに参加します。参加すると、チームタスクを他のメンバーと共有できます（個人タスクは引き続きあなただけに表示されます）。</p>
      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button className="btn-primary mt-5 w-full py-2.5" onClick={join} disabled={busy || !token}>
        {busy ? '参加しています…' : 'チームに参加する'}
      </button>
    </div>
  )
}

/** 招待トークンを検証して参加する（検証はすべて DB 側の accept_invite 関数で行う） */
export async function joinWithToken(token: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token.trim() })
  if (error) return { ok: false, message: errorMessage(error) }
  if (!data) return { ok: false, message: '招待リンクが無効です（期限切れ・使用回数の上限・取り消し済みの可能性があります）。管理者に新しいリンクを依頼してください。' }
  return { ok: true, message: '' }
}
