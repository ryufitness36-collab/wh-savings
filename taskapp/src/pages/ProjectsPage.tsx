// プロジェクト: チーム内の大きな仕事をまとめて管理（作成・編集は管理者のみ）
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Pencil, Plus } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { errorMessage, supabase } from '../lib/supabase'
import { Modal } from '../components/Modal'
import { AssigneeLabel, ProgressBar } from '../components/Badges'
import { completionRate } from '../lib/tasks'
import { formatDateJP } from '../lib/date'
import type { Project } from '../lib/types'

export function ProjectsPage() {
  const { projects, tasks, members, role, team } = useData()
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const isAdmin = role === 'admin'

  if (!team) {
    return <p className="py-10 text-center text-sm text-gray-500">チームに参加すると、プロジェクトを利用できます。</p>
  }

  const teamTasks = tasks.filter((t) => t.scope === 'team')
  const noProject = completionRate(teamTasks.filter((t) => !t.project_id))

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{isAdmin ? 'プロジェクトを作成して、チームタスクを分類できます。' : 'プロジェクトの作成・編集は管理者が行います。'}</p>
        {isAdmin && (
          <button className="btn-primary shrink-0" onClick={() => setEditing('new')}>
            <Plus size={16} />
            プロジェクト
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const r = completionRate(teamTasks.filter((t) => t.project_id === p.id))
          return (
            <article key={p.id} className={`card flex flex-col p-4 ${p.archived ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                <FolderKanban size={18} className="mt-0.5 text-indigo-500" />
                <h3 className="flex-1 font-semibold">{p.name}</h3>
                {isAdmin && (
                  <button className="btn-ghost -mt-1 -mr-1 p-1.5" onClick={() => setEditing(p)} aria-label="編集">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              {p.description && <p className="mt-1.5 line-clamp-3 text-sm text-gray-500">{p.description}</p>}
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                <p>
                  期間: {p.start_date ? formatDateJP(p.start_date) : '未定'} 〜 {p.due_date ? formatDateJP(p.due_date) : '未定'}
                </p>
                <div className="flex items-center gap-1.5">
                  担当: <AssigneeLabel members={members} id={p.owner_id} />
                </div>
              </div>
              <div className="mt-auto pt-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-500">全体進捗</span>
                  <span className="tabular-nums">{r.done}/{r.total}件 ・ {r.rate}%</span>
                </div>
                <ProgressBar rate={r.rate} />
                <Link to={`/team?project=${p.id}`} className="mt-3 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                  関連タスクを見る →
                </Link>
              </div>
            </article>
          )
        })}
        <article className="card flex flex-col border-dashed p-4">
          <h3 className="font-semibold text-gray-500">プロジェクトなし</h3>
          <p className="mt-1 text-xs text-gray-400">どのプロジェクトにも属さないチームタスク</p>
          <div className="mt-auto pt-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-gray-500">進捗</span>
              <span className="tabular-nums">{noProject.done}/{noProject.total}件 ・ {noProject.rate}%</span>
            </div>
            <ProgressBar rate={noProject.rate} />
            <Link to="/team?project=none" className="mt-3 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              タスクを見る →
            </Link>
          </div>
        </article>
      </div>

      {editing && <ProjectEditor project={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ProjectEditor({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { team, members, reload } = useData()
  const { userId } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    start_date: project?.start_date ?? '',
    due_date: project?.due_date ?? '',
    owner_id: project?.owner_id ?? '',
    archived: project?.archived ?? false,
  })

  async function save() {
    const payload = {
      name: f.name.trim(),
      description: f.description,
      start_date: f.start_date || null,
      due_date: f.due_date || null,
      owner_id: f.owner_id || null,
      archived: f.archived,
    }
    const { error } = project
      ? await supabase.from('projects').update(payload).eq('id', project.id)
      : await supabase.from('projects').insert({ ...payload, team_id: team!.id, created_by: userId })
    if (error) return toast(errorMessage(error), 'error')
    await reload()
    onClose()
  }

  async function remove() {
    if (!project || !confirm(`プロジェクト「${project.name}」を削除しますか？関連タスクは「プロジェクトなし」になります。`)) return
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (error) return toast(errorMessage(error), 'error')
    await reload()
    onClose()
  }

  return (
    <Modal
      open
      title={project ? 'プロジェクトを編集' : 'プロジェクトを作成'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {project && <button className="btn-danger" onClick={remove}>削除</button>}
          <div className="flex-1" />
          <button className="btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" onClick={save} disabled={!f.name.trim()}>保存</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">プロジェクト名 *</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="例：年末セール準備" maxLength={100} autoFocus />
        </div>
        <div>
          <label className="label">説明</label>
          <textarea className="input min-h-20" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">開始日</label>
            <input type="date" className="input" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
          </div>
          <div>
            <label className="label">期限</label>
            <input type="date" className="input" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">担当者</label>
          <select className="input" value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })}>
            <option value="">未設定</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
            ))}
          </select>
        </div>
        {project && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} />
            完了したプロジェクトとしてアーカイブ
          </label>
        )}
      </div>
    </Modal>
  )
}
