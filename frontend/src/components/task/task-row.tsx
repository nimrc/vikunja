import {forwardRef, type HTMLAttributes, type ReactNode} from 'react'
import {Link} from 'react-router'
import type {Project, Task} from '@/client/generated'
import {Checkbox} from '@/components/ui/checkbox'
import {ColorDot} from '@/components/color-picker'
import {AssigneeStack, DueBadge, LabelBadge, PriorityBadge, TaskMetaIcons, useToggleDone} from '@/components/task/task-bits'
import {projectHref} from '@/components/app-sidebar'
import {useOpenTask} from '@/lib/navigation'
import {cn} from '@/lib/utils'

type Props = {
	task: Task
	project?: Project
	showProject?: boolean
	canWrite?: boolean
	handle?: ReactNode
	depth?: number
} & HTMLAttributes<HTMLDivElement>

export const TaskRow = forwardRef<HTMLDivElement, Props>(function TaskRow(
	{task, project, showProject, canWrite = true, handle, depth = 0, className, ...rest},
	ref,
) {
	const toggleDone = useToggleDone()
	const openTask = useOpenTask()

	return (
		<div
			ref={ref}
			{...rest}
			className={cn(
				'group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60',
				className,
			)}
			style={{paddingLeft: 12 + depth * 28, ...rest.style}}
		>
			{handle}
			<span className="mt-0.5">
				<Checkbox
					label={task.done ? 'Mark as not done' : 'Mark as done'}
					hideLabel
					checked={!!task.done}
					disabled={!canWrite}
					onCheckedChange={v => toggleDone(task, v)}
				/>
			</span>
			<button
				type="button"
				onClick={() => openTask(task.id!)}
				className="flex min-w-0 flex-1 flex-col gap-1 text-left outline-none"
			>
				<span className="flex min-w-0 items-baseline gap-2">
					<span className={cn('truncate text-sm', task.done && 'text-muted-foreground line-through')}>{task.title}</span>
					{task.identifier && (
						<span className="hidden shrink-0 text-xs text-muted-foreground/70 sm:inline">{task.identifier}</span>
					)}
				</span>
				{(task.labels?.length || task.due_date || (task.priority ?? 0) >= 2 || task.comment_count || showProject) && (
					<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
						{showProject && project && (
							<Link
								to={projectHref(project)}
								onClick={e => e.stopPropagation()}
								className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
							>
								<ColorDot color={project.hex_color} className="size-2" />
								{project.title}
							</Link>
						)}
						<DueBadge task={task} />
						<PriorityBadge priority={task.priority} done={task.done} />
						{task.labels?.map(l => (
							<LabelBadge key={l.id} label={l} />
						))}
						<TaskMetaIcons task={task} />
					</span>
				)}
			</button>
			<AssigneeStack users={task.assignees} />
		</div>
	)
})
