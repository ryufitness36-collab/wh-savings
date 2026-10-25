// カンバン表示（Trello 風）。カードをドラッグ＆ドロップしてステータスを変更できます
import { useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import type { Status, Task, TaskInput } from '../lib/types'
import { STATUSES, STATUS_LABEL, taskPermission } from '../lib/tasks'
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
}

export function KanbanBoard({ tasks, showScope, showAssignee, newTaskDefaults }: Props) {
  const { updateTask, role } = useData()
  const { userId } = useAuth()
  const toast = useToast()
  const openEditor = useTaskEditor()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mobileCol, setMobileCol] = useState<Status>('todo')
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

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    lastDragEnd.current = Date.now()
    const task = tasks.find((t) => t.id === e.active.id)
    const to = e.over?.id as Status | undefined
    if (!task || !to || task.status === to) return
    if (!taskPermission(task, userId!, role).canChangeStatus) {
      toast('このタスクのステータスは担当者・作成者・管理者のみ変更できます', 'error')
      return
    }
    updateTask(task.id, { status: to })
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

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="thin-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {STATUSES.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={tasks.filter((t) => t.status === s)}
              showScope={showScope}
              showAssignee={showAssignee}
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
  onAdd,
  onOpen,
}: {
  status: Status
  tasks: Task[]
  showScope?: boolean
  showAssignee?: boolean
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
          <DraggableCard key={t.id} task={t} showScope={showScope} showAssignee={showAssignee} onOpen={() => onOpen(t)} />
        ))}
        {tasks.length === 0 && <p className="py-6 text-center text-xs text-gray-400">ここにドラッグ</p>}
      </div>
    </section>
  )
}

function DraggableCard({ task, showScope, showAssignee, onOpen }: { task: Task; showScope?: boolean; showAssignee?: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen} className={`touch-manipulation ${isDragging ? 'opacity-30' : ''}`}>
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
