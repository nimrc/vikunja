import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {CheckCircle2Icon, CircleIcon, GitForkIcon, PlusIcon, XIcon} from 'lucide-react'
import {toast} from 'sonner'
import {tasksList, tasksRelationsCreate, tasksRelationsDelete, type Task, type TaskRelation} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {SelectMenu} from '@/components/ui/select'
import {Spinner} from '@/components/ui/spinner'
import {DueBadge} from '@/components/task/task-bits'
import {errorMessage} from '@/lib/api'
import {useOpenTask} from '@/lib/navigation'
import {invalidateTasks, useProjects} from '@/lib/queries'
import {cn} from '@/lib/utils'
import {SectionHeader, useDebounced} from './shared'

type Kind = NonNullable<TaskRelation['relation_kind']>

export const RELATION_KINDS: {value: Kind; label: string; one: string}[] = [
	{value: 'subtask', label: 'Subtasks', one: 'Subtask'},
	{value: 'parenttask', label: 'Parent tasks', one: 'Parent task'},
	{value: 'related', label: 'Related', one: 'Related'},
	{value: 'blocking', label: 'Blocking', one: 'Blocks'},
	{value: 'blocked', label: 'Blocked by', one: 'Blocked by'},
	{value: 'precedes', label: 'Precedes', one: 'Precedes'},
	{value: 'follows', label: 'Follows', one: 'Follows'},
	{value: 'duplicateof', label: 'Duplicate of', one: 'Duplicate of'},
	{value: 'duplicates', label: 'Duplicates', one: 'Duplicates'},
	{value: 'copiedfrom', label: 'Copied from', one: 'Copied from'},
	{value: 'copiedto', label: 'Copied to', one: 'Copied to'},
]


export function TaskRelations({task, canEdit}: {task: Task; canEdit: boolean}) {
	const openTask = useOpenTask()
	const {projects} = useProjects()
	const [adding, setAdding] = useState(false)
	const related = task.related_tasks ?? {}
	const groups = RELATION_KINDS.map(k => ({...k, tasks: related[k.value] ?? []})).filter(g => g.tasks.length > 0)
	const total = groups.reduce((n, g) => n + g.tasks.length, 0)
	const taskId = task.id!

	const remove = async (kind: Kind, other: Task) => {
		try {
			await tasksRelationsDelete({path: {task: taskId, relationKind: kind, otherTask: other.id!}})
		} catch (e) {
			toast.error(errorMessage(e))
		} finally {
			void invalidateTasks()
		}
	}

	if (!canEdit && total === 0) return null

	return (
		<section>
			<SectionHeader icon={<GitForkIcon />} title="Related tasks" count={total}>
				{canEdit && !adding && (
					<Button size="sm" onClick={() => setAdding(true)}>
						<PlusIcon />
						Add relation
					</Button>
				)}
			</SectionHeader>
			{adding && <AddRelation task={task} onDone={() => setAdding(false)} />}
			{groups.length === 0 && !adding && canEdit && (
				<button
					type="button"
					onClick={() => setAdding(true)}
					className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
				>
					<PlusIcon className="size-4" />
					Link a subtask, blocker or related task
				</button>
			)}
			<div className="flex flex-col gap-3">
				{groups.map(g => (
					<div key={g.value}>
						<h3 className="mb-1 px-1 text-xs font-medium text-muted-foreground">{g.label}</h3>
						<ul className="overflow-hidden rounded-xl border bg-card">
							{g.tasks.map(t => {
								const other = t.project_id !== task.project_id ? projects.find(p => p.id === t.project_id) : undefined
								return (
									<li key={t.id} className="group/rel flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0 hover:bg-muted/40">
										{t.done ? (
											<CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
										) : (
											<CircleIcon className="size-4 shrink-0 text-muted-foreground" />
										)}
										<button
											type="button"
											onClick={() => openTask(t.id!)}
											className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
										>
											{other && <span className="shrink-0 text-xs text-muted-foreground">{other.title} ›</span>}
											<span className={cn('truncate hover:underline', t.done && 'text-muted-foreground line-through')}>
												{t.title}
											</span>
										</button>
										<DueBadge task={t} className="hidden shrink-0 sm:inline-flex" />
										{canEdit && (
											<Button
												round
												size="sm"
												className="text-muted-foreground opacity-0 group-hover/rel:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
												aria-label="Remove relation"
												onClick={() => void remove(g.value, t)}
											>
												<XIcon />
											</Button>
										)}
									</li>
								)
							})}
						</ul>
					</div>
				))}
			</div>
		</section>
	)
}

function AddRelation({task, onDone}: {task: Task; onDone: () => void}) {
	const [kind, setKind] = useState<Kind>('related')
	const [other, setOther] = useState<Task | null>(null)
	const [open, setOpen] = useState(true)
	const [search, setSearch] = useState('')
	const [busy, setBusy] = useState(false)
	const q = useDebounced(search.trim())
	const {projects} = useProjects()

	const results = useQuery({
		queryKey: ['relation-search', q],
		queryFn: async ({signal}) => (await tasksList({query: {q, per_page: 20}, signal})).data.items ?? [],
		enabled: open,
		staleTime: 10_000,
	})
	const hits = (results.data ?? []).filter(t => t.id !== task.id)

	const save = async () => {
		if (!other) return
		setBusy(true)
		try {
			await tasksRelationsCreate({path: {task: task.id!}, body: {other_task_id: other.id, relation_kind: kind}})
			await invalidateTasks()
			onDone()
		} catch (e) {
			toast.error(errorMessage(e))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="mb-3 flex flex-col gap-2 rounded-xl border bg-card p-2 sm:flex-row sm:items-center">
			<div className="sm:w-36">
				<SelectMenu
					label="Relation kind"
					options={RELATION_KINDS.map(k => ({value: k.value, label: k.one}))}
					value={kind}
					onValueChange={v => setKind(v as Kind)}
				/>
			</div>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger render={<Button size="sm" className="min-w-0 flex-1 justify-start font-normal" />}>
					<span className={cn('truncate', !other && 'text-muted-foreground')}>{other?.title ?? 'Search for a task…'}</span>
				</PopoverTrigger>
				<PopoverContent className="w-(--anchor-width) min-w-72 p-0" align="start">
					<Command shouldFilter={false}>
						<CommandInput placeholder="Search tasks…" value={search} onValueChange={setSearch} />
						<CommandList>
							{results.isFetching && !results.data ? (
								<div className="flex justify-center py-4">
									<Spinner />
								</div>
							) : (
								<CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No tasks found.</CommandEmpty>
							)}
							<CommandGroup>
								{hits.map(t => (
									<CommandItem
										key={t.id}
										value={String(t.id)}
										onSelect={() => {
											setOther(t)
											setOpen(false)
										}}
									>
										{t.done ? <CheckCircle2Icon className="text-muted-foreground" /> : <CircleIcon className="text-muted-foreground" />}
										<span className={cn('truncate', t.done && 'text-muted-foreground line-through')}>{t.title}</span>
										<span className="ml-auto shrink-0 text-xs text-muted-foreground">
											{projects.find(p => p.id === t.project_id)?.title}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			<div className="flex justify-end gap-1">
				<Button size="sm" onClick={onDone} disabled={busy}>
					Cancel
				</Button>
				<Button tone="primary" size="sm" onClick={() => void save()} disabled={!other || busy}>
					{busy && <Spinner />}
					Add
				</Button>
			</div>
		</div>
	)
}
