// 1 行入力でタスクを素早く追加するフォーム（Enter で追加）
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import type { Scope, TaskInput } from '../lib/types'

interface Props {
  defaults?: TaskInput
  /** 個人/チームの切り替えを表示するか */
  allowScopeSwitch?: boolean
  placeholder?: string
}

export function QuickAdd({ defaults, allowScopeSwitch, placeholder = 'タスクを入力して Enter で追加' }: Props) {
  const { createTask, team } = useData()
  const { userId } = useAuth()
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState<Scope>(defaults?.scope ?? 'personal')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!title.trim() || busy) return
    setBusy(true)
    const input: TaskInput = { ...defaults, scope, title: title.trim() }
    if (scope === 'team') {
      input.team_id = team!.id
      // クイック追加したチームタスクは自分の担当にする（他の人への割り当ては編集画面から）
      input.assignee_id = userId
    }
    const ok = await createTask(input)
    setBusy(false)
    if (ok) setTitle('')
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
        <Plus size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" />
        <input className="input py-2.5 pl-9" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} maxLength={200} />
      </div>
      {allowScopeSwitch && team && (
        <div className="seg shrink-0" role="group" aria-label="区分">
          <button type="button" aria-pressed={scope === 'personal'} onClick={() => setScope('personal')}>
            個人
          </button>
          <button type="button" aria-pressed={scope === 'team'} onClick={() => setScope('team')}>
            チーム
          </button>
        </div>
      )}
      <button className="btn-primary ml-auto shrink-0 sm:ml-0" disabled={!title.trim() || busy}>
        追加
      </button>
    </form>
  )
}
