// カンバン表示（Trello 風）
// カードをドラッグ＆ドロップして、ステータスの変更（列の移動）と、列の中での並べ替えができます
import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import type { Status, Task, TaskInput } from '../lib/types'
import { STATUSES, STATUS_LABEL, taskPermission, type SortKey } from '../lib/tasks'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { AssigneeLabel, DueLabel, PriorityBadge, RecurrenceIcon, ScopeBadge, STATUS_DOT } from './Badges'
import { useTaskEditor } from './TaskEditor'

interface Props {
  tasks: Task[]
  showScope?: boolean
  showAssignee?: boolean
  /** 列の「＋」から追加するときの初期値 */
  newTaskDefaults?: TaskInput
  /** 今の並べ替え。カードを並べ替えると「手動」に切り替える */
  sort: SortKey
  onSortChange: (s: SortKey) => void
}

/** ドロップ位置の目印（どのカードの上 or 下に入るか） */
interface DropHint {
  taskId: string
  after: boolean
}

const CARD = 'card:'

// 指の位置にあるカードを優先し、なければ列、どちらもなければ重なりで判定
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const card = hits.find((h) => String(h.id).startsWith(CARD))
  if (card) return [card]
  if (hits.length) return hits
  return rectIntersection(args)
}

export function KanbanBoard({ tasks, showScope, showAssignee, newTaskDefaults, sort, onSortChange }: Props) {
  const { updateTask, reorderTasks, role } = useData()
  const { userId } = useAuth()
  const toast = useToast()
  const openEditor = useTaskEditor()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobileCol, setMobileCol] = useState<Status>('todo')
  const [hint, setHint] = useState<DropHint | null>(null)
  // ドラッグ直後のクリックで編集画面が開かないようにする
  const lastDragEnd = useRef(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // スマホではスクロールと区別するため、少し長押ししてからドラッグ開始
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const activeTask = tasks.find((t) => t.id === activeId) ?? null

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  /** ドロップ先を「どの列の何番目か」に変換する */
  function dropTarget(e: DragOverEvent | DragEndEvent): { status: Status; overTaskId: string | null; after: boolean } | null {
    const over = e.over
    if (!over) return null
    const id = String(over.id)
    if (!id.startsWith(CARD)) return { status: id as Status, overTaskId: null, after: true }
    const overTask = tasks.find((t) => t.id === id.slice(CARD.length))
    if (!overTask || overTask.id === e.active.id) return null
    // ドラッグ中のカードの中心が、相手のカードの中心より下なら「後ろ」に入れる
    const a = e.active.rect.current.translated
    const after = a ? a.top + a.height / 2 > over.rect.top + over.rect.height / 2 : true
    return { status: overTask.status, overTaskId: overTask.id, after }
  }

  function onDragOver(e: DragOverEvent) {
    const t = dropTarget(e)
    setHint(t?.overTaskId ? { taskId: t.overTaskId, after: t.after } : null)
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    setHint(null)
    lastDragEnd.current = Date.now()
    const task = tasks.find((t) => t.id === e.active.id)
    const target = dropTarget(e)
    if (!task || !target) return
    // 同じ列の空いている所に落としただけなら何もしない
    if (!target.overTaskId && target.status === task.status) return
    if (!taskPermission(task, userId!, role).canChangeStatus) {
      toast('このタスクは担当者・作成者・管理者のみ動かせます', 'error')
      return
    }

    // 列の移動 = ステータス変更
    if (target.status !== task.status) {
      const ok = await updateTask(task.id, { status: target.status })
      if (!ok) return
    }

    // 列の中の位置を決めて、その列の並び順をまとめて保存
    if (target.overTaskId) {
      const column = tasks.filter((t) => t.status === target.status && t.id !== task.id)
      const index = column.findIndex((t) => t.id === target.overTaskId) + (target.after ? 1 : 0)
      const ids = column.map((t) => t.id)
      ids.splice(index, 0, task.id)
      const ok = await reorderTasks(ids)
      if (ok && sort !== 'manual') {
        onSortChange('manual')
        toast('並べ替えを「手動（ドラッグ順）」に切り替えました')
      }
    }
  }

  return (
    <div>
      {/* スマホ用: 列の切り替えタブ（横スクロールでも移動できます） */}
      <div className="thin-scroll mb-3 flex gap-1 overflow-x-auto md:hidden">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setMobileCol(s)
              document.getElementById(`col-${s}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
            }}
            className={`btn shrink-0 px-3 py-1.5 text-xs ${mobileCol === s ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'}`}
          >
            {STATUS_LABEL[s]} {tasks.filter((t) => t.status === s).length}
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setHint(null)
        }}
      >
        <div className="thin-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {STATUSES.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={tasks.filter((t) => t.status === s)}
              showScope={showScope}
              showAssignee={showAssignee}
              hint={hint}
              onAdd={() => openEditor(null, { ...newTaskDefaults, status: s })}
              onOpen={(t) => Date.now() - lastDragEnd.current > 300 && openEditor(t)}
            />
          ))}
        </div>
        <DragOverlay>{activeTask && <Card task={activeTask} showScope={showScope} showAssignee={showAssignee} dragging />}</DragOverlay>
      </DndContext>
    </div>
  )
}

function Column({
  status,
  tasks,
  showScope,
  showAssignee,
  hint,
  onAdd,
  onOpen,
}: {
  status: Status
  tasks: Task[]
  showScope?: boolean
  showAssignee?: boolean
  hint: DropHint | null
  onAdd: () => void
  onOpen: (t: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      id={`col-${status}`}
      ref={setNodeRef}
      className={`flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col rounded-xl bg-gray-50 p-2 transition-colors md:w-auto md:max-w-none dark:bg-white/[0.03] ${
        isOver ? 'ring-2 ring-indigo-400/60' : ''
      }`}
    >
      <header className="flex items-center justify-between px-1.5 py-1.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_LABEL[status]}
          <span className="text-xs font-normal text-gray-400">{tasks.length}</span>
        </div>
        <button className="btn-ghost p-1" onClick={onAdd} aria-label={`${STATUS_LABEL[status]}にタスクを追加`}>
          <Plus size={16} />
        </button>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {tasks.map((t) => (
          <DraggableCard
            key={t.id}
            task={t}
            showScope={showScope}
            showAssignee={showAssignee}
            hint={hint?.taskId === t.id ? (hint.after ? 'after' : 'before') : null}
            onOpen={() => onOpen(t)}
          />
        ))}
        {tasks.length === 0 && <p className="py-6 text-center text-xs text-gray-400">ここにドラッグ</p>}
      </div>
    </section>
  )
}

function DraggableCard({
  task,
  showScope,
  showAssignee,
  hint,
  onOpen,
}: {
  task: Task
  showScope?: boolean
  showAssignee?: boolean
  hint: 'before' | 'after' | null
  onOpen: () => void
}) {
  // 1 枚のカードが「動かせるもの」と「他のカードを落とせる場所」の両方を兼ねる
  const drag = useDraggable({ id: task.id })
  const drop = useDroppable({ id: CARD + task.id })
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el)
        drop.setNodeRef(el)
      }}
      {...drag.attributes}
      {...drag.listeners}
      onClick={onOpen}
      className={`relative touch-manipulation ${drag.isDragging ? 'opacity-30' : ''}`}
    >
      {/* 落とす位置の目印（青い線） */}
      {hint && (
        <span className={`absolute inset-x-1 z-10 h-0.5 rounded-full bg-indigo-500 ${hint === 'before' ? '-top-[5px]' : '-bottom-[5px]'}`} />
      )}
      <Card task={task} showScope={showScope} showAssignee={showAssignee} />
    </div>
  )
}

function Card({ task, showScope, showAssignee, dragging }: { task: Task; showScope?: boolean; showAssignee?: boolean; dragging?: boolean }) {
  const { members } = useData()
  const done = task.status === 'done'
  return (
    <article
      className={`card cursor-grab p-3 shadow-sm hover:border-gray-300 active:cursor-grabbing dark:hover:border-white/20 ${
        dragging ? 'rotate-1 shadow-xl' : ''
      }`}
    >
      <div className="flex items-start gap-1.5">
        <p className={`flex-1 text-sm leading-snug ${done ? 'text-gray-400 line-through' : ''}`}>{task.title}</p>
        <RecurrenceIcon task={task} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {showScope && <ScopeBadge scope={task.scope} />}
        <PriorityBadge priority={task.priority} />
        <DueLabel task={task} />
      </div>
      {showAssignee && task.scope === 'team' && (
        <div className="mt-2">
          <AssigneeLabel members={members} id={task.assignee_id} />
        </div>
      )}
    </article>
  )
}
