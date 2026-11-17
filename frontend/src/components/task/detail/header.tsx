import {useEffect, useRef, useState, type ReactNode} from 'react'
import {Link, useNavigate} from 'react-router'
import {
	BellIcon,
	BellOffIcon,
	CheckIcon,
	CopyIcon,
	FolderInputIcon,
	LinkIcon,
	MoreHorizontalIcon,
	StarIcon,
	Trash2Icon,
} from 'lucide-react'
import {toast} from 'sonner'
import {subscriptionsCreate, subscriptionsDelete, tasksDelete, tasksDuplicate, type Project, type Task} from '@/client/generated'
import {projectHref} from '@/components/app-sidebar'
import {ColorDot} from '@/components/color-picker'
import {ProjectSelect} from '@/components/project-select'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {errorMessage} from '@/lib/api'
import {useOpenTask} from '@/lib/navigation'
import {invalidateProjects, invalidateTasks, keys, queryClient, useProjects} from '@/lib/queries'
import {cn} from '@/lib/utils'
import {patchDetail} from './labels'
import {ConfirmDialog} from './shared'

function IconAction({label, onClick, children, active}: {label: string; onClick?: () => void; children: ReactNode; active?: boolean}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={label} aria-pressed={active} onClick={onClick} className="text-muted-foreground">
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	)
}

/** Project › parent › … path for the breadcrumb. */
function useProjectPath(projectId?: number) {
	const {projects} = useProjects()
	const path: Project[] = []
	let p = projects.find(x => x.id === projectId)
	while (p && path.length < 10) {
		path.unshift(p)
		const parentId = p.parent_project_id
		p = parentId ? projects.find(x => x.id === parentId) : undefined
	}
	return path
}

export function TaskHeader({
	task,
	canEdit,
	update,
	onDeleted,
	actions,
}: {
	task: Task
	canEdit: boolean
	update: (changes: Partial<Task>) => void
	onDeleted?: (task: Task) => void
	actions?: ReactNode
}) {
	const navigate = useNavigate()
	const openTask = useOpenTask()
	const path = useProjectPath(task.project_id)
	const {projects} = useProjects()
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [moving, setMoving] = useState(false)
	const subscription = task.subscription
	// A subscription inherited from the project can only be changed there.
	const inherited = !!subscription?.id && subscription.entity === 'project'

	const toggleSubscription = async () => {
		const on = !!subscription?.id
		try {
			if (on) {
				await subscriptionsDelete({path: {entity: 'task', entityID: task.id!}})
				patchDetail(task.id!, {subscription: undefined} as Partial<Task>)
				toast.success('Unsubscribed from this task')
			} else {
				const {data} = await subscriptionsCreate({path: {entity: 'task', entityID: task.id!}})
				patchDetail(task.id!, {subscription: data} as Partial<Task>)
				toast.success('Subscribed: you’ll be notified of changes')
			}
		} catch (e) {
			toast.error(errorMessage(e))
		} finally {
			void invalidateTasks()
		}
	}

	const duplicate = async () => {
		try {
			const {data} = await tasksDuplicate({path: {task: task.id!}})
			void invalidateTasks()
			const copy = data.duplicated_task
			toast.success('Task duplicated', copy?.id ? {action: {label: 'Open', onClick: () => openTask(copy.id!)}} : undefined)
		} catch (e) {
			toast.error(errorMessage(e))
		}
	}

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(`${window.location.origin}/tasks/${task.id}`)
			toast.success('Link copied')
		} catch {
			toast.error('Could not copy the link')
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex min-h-8 items-center gap-2">
				<nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
					{path.map((p, i) => (
						<span key={p.id} className={cn('flex min-w-0 items-center gap-1.5', i < path.length - 1 && 'max-sm:hidden')}>
							<Link to={projectHref(p)} className="flex min-w-0 items-center gap-1.5 rounded-sm transition-colors hover:text-foreground">
								{i === 0 && p.hex_color && <ColorDot color={p.hex_color} />}
								<span className="truncate">{p.title}</span>
							</Link>
							<span className="text-muted-foreground/50">/</span>
						</span>
					))}
					<span className="shrink-0 font-mono text-xs tabular-nums">{task.identifier || `#${task.index}`}</span>
				</nav>
				<div className="flex shrink-0 items-center gap-0.5">
					<IconAction
						label={task.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
						active={task.is_favorite}
						onClick={() => update({is_favorite: !task.is_favorite})}
					>
						<StarIcon className={cn(task.is_favorite && 'fill-amber-400 text-amber-400')} />
					</IconAction>
					{inherited ? (
						<IconAction label="Subscribed through the project">
							<BellIcon className="text-foreground" />
						</IconAction>
					) : (
						<IconAction label={subscription?.id ? 'Unsubscribe' : 'Subscribe to changes'} onClick={() => void toggleSubscription()}>
							{subscription?.id ? <BellIcon className="fill-current text-foreground" /> : <BellOffIcon />}
						</IconAction>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-sm" aria-label="Task actions" className="text-muted-foreground">
								<MoreHorizontalIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem onSelect={() => void copyLink()}>
								<LinkIcon />
								Copy link
							</DropdownMenuItem>
							{canEdit && (
								<>
									<DropdownMenuItem onSelect={() => void duplicate()}>
										<CopyIcon />
										Duplicate
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => setMoving(true)}>
										<FolderInputIcon />
										Move to project…
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
										<Trash2Icon />
										Delete task
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
					{actions}
				</div>
			</div>

			<div className="flex items-start gap-3">
				<DoneButton done={!!task.done} onClick={() => update({done: !task.done})} disabled={!canEdit} />
				<TitleInput value={task.title ?? ''} disabled={!canEdit} done={task.done} onSave={title => update({title})} />
			</div>

			<ConfirmDialog
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title="Delete this task?"
				description={<>“{task.title}” will be moved to the trash.</>}
				onConfirm={async () => {
					try {
						await tasksDelete({path: {task: task.id!}})
						toast.success('Task deleted')
						onDeleted?.(task)
						// Drop the detail first so nothing refetches the deleted task.
						queryClient.removeQueries({queryKey: keys.task(task.id!)})
						void invalidateTasks()
					} catch (e) {
						toast.error(errorMessage(e))
						throw e
					}
				}}
			/>
			<MoveDialog
				open={moving}
				onOpenChange={setMoving}
				task={task}
				onMove={projectId => {
					update({project_id: projectId})
					void invalidateProjects()
					const target = projects.find(p => p.id === projectId)
					toast.success(`Moved to ${target?.title ?? 'project'}`, {
						action: {label: 'Open project', onClick: () => navigate(projectHref(target ?? {id: projectId}))},
					})
				}}
			/>
		</div>
	)
}

function DoneButton({done, onClick, disabled}: {done: boolean; onClick: () => void; disabled?: boolean}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					disabled={disabled}
					aria-pressed={done}
					aria-label={done ? 'Mark as not done' : 'Mark as done'}
					className={cn(
						'group/done mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
						done
							? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500'
							: 'border-muted-foreground/40 text-transparent hover:border-emerald-600 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-500',
					)}
				>
					<CheckIcon className="size-4" strokeWidth={3} />
				</button>
			</TooltipTrigger>
			<TooltipContent>{done ? 'Mark as not done' : 'Mark as done'}</TooltipContent>
		</Tooltip>
	)
}

function TitleInput({value, onSave, disabled, done}: {value: string; onSave: (v: string) => void; disabled?: boolean; done?: boolean}) {
	const [draft, setDraft] = useState(value)
	const ref = useRef<HTMLTextAreaElement>(null)
	useEffect(() => setDraft(value), [value])

	const commit = () => {
		const v = draft.replace(/\s+/g, ' ').trim()
		if (!v) setDraft(value)
		else if (v !== value) onSave(v)
	}

	return (
		<textarea
			ref={ref}
			value={draft}
			rows={1}
			disabled={disabled}
			aria-label="Task title"
			onChange={e => setDraft(e.target.value)}
			onBlur={commit}
			onKeyDown={e => {
				if (e.key === 'Enter') {
					e.preventDefault()
					ref.current?.blur()
				} else if (e.key === 'Escape') {
					e.preventDefault()
					e.stopPropagation()
					setDraft(value)
					requestAnimationFrame(() => ref.current?.blur())
				}
			}}
			className={cn(
				'field-sizing-content min-w-0 flex-1 resize-none rounded-md bg-transparent px-1 py-0.5 -mx-1 text-2xl font-semibold tracking-tight outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50 disabled:hover:bg-transparent',
				done && 'text-muted-foreground line-through decoration-2',
			)}
		/>
	)
}

function MoveDialog({
	open,
	onOpenChange,
	task,
	onMove,
}: {
	open: boolean
	onOpenChange: (o: boolean) => void
	task: Task
	onMove: (projectId: number) => void
}) {
	const [target, setTarget] = useState<number | null>(null)
	useEffect(() => {
		if (open) setTarget(null)
	}, [open])
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Move task</DialogTitle>
					<DialogDescription>Pick the project “{task.title}” should move to.</DialogDescription>
				</DialogHeader>
				<ProjectSelect value={target} onChange={setTarget} excludeId={task.project_id} noneLabel="Choose a project…" />
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!target}
						onClick={() => {
							if (!target) return
							onMove(target)
							onOpenChange(false)
						}}
					>
						Move
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
