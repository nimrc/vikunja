import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {CheckIcon} from 'lucide-react'
import type {Task} from '@/client/generated'
import {AssigneeStack, DueBadge, LabelBadge, PriorityBadge, TaskMetaIcons} from '@/components/task/task-bits'
import {cssColor, parseDate} from '@/lib/format'
import {cn} from '@/lib/utils'

export function TaskCardBody({task, overlay}: {task: Task; overlay?: boolean}) {
	const cover = cssColor(task.hex_color)
	const labels = task.labels ?? []
	const hasFooter =
		!!task.assignees?.length ||
		(task.comment_count ?? 0) > 0 ||
		!!task.attachments?.length ||
		(task.priority ?? 0) >= 2 ||
		!!parseDate(task.due_date)
	return (
		<div
			className={cn(
				'group/card relative overflow-hidden rounded-lg border bg-card text-left text-sm shadow-xs transition-colors',
				'hover:border-foreground/20',
				overlay && 'rotate-2 cursor-grabbing border-foreground/20 shadow-lg',
				task.done && 'bg-card/60',
			)}
		>
			{cover && <div className="h-1.5 w-full" style={{background: cover}} />}
			<div className="flex flex-col gap-2 p-3">
				<div className="flex items-start gap-2">
					{task.done && (
						<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
							<CheckIcon className="size-3" />
						</span>
					)}
					<span
						className={cn(
							'min-w-0 flex-1 leading-snug font-medium break-words',
							task.done && 'text-muted-foreground line-through decoration-muted-foreground/50',
						)}
					>
						{task.title}
					</span>
					{task.is_unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
				</div>
				{labels.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{labels.map(l => (
							<LabelBadge key={l.id} label={l} />
						))}
					</div>
				)}
				{hasFooter && (
					<div className="flex items-center gap-3">
						<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
							{task.identifier && <span className="text-xs text-muted-foreground tabular-nums">{task.identifier}</span>}
							<DueBadge task={task} />
							<PriorityBadge priority={task.priority} done={task.done} />
							<TaskMetaIcons task={task} />
						</div>
						<AssigneeStack users={task.assignees} />
					</div>
				)}
				{!hasFooter && task.identifier && (
					<span className="text-xs text-muted-foreground tabular-nums">{task.identifier}</span>
				)}
			</div>
		</div>
	)
}

export function SortableTaskCard({
	task,
	bucketId,
	disabled,
	onOpen,
}: {
	task: Task
	bucketId: number
	disabled?: boolean
	onOpen: (id: number) => void
}) {
	const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
		id: `task-${task.id}`,
		data: {type: 'task', task, bucketId},
		disabled,
	})
	return (
		<div
			ref={setNodeRef}
			style={{transform: CSS.Translate.toString(transform), transition}}
			className={cn('touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring', isDragging && 'opacity-40')}
			{...attributes}
			{...listeners}
			role="button"
			aria-label={task.title}
			onClick={() => onOpen(task.id!)}
			onKeyDown={e => {
				// Space picks the card up (keyboard sensor); Enter opens it.
				if (e.key === 'Enter' && !isDragging) onOpen(task.id!)
				else listeners?.onKeyDown?.(e)
			}}
		>
			<TaskCardBody task={task} />
		</div>
	)
}
