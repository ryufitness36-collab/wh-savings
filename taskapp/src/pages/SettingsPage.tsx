// チーム・メンバー・招待・プロフィールなどの設定
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Copy, Download, KeyRound, Link2, LogOut, Shield, Trash2 } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { errorMessage, supabase } from '../lib/supabase'
import { useTheme, type Theme } from '../lib/theme'
import { formatDateTimeJP } from '../lib/date'
import { Avatar } from '../components/Badges'
import type { Invite } from '../lib/types'
import { joinWithToken } from './JoinPage'
import { exportJson, exportTasksCsv } from '../lib/export'
import { PasswordFields } from './ResetPasswordPage'

export function SettingsPage() {
  const { team } = useData()
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {team ? <TeamSection /> : <NoTeamSection />}
      <ProfileSection />
      <CategorySection />
      <AppearanceSection />
      <ExportSection />
      <AccountSection />
    </div>
  )
}

function Card({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-xs text-gray-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------
// チーム未参加: 招待リンクで参加 or チームを作成
// ---------------------------------------------------------------
function NoTeamSection() {
  const { reload } = useData()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function join() {
    setBusy(true)
    // 招待リンク全体を貼り付けても、トークン部分だけを取り出す
    const token = code.trim().split('/join/').pop()!.split(/[?#]/)[0]
    const r = await joinWithToken(token)
    setBusy(false)
    if (r.ok) {
      toast('チームに参加しました')
      reload()
    } else toast(r.message, 'error')
  }

  async function create() {
    setBusy(true)
    const { error } = await supabase.rpc('create_team', { p_name: name.trim() })
    setBusy(false)
    if (error) toast(errorMessage(error), 'error')
    else {
      toast('チームを作成しました。あなたが管理者です')
      reload()
    }
  }

  return (
    <>
      <Card title="招待リンクでチームに参加" desc="管理者から受け取った招待リンク（またはコード）を貼り付けてください。">
        <div className="flex gap-2">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="https://…/join/xxxxxxxx" />
          <button className="btn-primary shrink-0" onClick={join} disabled={busy || !code.trim()}>
            参加
          </button>
        </div>
      </Card>
      <Card title="チームを作成" desc="このアプリのチームは 1 つだけです。最初に作成した人が管理者になります。既にチームがある場合は招待リンクから参加してください。">
        <div className="flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="チーム名（例：〇〇店 運営チーム）" maxLength={50} />
          <button className="btn-secondary shrink-0" onClick={create} disabled={busy || !name.trim()}>
            作成
          </button>
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------
// チーム参加済み: チーム名・メンバー・招待
// ---------------------------------------------------------------
function TeamSection() {
  const { team, role, members, reload } = useData()
  const { userId } = useAuth()
  const toast = useToast()
  const isAdmin = role === 'admin'
  const [teamName, setTeamName] = useState(team!.name)

  async function rpc(fn: string, args: Record<string, unknown>, success: string) {
    const { error } = await supabase.rpc(fn, args)
    if (error) toast(errorMessage(error), 'error')
    else {
      toast(success)
      await reload()
    }
  }

  async function saveName() {
    const { error } = await supabase.from('teams').update({ name: teamName.trim() }).eq('id', team!.id)
    if (error) toast(errorMessage(error), 'error')
    else {
      toast('チーム名を変更しました')
      reload()
    }
  }

  return (
    <>
      <Card title="チーム" desc={isAdmin ? 'あなたはこのチームの管理者です。' : 'あなたはこのチームのメンバーです。'}>
        <div className="flex gap-2">
          <input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} disabled={!isAdmin} maxLength={50} />
          {isAdmin && (
            <button className="btn-secondary shrink-0" onClick={saveName} disabled={!teamName.trim() || teamName === team!.name}>
              保存
            </button>
          )}
        </div>
      </Card>

      <Card title={`メンバー（${members.length}人）`}>
        <ul className="divide-y divide-gray-100 dark:divide-white/5">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 py-2.5">
              <Avatar name={m.display_name} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.display_name}
                  {m.user_id === userId && <span className="ml-1 text-xs text-gray-400">（自分）</span>}
                </p>
                <p className="truncate text-xs text-gray-400">{m.email}</p>
              </div>
              {m.role === 'admin' ? (
                <span className="chip bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Shield size={11} />
                  管理者
                </span>
              ) : (
                <span className="chip bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">メンバー</span>
              )}
              {isAdmin && m.user_id !== userId && (
                <div className="flex gap-1">
                  <button
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() =>
                      rpc('set_member_role', { p_user_id: m.user_id, p_role: m.role === 'admin' ? 'member' : 'admin' }, '権限を変更しました')
                    }
                  >
                    {m.role === 'admin' ? 'メンバーにする' : '管理者にする'}
                  </button>
                  <button
                    className="btn-danger px-2 py-1 text-xs"
                    onClick={() => confirm(`${m.display_name} さんをチームから外しますか？担当タスクは「未割り当て」になります。`) && rpc('remove_member', { p_user_id: m.user_id }, 'メンバーを外しました')}
                  >
                    外す
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {!isAdmin && (
          <button
            className="btn-danger mt-3 text-xs"
            onClick={() => confirm('チームから退出しますか？チームタスクが見られなくなります。') && rpc('remove_member', { p_user_id: userId }, 'チームから退出しました')}
          >
            チームから退出する
          </button>
        )}
      </Card>

      {isAdmin && <InviteSection />}
    </>
  )
}

function InviteSection() {
  const toast = useToast()
  const [invites, setInvites] = useState<Invite[]>([])
  const [hours, setHours] = useState(72)
  const [maxUses, setMaxUses] = useState(1)
  const [link, setLink] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('team_invites').select('id, team_id, created_by, expires_at, max_uses, use_count, revoked_at, created_at').order('created_at', { ascending: false }).limit(20)
    setInvites((data as Invite[]) ?? [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function create() {
    const { data, error } = await supabase.rpc('create_invite', { p_expires_hours: hours, p_max_uses: maxUses })
    if (error) return toast(errorMessage(error), 'error')
    setLink(`${window.location.origin}/join/${data}`)
    load()
  }

  async function revoke(id: string) {
    const { error } = await supabase.rpc('revoke_invite', { p_invite_id: id })
    if (error) toast(errorMessage(error), 'error')
    else {
      toast('招待を取り消しました')
      load()
    }
  }

  function statusOf(i: Invite) {
    if (i.revoked_at) return { label: '取り消し済み', active: false }
    if (new Date(i.expires_at) < new Date()) return { label: '期限切れ', active: false }
    if (i.use_count >= i.max_uses) return { label: '使用済み', active: false }
    return { label: '有効', active: true }
  }

  return (
    <Card title="メンバーを招待" desc="招待リンクを発行して、参加してほしい人に送ってください。相手はログイン（または新規登録）後にリンクを開くと参加できます。">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">有効期限</label>
          <select className="input w-auto" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={24}>24時間</option>
            <option value={72}>3日間</option>
            <option value={168}>7日間</option>
          </select>
        </div>
        <div>
          <label className="label">利用できる人数</label>
          <select className="input w-auto" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))}>
            {[1, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{n}人まで</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={create}>
          <Link2 size={15} />
          招待リンクを発行
        </button>
      </div>

      {link && (
        <div className="mt-4 rounded-lg bg-indigo-50 p-3 dark:bg-indigo-500/10">
          <p className="mb-2 text-xs text-indigo-800 dark:text-indigo-200">
            このリンクは今だけ表示されます（安全のため、サーバーにはハッシュ化した値のみ保存しています）。
          </p>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button
              className="btn-secondary shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                toast('コピーしました')
              }}
            >
              <Copy size={14} />
              コピー
            </button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 text-sm dark:divide-white/5">
          {invites.map((i) => {
            const st = statusOf(i)
            return (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <span className={`chip ${st.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10'}`}>
                  {st.label}
                </span>
                <span className="flex-1 text-xs text-gray-500">
                  {formatDateTimeJP(i.created_at)} 発行 ・ 期限 {formatDateTimeJP(i.expires_at)} ・ {i.use_count}/{i.max_uses}人
                </span>
                {st.active && (
                  <button className="btn-danger px-2 py-1 text-xs" onClick={() => revoke(i.id)}>
                    取り消す
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------
function ProfileSection() {
  const { profile, reload } = useData()
  const toast = useToast()
  const [name, setName] = useState(profile?.display_name ?? '')

  async function save() {
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', profile!.id)
    if (error) toast(errorMessage(error), 'error')
    else {
      toast('表示名を変更しました')
      reload()
    }
  }

  return (
    <Card title="プロフィール" desc={profile?.email}>
      <label className="label">表示名（チームメンバーに表示されます）</label>
      <div className="flex gap-2">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        <button className="btn-secondary shrink-0" onClick={save} disabled={!name.trim() || name === profile?.display_name}>
          保存
        </button>
      </div>
    </Card>
  )
}

function CategorySection() {
  const { categories, reload } = useData()
  const toast = useToast()

  async function remove(id: string, name: string) {
    if (!confirm(`カテゴリー「${name}」を削除しますか？（タスクは削除されません）`)) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) toast(errorMessage(error), 'error')
    else reload()
  }

  return (
    <Card title="個人タスクのカテゴリー" desc="カテゴリーはタスクの編集画面から追加できます。">
      {categories.length === 0 ? (
        <p className="text-sm text-gray-400">カテゴリーはまだありません</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 py-1 pr-1 pl-2.5 text-sm dark:bg-white/10">
              {c.name}
              <button className="rounded p-1 text-gray-400 hover:text-red-500" onClick={() => remove(c.id, c.name)} aria-label={`${c.name}を削除`}>
                <Trash2 size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const options: [Theme, string][] = [
    ['light', 'ライト'],
    ['dark', 'ダーク'],
    ['system', '端末の設定に合わせる'],
  ]
  return (
    <Card title="表示">
      <div className="seg">
        {options.map(([v, l]) => (
          <button key={v} aria-pressed={theme === v} onClick={() => setTheme(v)}>
            {l}
          </button>
        ))}
      </div>
    </Card>
  )
}

function ExportSection() {
  const { tasks, members, projects, categories, team } = useData()
  const personal = tasks.filter((t) => t.scope === 'personal').length
  const teamCount = tasks.length - personal
  return (
    <Card
      title="データのエクスポート"
      desc={`あなたが閲覧できるタスク（個人 ${personal}件・チーム ${teamCount}件）を書き出します。他の人の個人タスクは含まれません。`}
    >
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => exportTasksCsv(tasks, members, projects, categories)} disabled={tasks.length === 0}>
          <Download size={15} />
          CSV（Excel 用）
        </button>
        <button
          className="btn-secondary"
          onClick={() => exportJson({ team, members, projects, categories, tasks })}
          disabled={tasks.length === 0}
        >
          <Download size={15} />
          JSON（バックアップ用）
        </button>
      </div>
    </Card>
  )
}

function AccountSection() {
  const { signOut } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) return toast('確認用のパスワードが一致しません', 'error')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return toast(errorMessage(error), 'error')
    toast('パスワードを変更しました')
    setPassword('')
    setConfirm('')
    setOpen(false)
  }

  return (
    <Card title="アカウント">
      {open ? (
        <form onSubmit={changePassword} className="mb-4 max-w-sm space-y-3">
          <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!password}>変更する</button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>やめる</button>
          </div>
        </form>
      ) : (
        <button className="btn-secondary mr-2 mb-2" onClick={() => setOpen(true)}>
          <KeyRound size={15} />
          パスワードを変更
        </button>
      )}
      <button className="btn-secondary" onClick={signOut}>
        <LogOut size={15} />
        ログアウト
      </button>
    </Card>
  )
}
