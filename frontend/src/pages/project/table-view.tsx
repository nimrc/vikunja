import {useState, type ReactNode} from 'react'
import {keepPreviousData, useQuery} from '@tanstack/react-query'
import {ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, Columns3Icon} from 'lucide-react'
import {projectViewTasksList, type Project, type ProjectView, type Task} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Label} from '@/components/ui/label'
import {Progress} from '@/components/ui/progress'
import {Skeleton} from '@/components/ui/skeleton'
import {Switch} from '@/components/ui/switch'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@/components/ui/table'
import {AssigneeStack, DueBadge, LabelBadge, PriorityBadge, useToggleDone} from '@/components/task/task-bits'
import {useOpenTask} from '@/lib/navigation'
import {cn} from '@/lib/utils'
import {displayName, formatDateTime, parseDate, priorityLabel} from '@/lib/format'

type ColumnKey =
	| 'index'
	| 'done'
	| 'title'
	| 'priority'
	| 'labels'
	| 'assignees'
	| 'due_date'
	| 'start_date'
	| 'end_date'
	| 'percent_done'
	| 'done_at'
	| 'created'
	| 'updated'
	| 'created_by'

type Column = {key: ColumnKey; label: string; sortKey?: string; className?: string; render: (t: Task) => ReactNode}

const dateCell = (v?: string) => {
	const d = parseDate(v)
	return d ? <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(d)}</span> : null
}

const COLUMNS: Column[] = [
	{key: 'index', label: '#', sortKey: 'id', className: 'w-16', render: t => <span className="text-muted-foreground tabular-nums">{t.identifier || `#${t.index}`}</span>},
	{key: 'done', label: 'Done', sortKey: 'done', className: 'w-14', render: () => null},
	{key: 'title', label: 'Title', sortKey: 'title', render: t => <span className={cn('font-medium', t.done && 'text-muted-foreground line-through')}>{t.title}</span>},
	{key: 'priority', label: 'Priority', sortKey: 'priority', render: t => ((t.priority ?? 0) >= 2 ? <PriorityBadge priority={t.priority} /> : <span className="text-muted-foreground">{t.priority ? priorityLabel(t.priority) : ''}</span>)},
	{key: 'labels', label: 'Labels', render: t => <span className="flex flex-wrap gap-1">{t.labels?.map(l => <LabelBadge key={l.id} label={l} />)}</span>},
	{key: 'assignees', label: 'Assignees', render: t => <AssigneeStack users={t.assignees} />},
	{key: 'due_date', label: 'Due', sortKey: 'due_date', render: t => <DueBadge task={t} />},
	{key: 'start_date', label: 'Start', sortKey: 'start_date', render: t => dateCell(t.start_date)},
	{key: 'end_date', label: 'End', sortKey: 'end_date', render: t => dateCell(t.end_date)},
	{
		key: 'percent_done',
		label: 'Progress',
		sortKey: 'percent_done',
		render: t => (
			<span className="flex items-center gap-2">
				<Progress value={(t.percent_done ?? 0) * 100} className="h-1.5 w-16" />
				<span className="text-xs text-muted-foreground tabular-nums">{Math.round((t.percent_done ?? 0) * 100)}%</span>
			</span>
		),
	},
	{key: 'done_at', label: 'Done at', sortKey: 'done_at', render: t => dateCell(t.done_at)},
	{key: 'created', label: 'Created', sortKey: 'created', render: t => dateCell(t.created)},
	{key: 'updated', label: 'Updated', sortKey: 'updated', render: t => dateCell(t.updated)},
	{key: 'created_by', label: 'Created by', render: t => <span className="text-muted-foreground">{displayName(t.created_by)}</span>},
]

const DEFAULT_VISIBLE: ColumnKey[] = ['index', 'done', 'title', 'priority', 'labels', 'assignees', 'due_date']
const STORAGE_KEY = 'tableViewColumns'
const PER_PAGE = 50

function loadColumns(): ColumnKey[] {
	try {
		const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
		return Array.isArray(v) ? v : DEFAULT_VISIBLE
	} catch {
		return DEFAULT_VISIBLE
	}
}

export function TableView({project, view}: {project: Project; view: ProjectView}) {
	const projectId = project.id!
	const viewId = view.id!
	const [visible, setVisible] = useState<ColumnKey[]>(loadColumns)
	const [sort, setSort] = useState<{key: string; dir: 'asc' | 'desc'}>({key: 'id', dir: 'desc'})
	const [showDone, setShowDone] = useState(false)
	const [page, setPage] = useState(1)
	const canWrite = (project.max_permission ?? 0) >= 1 || projectId < 0
	const toggleDone = useToggleDone()
	const openTask = useOpenTask()

	const query = useQuery({
		queryKey: ['tasks', 'list', 'table', projectId, viewId, sort, showDone, page],
		queryFn: async ({signal}) =>
			(
				await projectViewTasksList({
					path: {project: projectId, view: viewId},
					query: {
						page,
						per_page: PER_PAGE,
						sort_by: sort.key === 'id' ? ['id'] : [sort.key, 'id'],
						order_by: sort.key === 'id' ? [sort.dir] : [sort.dir, 'desc'],
						filter: showDone ? undefined : 'done = false',
					},
					signal,
				})
			).data,
		placeholderData: keepPreviousData,
	})

	const setColumns = (cols: ColumnKey[]) => {
		setVisible(cols)
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(cols))
		} catch {
			// per-browser convenience only
		}
	}

	const columns = COLUMNS.filter(c => visible.includes(c.key))
	const tasks = query.data?.items ?? []
	const totalPages = query.data?.total_pages ?? 1

	const onSort = (key?: string) => {
		if (!key) return
		setPage(1)
		setSort(s => (s.key === key ? {key, dir: s.dir === 'asc' ? 'desc' : 'asc'} : {key, dir: 'asc'}))
	}

	return (
		<div className="flex w-full flex-col gap-3 p-4 md:p-6">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<Switch
						id="table-show-done"
						checked={showDone}
						onCheckedChange={v => {
							setShowDone(v)
							setPage(1)
						}}
					/>
					<Label htmlFor="table-show-done" className="text-sm font-normal">
						Show done tasks
					</Label>
				</div>
				<span className="text-sm text-muted-foreground tabular-nums">{query.data?.total ?? 0} tasks</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm" className="ml-auto">
							<Columns3Icon />
							Columns
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						<DropdownMenuLabel>Visible columns</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{COLUMNS.map(c => (
							<DropdownMenuCheckboxItem
								key={c.key}
								checked={visible.includes(c.key)}
								disabled={c.key === 'title'}
								onSelect={e => e.preventDefault()}
								onCheckedChange={v => setColumns(v ? [...visible, c.key] : visible.filter(k => k !== c.key))}
							>
								{c.label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="overflow-hidden rounded-xl border bg-card">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							{columns.map(c => (
								<TableHead key={c.key} className={cn('h-10 whitespace-nowrap', c.className)}>
									{c.sortKey ? (
										<button
											type="button"
											onClick={() => onSort(c.sortKey)}
											className="inline-flex items-center gap-1 hover:text-foreground"
										>
											{c.label}
											{sort.key === c.sortKey &&
												(sort.dir === 'asc' ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
										</button>
									) : (
										c.label
									)}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{query.isPending
							? Array.from({length: 8}, (_, i) => (
									<TableRow key={i}>
										<TableCell colSpan={columns.length}>
											<Skeleton className="h-5 w-full" />
										</TableCell>
									</TableRow>
								))
							: tasks.map(t => (
									<TableRow key={t.id} className="cursor-pointer" onClick={() => openTask(t.id!)}>
										{columns.map(c => (
											<TableCell key={c.key} className={c.className}>
												{c.key === 'done' ? (
													<Checkbox
														checked={!!t.done}
														disabled={!canWrite}
														onClick={e => e.stopPropagation()}
														onCheckedChange={v => toggleDone(t, v === true)}
														className="rounded-full"
													/>
												) : (
													c.render(t)
												)}
											</TableCell>
										))}
									</TableRow>
								))}
						{!query.isPending && tasks.length === 0 && (
							<TableRow className="hover:bg-transparent">
								<TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
									No tasks.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
					<span className="tabular-nums">
						Page {page} of {totalPages}
					</span>
					<Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page">
						<ChevronLeftIcon />
					</Button>
					<Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="Next page">
						<ChevronRightIcon />
					</Button>
				</div>
			)}
		</div>
	)
}
