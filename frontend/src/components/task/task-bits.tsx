import {useMutation} from '@tanstack/react-query'
import {CalendarIcon, FlagIcon, MessageSquareIcon, PaperclipIcon, RepeatIcon} from 'lucide-react'
import {toast} from 'sonner'
import {tasksUpdate, type Label, type Task, type User} from '@/client/generated'
import {Avatar} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Tooltip} from '@/components/ui/tooltip'
import {cn} from '@/lib/utils'
import {contrastText, cssColor, displayName, formatDue, isOverdue, parseDate, priorityLabel} from '@/lib/format'
import {useAvatarSrc} from '@/lib/avatar'
import {invalidateTasks, keys, patchCachedTask, queryClient} from '@/lib/queries'

export function LabelBadge({label, className}: {label: Label; className?: string}) {
	const bg = cssColor(label.hex_color)
	return (
		<Badge
			tone="neutral"
			className={cn('h-5 rounded-md px-1.5 text-[11px] font-medium', className)}
			style={bg ? {background: bg, color: contrastText(label.hex_color)} : undefined}
		>
			{label.title}
		</Badge>
	)
}

const PRIORITY_STYLE: Record<number, string> = {
	2: 'text-sky-600 dark:text-sky-400',
	3: 'text-amber-600 dark:text-amber-400',
	4: 'text-orange-600 dark:text-orange-400',
	5: 'text-red-600 dark:text-red-400',
}

/** Hidden for none/low, like the original UI: only priorities worth noticing show up. */
export function PriorityBadge({priority, done, className}: {priority?: number; done?: boolean; className?: string}) {
	if (!priority || priority < 2 || done) return null
	return (
		<span className={cn('inline-flex items-center gap-1 text-xs font-medium', PRIORITY_STYLE[priority], className)}>
			<FlagIcon className="size-3" />
			{priorityLabel(priority)}
		</span>
	)
}

export function DueBadge({task, className}: {task: Task; className?: string}) {
	const due = parseDate(task.due_date)
	if (!due) return null
	const overdue = isOverdue(due, task.done)
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 text-xs',
				overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
				className,
			)}
		>
			<CalendarIcon className="size-3" />
			{formatDue(due)}
			{(task.repeat_after ?? 0) > 0 || (task.repeat_mode ?? 0) > 0 ? <RepeatIcon className="size-3" /> : null}
		</span>
	)
}

export function UserAvatar({user, className}: {user: User; className?: string}) {
	const src = useAvatarSrc(user, 48)
	return (
		<Tooltip
			label={displayName(user)}
			render={<span />}
			className={cn('inline-flex rounded-full border-2 border-background', className)}
		>
			<Avatar name={displayName(user)} src={src} size="sm" />
		</Tooltip>
	)
}

export function AssigneeStack({users, max = 3}: {users?: User[] | null; max?: number}) {
	if (!users?.length) return null
	return (
		<div className="flex -space-x-2">
			{users.slice(0, max).map(u => (
				<UserAvatar key={u.id} user={u} />
			))}
			{users.length > max && (
				<span className="flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
					+{users.length - max}
				</span>
			)}
		</div>
	)
}

export function TaskMetaIcons({task}: {task: Task}) {
	const comments = task.comment_count ?? 0
	const attachments = task.attachments?.length ?? 0
	if (!comments && !attachments) return null
	return (
		<span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
			{comments > 0 && (
				<span className="inline-flex items-center gap-0.5">
					<MessageSquareIcon className="size-3" />
					{comments}
				</span>
			)}
			{attachments > 0 && (
				<span className="inline-flex items-center gap-0.5">
					<PaperclipIcon className="size-3" />
					{attachments}
				</span>
			)}
		</span>
	)
}

/**
 * Partial task update. v2 PUT replaces the whole task, so the full current task
 * is sent with the changes merged in.
 */
export function useUpdateTask() {
	return useMutation({
		mutationKey: ['update-task'],
		mutationFn: async ({task, changes}: {task: Task; changes: Partial<Task>}) => {
			const body = {...task, ...changes}
			return (await tasksUpdate({path: {task: task.id!}, body})).data
		},
		// Stop in-flight refetches from landing on top of the optimistic patch.
		onMutate: async ({task, changes}) => {
			await queryClient.cancelQueries({queryKey: keys.tasks})
			patchCachedTask({...task, ...changes})
		},
		onSuccess: updated => patchCachedTask(updated),
		onError: (e, {task}) => {
			patchCachedTask(task)
			toast.error(e.message)
		},
		// Refetch once the last of a burst of edits settles, so a stale read can't undo a newer one.
		onSettled: () => (queryClient.isMutating({mutationKey: ['update-task']}) === 1 ? invalidateTasks() : undefined),
	})
}

export function useToggleDone() {
	const update = useUpdateTask()
	return (task: Task, done = !task.done) => {
		update.mutate(
			{task, changes: {done}},
			{
				onSuccess: () => {
					if (done)
						toast.success(`Marked “${task.title}” done`, {
							action: {label: 'Undo', onClick: () => update.mutate({task: {...task, done: true}, changes: {done: false}})},
						})
				},
			},
		)
	}
}
