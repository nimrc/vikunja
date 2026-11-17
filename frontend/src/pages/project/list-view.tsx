import {useDeferredValue, useMemo, useState} from 'react'
import {useInfiniteQuery, useQuery, type InfiniteData} from '@tanstack/react-query'
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core'
import {restrictToVerticalAxis} from '@/pages/project/dnd-modifiers'
import {arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {GripVerticalIcon, ListTodoIcon, SearchIcon} from 'lucide-react'
import {toast} from 'sonner'
import {
	projectTasksList,
	projectViewTasksList,
	tasksPositionUpdate,
	type PaginatedTask,
	type Project,
	type ProjectView,
	type Task,
} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Collapsible} from '@/components/ui/collapsible'
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group'
import {Skeleton} from '@/components/ui/skeleton'
import {Spinner} from '@/components/ui/spinner'
import {TaskQuickAdd} from '@/components/task/task-quick-add'
import {TaskRow} from '@/components/task/task-row'
import {errorMessage} from '@/lib/api'
import {cn} from '@/lib/utils'
import {queryClient, useProjects} from '@/lib/queries'

const PAGE_SIZE = 50

/** Midpoint between neighbours, the same scheme the backend and old frontend use. */
export function positionBetween(before?: number | null, after?: number | null): number {
	if (before == null && after == null) return 2 ** 16
	if (before == null) return (after ?? 0) / 2
	if (after == null) return before + 2 ** 16
	return before + (after - before) / 2
}

export function ListView({project, view}: {project: Project; view: ProjectView}) {
	const projectId = project.id!
	const viewId = view.id!
	const [search, setSearch] = useState('')
	const q = useDeferredValue(search.trim())
	const canWrite = (project.max_permission ?? 0) >= 1 || projectId < 0
	const {projects} = useProjects()
	const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
	const crossProject = projectId < 0

	const queryKey = ['tasks', 'list', 'view', projectId, viewId, q] as const
	const tasksQuery = useInfiniteQuery({
		queryKey,
		initialPageParam: 1,
		queryFn: async ({pageParam, signal}) =>
			(
				await projectViewTasksList({
					path: {project: projectId, view: viewId},
					query: {
						page: pageParam,
						per_page: PAGE_SIZE,
						q: q || undefined,
						sort_by: ['position', 'id'],
						order_by: ['asc', 'asc'],
						expand: ['subtasks', 'comment_count'],
					},
					signal,
				})
			).data,
		getNextPageParam: (last, pages) => ((last.total_pages ?? 1) > pages.length ? pages.length + 1 : undefined),
	})

	const all = useMemo(() => tasksQuery.data?.pages.flatMap(p => p.items ?? []) ?? [], [tasksQuery.data])

	// Subtasks render under their parent when both are in the list.
	const {roots, childrenOf} = useMemo(() => {
		const ids = new Set(all.map(t => t.id))
		const childrenOf = new Map<number, Task[]>()
		const roots: Task[] = []
		for (const t of all) {
			const parent = t.related_tasks?.parenttask?.find(p => ids.has(p.id))
			if (parent?.id) childrenOf.set(parent.id, [...(childrenOf.get(parent.id) ?? []), t])
			else roots.push(t)
		}
		return {roots, childrenOf}
	}, [all])

	const sensors = useSensors(
		useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
		useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 6}}),
		useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
	)

	async function onDragEnd(e: DragEndEvent) {
		if (!e.over || e.active.id === e.over.id) return
		const from = roots.findIndex(t => t.id === e.active.id)
		const to = roots.findIndex(t => t.id === e.over!.id)
		if (from < 0 || to < 0) return
		const reordered = arrayMove(roots, from, to)
		const moved = reordered[to]
		const position = positionBetween(reordered[to - 1]?.position, reordered[to + 1]?.position)
		const order = new Map(reordered.map((t, i) => [t.id, i]))
		const snapshot = queryClient.getQueryData<InfiniteData<PaginatedTask>>(queryKey)
		queryClient.setQueryData<InfiniteData<PaginatedTask>>(queryKey, old => {
			if (!old) return old
			const items = old.pages
				.flatMap(p => p.items ?? [])
				.map(t => (t.id === moved.id ? {...t, position} : t))
				.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
			let offset = 0
			return {
				...old,
				pages: old.pages.map(p => {
					const n = p.items?.length ?? 0
					const slice = items.slice(offset, offset + n)
					offset += n
					return {...p, items: slice}
				}),
			}
		})
		try {
			await tasksPositionUpdate({path: {task: moved.id!}, body: {position, project_view_id: viewId}})
		} catch (err) {
			queryClient.setQueryData(queryKey, snapshot)
			toast.error(errorMessage(err))
		}
	}

	const dragEnabled = canWrite && !q

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				{canWrite && projectId > 0 && <TaskQuickAdd projectId={projectId} className="flex-1" />}
				<InputGroup className={cn('sm:w-56', projectId <= 0 && 'sm:ml-auto')}>
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput placeholder="Filter tasks…" value={search} onChange={e => setSearch(e.target.value)} />
				</InputGroup>
			</div>

			{tasksQuery.isPending ? (
				<div className="flex flex-col gap-1">
					{Array.from({length: 6}, (_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			) : roots.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ListTodoIcon />
						</EmptyMedia>
						<EmptyTitle>{q ? 'No matching tasks' : 'All clear'}</EmptyTitle>
						<EmptyDescription>
							{q ? 'Try a different search.' : canWrite && projectId > 0 ? 'Add your first task above.' : 'Nothing to do here.'}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="flex flex-col rounded-xl border bg-card p-1">
					<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
						<SortableContext items={roots.map(t => t.id!)} strategy={verticalListSortingStrategy}>
							{roots.map(t => (
								<SortableTask
									key={t.id}
									task={t}
									project={projectById.get(t.project_id)}
									showProject={crossProject}
									canWrite={canWrite}
									dragEnabled={dragEnabled}
									subtasks={childrenOf}
								/>
							))}
						</SortableContext>
					</DndContext>
					{tasksQuery.hasNextPage && (
						<Button
							className="m-1 text-muted-foreground"
							onClick={() => tasksQuery.fetchNextPage()}
							disabled={tasksQuery.isFetchingNextPage}
						>
							{tasksQuery.isFetchingNextPage && <Spinner />}
							Load more
						</Button>
					)}
				</div>
			)}

			{projectId > 0 && <CompletedTasks projectId={projectId} canWrite={canWrite} />}
		</div>
	)
}

function SortableTask({
	task,
	project,
	showProject,
	canWrite,
	dragEnabled,
	subtasks,
	depth = 0,
}: {
	task: Task
	project?: Project
	showProject: boolean
	canWrite: boolean
	dragEnabled: boolean
	subtasks: Map<number, Task[]>
	depth?: number
}) {
	const sortable = useSortable({id: task.id!, disabled: !dragEnabled || depth > 0})
	const children = subtasks.get(task.id!) ?? []
	return (
		<div
			ref={depth === 0 ? sortable.setNodeRef : undefined}
			style={depth === 0 ? {transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition} : undefined}
			className={cn(sortable.isDragging && 'relative z-10 rounded-lg bg-card shadow-lg ring-1 ring-border')}
		>
			<TaskRow
				task={task}
				project={project}
				showProject={showProject}
				canWrite={canWrite}
				depth={depth}
				handle={
					dragEnabled && depth === 0 ? (
						<button
							type="button"
							{...sortable.attributes}
							{...sortable.listeners}
							className="absolute top-3 left-0 hidden cursor-grab touch-none text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-muted-foreground sm:block"
							aria-label="Reorder"
						>
							<GripVerticalIcon className="size-4" />
						</button>
					) : undefined
				}
			/>
			{children.map(c => (
				<SortableTask
					key={c.id}
					task={c}
					project={project}
					showProject={showProject}
					canWrite={canWrite}
					dragEnabled={false}
					subtasks={subtasks}
					depth={depth + 1}
				/>
			))}
		</div>
	)
}

function CompletedTasks({projectId, canWrite}: {projectId: number; canWrite: boolean}) {
	const [open, setOpen] = useState(false)
	const done = useQuery({
		queryKey: ['tasks', 'list', 'done', projectId],
		queryFn: async ({signal}) =>
			(
				await projectTasksList({
					path: {project: projectId},
					query: {filter: 'done = true', sort_by: ['done_at', 'id'], order_by: ['desc', 'desc'], per_page: 50},
					signal,
				})
			).data,
	})
	const total = done.data?.total ?? 0
	if (!total) return null
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			title={
				<>
					Completed <span className="tabular-nums">{total}</span>
				</>
			}
		>
			<div className="mt-1 flex flex-col rounded-xl border bg-card p-1">
				{done.data?.items?.map(t => (
					<TaskRow key={t.id} task={t} canWrite={canWrite} />
				))}
			</div>
		</Collapsible>
	)
}
