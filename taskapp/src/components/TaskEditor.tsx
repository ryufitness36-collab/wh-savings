// タスクの追加・編集ダイアログ（アプリのどこからでも openEditor() で開けます）
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import type { Priority, Recurrence, Scope, Status, Task, TaskInput } from '../lib/types'
import { PRIORITY_LABEL, RECURRENCE_LABEL, STATUSES, STATUS_LABEL, taskPermission } from '../lib/tasks'
import { formatDateTimeJP, weekdayLabel } from '../lib/date'

interface EditorState {
  task: Task | null // null = 新規作成
  defaults?: TaskInput
}

const EditorContext = createContext<(task: Task | null, defaults?: TaskInput) => void>(() => {})
export const useTaskEditor = () => useContext(EditorContext)

export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState | null>(null)
  const open = useCallback((task: Task | null, defaults?: TaskInput) => setState({ task, defaults }), [])
  return (
    <EditorContext.Provider value={open}>
      {children}
      {state && <TaskEditor key={state.task?.id ?? 'new'} {...state} onClose={() => setState(null)} />}
    </EditorContext.Provider>
  )
}

interface FormState {
  scope: Scope
  title: string
  description: string
  status: Status
  priority: Priority | ''
  assignee_id: string
  project_id: string
  category_id: string
  scheduled_date: string
  due_date: string
  due_time: string
  target_month: string // 'YYYY-MM'
  recurrence: Recurrence
  recurrence_days: number[]
}

function toForm(t: Task | null, d: TaskInput | undefined, hasTeam: boolean): FormState {
  const src = { ...(t ?? {}), ...(t ? {} : d) } as Partial<Task>
  return {
    scope: src.scope ?? (hasTeam ? (d?.scope ?? 'personal') : 'personal'),
    title: src.title ?? '',
    description: src.description ?? '',
    status: src.status ?? 'todo',
    priority: src.priority ?? '',
    assignee_id: src.assignee_id ?? '',
    project_id: src.project_id ?? '',
    category_id: src.category_id ?? '',
    scheduled_date: src.scheduled_date ?? '',
    due_date: src.due_date ?? '',
    due_time: src.due_time ? src.due_time.slice(0, 5) : '',
    target_month: src.target_month ? src.target_month.slice(0, 7) : '',
    recurrence: src.recurrence ?? 'none',
    recurrence_days: src.recurrence_days ?? [],
  }
}

function TaskEditor({ task, defaults, onClose }: EditorState & { onClose: () => void }) {
  const { userId } = useAuth()
  const { team, role, members, projects, categories, createTask, updateTask, deleteTask, createCategory } = useData()
  const [form, setForm] = useState<FormState>(() => toForm(task, defaults, Boolean(team)))
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const perm = taskPermission(task, userId!, role)
  const isNew = !task
  const isTeam = form.scope === 'team'
  const fieldsDisabled = !perm.canEditFields

  // 新規チームタスク: 一般メンバーは自分を初期担当者に
  useEffect(() => {
    if (isNew && isTeam && !form.assignee_id && role !== 'admin') {
      setForm((f) => ({ ...f, assignee_id: userId ?? '' }))
    }
  }, [isTeam])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const assignable =
    perm.assignableIds === 'all' ? members : members.filter((m) => (perm.assignableIds as string[]).includes(m.user_id))
  const assigneeLocked = !isNew && perm.assignableIds !== 'all' && assignable.length === 0

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload: TaskInput = {
      title: form.title.trim(),
      description: form.description,
      status: form.status,
      priority: form.priority || null,
      scheduled_date: form.scheduled_date || null,
      due_date: form.due_date || null,
      due_time: form.due_date && form.due_time ? form.due_time : null,
      target_month: form.target_month ? `${form.target_month}-01` : null,
      recurrence: form.recurrence,
      recurrence_days: form.recurrence === 'weekdays' ? form.recurrence_days : null,
    }
    if (isTeam) {
      payload.project_id = form.project_id || null
      if (!assigneeLocked) payload.assignee_id = form.assignee_id || null
    } else {
      payload.category_id = form.category_id || null
    }

    let ok: boolean
    if (isNew) {
      payload.scope = form.scope
      if (isTeam) payload.team_id = team!.id
      ok = Boolean(await createTask(payload))
    } else if (!perm.canEditFields) {
      // 担当者のみの場合はステータス（と自分の担当の付け外し）だけを送る
      const limited: TaskInput = { status: form.status }
      if (perm.assignableIds !== 'all' && assignable.length > 0) limited.assignee_id = form.assignee_id || null
      ok = await updateTask(task.id, limited)
    } else {
      ok = await updateTask(task.id, payload)
    }
    setSaving(false)
    if (ok) onClose()
  }

  async function addCategory() {
    if (!newCategory.trim()) return
    const c = await createCategory(newCategory)
    if (c) {
      set('category_id', c.id)
      setNewCategory('')
    }
  }

  const footer = (
    <div className="flex items-center gap-2">
      {!isNew && perm.canDelete && (
        <button
          className="btn-danger"
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true)
            if (await deleteTask(task.id)) onClose()
          }}
        >
          <Trash2 size={16} />
          {confirmDelete ? '本当に削除する' : '削除'}
        </button>
      )}
      <div className="flex-1" />
      <button className="btn-secondary" onClick={onClose}>
        キャンセル
      </button>
      <button className="btn-primary" onClick={save} disabled={saving || !form.title.trim() || (!perm.canEditFields && !perm.canChangeStatus)}>
        {saving ? '保存中…' : isNew ? '追加' : '保存'}
      </button>
    </div>
  )

  return (
    <Modal open title={isNew ? 'タスクを追加' : 'タスクを編集'} onClose={onClose} footer={footer} wide>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {isNew && team && (
          <div className="seg" role="group" aria-label="区分">
            {(['personal', 'team'] as Scope[]).map((s) => (
              <button type="button" key={s} aria-pressed={form.scope === s} onClick={() => set('scope', s)}>
                {s === 'personal' ? '個人タスク（自分だけ）' : `チームタスク（${team.name}）`}
              </button>
            ))}
          </div>
        )}
        {!isNew && (
          <p className="text-xs text-gray-500">
            {task.scope === 'personal' ? '個人タスク（あなただけが閲覧できます）' : 'チームタスク（メンバー全員が閲覧できます）'}
            {' ・ '}作成者: {task.created_by === userId ? 'あなた' : (members.find((m) => m.user_id === task.created_by)?.display_name ?? '—')}
            {' ・ '}更新: {formatDateTimeJP(task.updated_at)}
          </p>
        )}
        {!isNew && fieldsDisabled && perm.canChangeStatus && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            あなたは担当者のため、ステータスのみ変更できます。その他の項目は作成者または管理者が編集できます。
          </p>
        )}

        <div>
          <label className="label" htmlFor="title">
            タスク名 <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            className="input text-base"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="例：セミナー資料を作成する"
            autoFocus={isNew}
            maxLength={200}
            disabled={fieldsDisabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="status">ステータス</label>
            <select id="status" className="input" value={form.status} onChange={(e) => set('status', e.target.value as Status)} disabled={!perm.canChangeStatus}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="priority">優先度</label>
            <select id="priority" className="input" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority | '')} disabled={fieldsDisabled}>
              <option value="">なし</option>
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </div>
          {isTeam ? (
            <div>
              <label className="label" htmlFor="assignee">担当者</label>
              <select
                id="assignee"
                className="input"
                value={form.assignee_id}
                onChange={(e) => set('assignee_id', e.target.value)}
                disabled={assigneeLocked}
              >
                <option value="">未割り当て</option>
                {(assigneeLocked ? members.filter((m) => m.user_id === form.assignee_id) : assignable).map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}{m.user_id === userId ? '（自分）' : ''}
                  </option>
                ))}
              </select>
              {role !== 'admin' && <p className="mt-1 text-[11px] text-gray-400">他の人への割り当ては管理者が行います</p>}
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="category">カテゴリー</label>
              <select id="category" className="input" value={form.category_id} onChange={(e) => set('category_id', e.target.value)} disabled={fieldsDisabled}>
                <option value="">なし</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!isTeam && !fieldsDisabled && (
          <div className="flex gap-2">
            <input className="input" placeholder="新しいカテゴリー名" value={newCategory} maxLength={30} onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }} />
            <button type="button" className="btn-secondary shrink-0" onClick={addCategory} disabled={!newCategory.trim()}>カテゴリー追加</button>
          </div>
        )}

        {isTeam && (
          <div>
            <label className="label" htmlFor="project">プロジェクト</label>
            <select id="project" className="input" value={form.project_id} onChange={(e) => set('project_id', e.target.value)} disabled={fieldsDisabled}>
              <option value="">プロジェクトなし</option>
              {projects.filter((p) => !p.archived || p.id === form.project_id).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="scheduled">実施予定日</label>
            <input id="scheduled" type="date" className="input" value={form.scheduled_date} onChange={(e) => set('scheduled_date', e.target.value)} disabled={fieldsDisabled} />
          </div>
          <div>
            <label className="label" htmlFor="due">締切日</label>
            <input id="due" type="date" className="input" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} disabled={fieldsDisabled} />
          </div>
          <div>
            <label className="label" htmlFor="dueTime">締切時刻（任意）</label>
            <input id="dueTime" type="time" className="input" value={form.due_time} onChange={(e) => set('due_time', e.target.value)} disabled={fieldsDisabled || !form.due_date} />
          </div>
          <div>
            <label className="label" htmlFor="month">対象月（〇月中）</label>
            <input id="month" type="month" className="input" value={form.target_month} onChange={(e) => set('target_month', e.target.value)} disabled={fieldsDisabled} />
          </div>
        </div>
        <p className="-mt-2 text-[11px] text-gray-400">
          日付のみの締切はその日の終わり（日本時間 23:59）まで有効です。日付が決まっていない場合は「対象月」だけ設定できます。
        </p>

        <div>
          <label className="label" htmlFor="recurrence">繰り返し</label>
          <select id="recurrence" className="input" value={form.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)} disabled={fieldsDisabled}>
            {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
              <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>
            ))}
          </select>
          {form.recurrence === 'weekdays' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = form.recurrence_days.includes(d)
                return (
                  <button
                    type="button"
                    key={d}
                    disabled={fieldsDisabled}
                    onClick={() => set('recurrence_days', on ? form.recurrence_days.filter((x) => x !== d) : [...form.recurrence_days, d])}
                    className={`h-9 w-9 rounded-full text-sm ${on ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}
                  >
                    {weekdayLabel(d)}
                  </button>
                )
              })}
            </div>
          )}
          {form.recurrence !== 'none' && (
            <p className="mt-1 text-[11px] text-gray-400">完了にすると、次回分のタスクが自動で作成されます。</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="desc">詳細メモ</label>
          <textarea id="desc" className="input min-h-24" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="メモ・手順・リンクなど" disabled={fieldsDisabled} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
