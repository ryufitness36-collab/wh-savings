// タスクのコメントと更新履歴（編集ダイアログの下部に表示）
import { useCallback, useEffect, useState } from 'react'
import { History, MessageSquare, Send, Trash2 } from 'lucide-react'
import { errorMessage, supabase } from '../lib/supabase'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { Task, TaskComment, TaskHistory } from '../lib/types'
import { PRIORITY_LABEL, RECURRENCE_LABEL, STATUS_LABEL } from '../lib/tasks'
import { formatDateJP, formatDateTimeJP, formatMonthJP } from '../lib/date'
import { Avatar } from './Badges'

type Tab = 'comments' | 'history'

export function TaskActivity({ task }: { task: Task }) {
  const { members, role, projects, categories, profile } = useData()
  const { userId } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('comments')
  const [comments, setComments] = useState<TaskComment[]>([])
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    const [c, h] = await Promise.all([
      supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at'),
      supabase.from('task_history').select('*').eq('task_id', task.id).order('created_at', { ascending: false }).limit(50),
    ])
    setComments((c.data as TaskComment[]) ?? [])
    setHistory((h.data as TaskHistory[]) ?? [])
  }, [task.id])

  // タスクが更新されたら（updated_at が変わったら）履歴も取り直す
  useEffect(() => {
    load()
  }, [load, task.updated_at])

  async function send() {
    if (!body.trim()) return
    setSending(true)
    const { error } = await supabase.from('task_comments').insert({ task_id: task.id, body: body.trim() })
    setSending(false)
    if (error) return toast(errorMessage(error), 'error')
    setBody('')
    load()
  }

  async function remove(id: string) {
    if (!confirm('このコメントを削除しますか？')) return
    const { error } = await supabase.from('task_comments').delete().eq('id', id)
    if (error) return toast(errorMessage(error), 'error')
    load()
  }

  // 名前の表示（個人タスクではメンバー一覧が無いので自分のプロフィールを使う）
  const nameOf = (id: string | null) =>
    id === userId ? (profile?.display_name ?? 'あなた') : (members.find((m) => m.user_id === id)?.display_name ?? '（退出したメンバー）')

  const canDelete = (c: TaskComment) => c.author_id === userId || (task.scope === 'team' && role === 'admin')

  return (
    <div className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <div className="seg mb-3" role="group" aria-label="コメントと履歴">
        <button type="button" aria-pressed={tab === 'comments'} onClick={() => setTab('comments')} className="flex items-center gap-1">
          <MessageSquare size={13} />
          コメント {comments.length > 0 && comments.length}
        </button>
        <button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')} className="flex items-center gap-1">
          <History size={13} />
          更新履歴
        </button>
      </div>

      {tab === 'comments' ? (
        <div>
          {comments.length === 0 && <p className="py-3 text-center text-xs text-gray-400">まだコメントはありません</p>}
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Avatar name={nameOf(c.author_id)} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{nameOf(c.author_id)}</span>
                    <span className="text-gray-400">{formatDateTimeJP(c.created_at)}</span>
                    {canDelete(c) && (
                      <button type="button" className="ml-auto text-gray-300 hover:text-red-500" onClick={() => remove(c.id)} aria-label="コメントを削除">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              className="input min-h-10 resize-none"
              rows={2}
              value={body}
              maxLength={2000}
              onChange={(e) => setBody(e.target.value)}
              placeholder={task.scope === 'team' ? 'コメントを書く（担当者と作成者に通知されます）' : 'メモとしてコメントを残す'}
              onKeyDown={(e) => {
                // Ctrl(⌘) + Enter で送信
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <button type="button" className="btn-primary shrink-0" onClick={send} disabled={sending || !body.trim()} aria-label="コメントを送信">
              <Send size={15} />
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {history.length === 0 && <p className="py-3 text-center text-xs text-gray-400">履歴はありません</p>}
          {history.map((h) => (
            <li key={h.id} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">{nameOf(h.actor_id)}</span>
                <span className="text-gray-400">{formatDateTimeJP(h.created_at)}</span>
              </div>
              {h.action === 'created' ? (
                <p className="mt-0.5 text-gray-500">タスクを作成しました</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5 text-gray-500">
                  {Object.entries(h.changes).map(([field, v]) => (
                    <li key={field}>{describeChange(field, v.from, v.to, projects, categories, nameOf)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const FIELD_LABEL: Record<string, string> = {
  title: 'タスク名',
  description: '詳細メモ',
  status: 'ステータス',
  priority: '優先度',
  assignee_id: '担当者',
  project_id: 'プロジェクト',
  category_id: 'カテゴリー',
  scheduled_date: '実施予定日',
  due_date: '締切日',
  due_time: '締切時刻',
  target_month: '対象月',
  recurrence: '繰り返し',
}

/** 履歴の 1 項目を「ステータス: 未着手 → 進行中」のような文章にする */
function describeChange(
  field: string,
  from: unknown,
  to: unknown,
  projects: { id: string; name: string }[],
  categories: { id: string; name: string }[],
  nameOf: (id: string | null) => string,
): string {
  const label = FIELD_LABEL[field] ?? field
  if (field === 'description') return `${label}を変更`
  const fmt = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return 'なし'
    const s = String(v)
    switch (field) {
      case 'status':
        return STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s
      case 'priority':
        return PRIORITY_LABEL[s as keyof typeof PRIORITY_LABEL] ?? s
      case 'recurrence':
        return RECURRENCE_LABEL[s as keyof typeof RECURRENCE_LABEL] ?? s
      case 'assignee_id':
        return nameOf(s)
      case 'project_id':
        return projects.find((p) => p.id === s)?.name ?? '（削除済み）'
      case 'category_id':
        return categories.find((c) => c.id === s)?.name ?? '（削除済み）'
      case 'scheduled_date':
      case 'due_date':
        return formatDateJP(s)
      case 'target_month':
        return formatMonthJP(s)
      case 'due_time':
        return s.slice(0, 5)
      default:
        return s
    }
  }
  return `${label}: ${fmt(from)} → ${fmt(to)}`
}
