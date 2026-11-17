import {useCallback, useRef, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	MeasuringStrategy,
	MouseSensor,
	pointerWithin,
	rectIntersection,
	TouchSensor,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
	type UniqueIdentifier,
} from '@dnd-kit/core'
import {arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates} from '@dnd-kit/sortable'
import {KanbanSquareIcon, PlusIcon} from 'lucide-react'
import {toast} from 'sonner'
import type {Project, ProjectView, Task} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Input} from '@/components/ui/input'
import {Skeleton} from '@/components/ui/skeleton'
import {errorMessage} from '@/lib/api'
import {keys, queryClient} from '@/lib/queries'
import {useOpenTask} from '@/lib/navigation'
import {
	boardQuery,
	bucketFull,
	calculatePosition,
	createTaskInBucket,
	loadBucketPage,
	persistTaskMove,
	setBoard,
	useBucketMutations,
	useViewUpdate,
	type BoardBucket,
	type BoardData,
} from './kanban/board-data'
import {BucketColumn} from './kanban/bucket-column'
import {TaskCardBody} from './kanban/task-card'

type Active = {type: 'task'; task: Task; from: number} | {type: 'bucket'; bucket: BoardBucket}

const taskId = (id: UniqueIdentifier) => Number(String(id).slice('task-'.length))
const isTaskId = (id: UniqueIdentifier) => String(id).startsWith('task-')
const isBucketId = (id: UniqueIdentifier) => String(id).startsWith('bucket-')

function useCollapsed(projectId: number) {
	const key = `kanban-collapsed-${projectId}`
	const [set, setSet] = useState<Set<number>>(() => {
		try {
			return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'))
		} catch {
			return new Set()
		}
	})
	const toggle = useCallback(
		(id: number) =>
			setSet(prev => {
				const next = new Set(prev)
				if (!next.delete(id)) next.add(id)
				try {
					localStorage.setItem(key, JSON.stringify([...next]))
				} catch {
					// per-browser convenience only
				}
				return next
			}),
		[key],
	)
	return [set, toggle] as const
}

export function KanbanView({project, view}: {project: Project; view: ProjectView}) {
	const projectId = project.id!
	const viewId = view.id!
	const board = useQuery(boardQuery(projectId, viewId))
	const openTaskRaw = useOpenTask()
	const bucketMut = useBucketMutations({project: projectId, view: viewId})
	const viewUpdate = useViewUpdate(project, view)
	const [collapsed, toggleCollapsed] = useCollapsed(projectId)

	const canWrite = project.max_permission == null || project.max_permission > 0
	const manual = view.bucket_configuration_mode !== 'filter'
	const canEditBuckets = canWrite && manual

	const [dragBuckets, setDragBuckets] = useState<BoardBucket[] | null>(null)
	const [active, setActive] = useState<Active | null>(null)
	const [dragExpanded, setDragExpanded] = useState<number | null>(null)
	const snapshot = useRef<BoardData | undefined>(undefined)
	const lastDragEnd = useRef(0)
	const buckets = dragBuckets ?? board.data?.buckets ?? []

	// A drop can end with the pointer still over the card, which fires a click.
	const openTask = useCallback(
		(id: number) => {
			if (Date.now() - lastDragEnd.current > 150) openTaskRaw(id)
		},
		[openTaskRaw],
	)

	const sensors = useSensors(
		useSensor(MouseSensor, {activationConstraint: {distance: 6}}),
		useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 8}}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
			keyboardCodes: {start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter']},
		}),
	)

	const bucketOf = useCallback(
		(id: UniqueIdentifier, list: BoardBucket[]) => {
			if (isBucketId(id)) return list.find(b => `bucket-${b.id}` === id)
			const tid = taskId(id)
			return list.find(b => b.tasks.some(t => t.id === tid))
		},
		[],
	)

	const collision: CollisionDetection = useCallback(
		args => {
			if (args.active.data.current?.type === 'bucket') {
				return closestCenter({
					...args,
					droppableContainers: args.droppableContainers.filter(c => c.data.current?.type === 'bucket'),
				})
			}
			let containers = args.droppableContainers
			if (!manual) {
				const from = args.active.data.current?.bucketId
				containers = containers.filter(c => c.data.current?.bucketId === from)
			}
			const scoped = {...args, droppableContainers: containers}
			const pointer = pointerWithin(scoped)
			const hits = pointer.length ? pointer : rectIntersection(scoped)
			const hit = hits.find(h => isTaskId(h.id)) ?? hits[0]
			if (!hit) return []
			if (isBucketId(hit.id)) {
				const bid = Number(String(hit.id).slice('bucket-'.length))
				const inBucket = containers.filter(c => c.data.current?.type === 'task' && c.data.current?.bucketId === bid)
				if (inBucket.length) return closestCenter({...args, droppableContainers: inBucket})
			}
			return [hit]
		},
		[manual],
	)

	function onDragStart(e: DragStartEvent) {
		const data = e.active.data.current
		snapshot.current = board.data
		setDragBuckets(board.data?.buckets ?? [])
		if (data?.type === 'task') setActive({type: 'task', task: data.task, from: data.bucketId})
		else if (data?.type === 'bucket') {
			const b = board.data?.buckets.find(x => x.id === data.bucketId)
			if (b) setActive({type: 'bucket', bucket: b})
		}
	}

	function onDragOver({active: a, over}: DragOverEvent) {
		if (!over || active?.type !== 'task' || !manual || !dragBuckets) return
		const from = bucketOf(a.id, dragBuckets)
		const to = bucketOf(over.id, dragBuckets)
		if (!from || !to) return
		if (collapsed.has(to.id) && dragExpanded !== to.id) setDragExpanded(to.id)
		if (from.id === to.id) return
		const original = snapshot.current?.buckets.find(b => b.id === to.id)
		if (to.id !== active.from && original && bucketFull(original)) return

		const task = from.tasks.find(t => t.id === taskId(a.id))!
		let index = to.tasks.length
		if (isTaskId(over.id)) {
			const overIndex = to.tasks.findIndex(t => `task-${t.id}` === over.id)
			const below =
				a.rect.current.translated && a.rect.current.translated.top > over.rect.top + over.rect.height / 2
			index = overIndex + (below ? 1 : 0)
		}
		setDragBuckets(
			dragBuckets.map(b => {
				if (b.id === from.id) return {...b, count: b.count - 1, tasks: b.tasks.filter(t => t.id !== task.id)}
				if (b.id === to.id) {
					const tasks = [...b.tasks]
					tasks.splice(index, 0, task)
					return {...b, count: b.count + 1, tasks}
				}
				return b
			}),
		)
	}

	function endDrag() {
		setDragBuckets(null)
		setActive(null)
		setDragExpanded(null)
		lastDragEnd.current = Date.now()
	}

	function onDragEnd({active: a, over}: DragEndEvent) {
		const list = dragBuckets
		const current = active
		endDrag()
		if (!over || !list || !current) return

		if (current.type === 'bucket') {
			const oldIndex = list.findIndex(b => `bucket-${b.id}` === a.id)
			const newIndex = list.findIndex(b => `bucket-${b.id}` === over.id)
			if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
			const ordered = arrayMove(list, oldIndex, newIndex)
			const position = calculatePosition(ordered[newIndex - 1]?.position ?? null, ordered[newIndex + 1]?.position ?? null)
			bucketMut.update.mutate({id: current.bucket.id, position})
			return
		}

		const bucket = bucketOf(a.id, list)
		if (!bucket) return
		let tasks = bucket.tasks
		const oldIndex = tasks.findIndex(t => `task-${t.id}` === a.id)
		const overIndex = isTaskId(over.id) ? tasks.findIndex(t => `task-${t.id}` === over.id) : -1
		if (overIndex >= 0 && overIndex !== oldIndex) tasks = arrayMove(tasks, oldIndex, overIndex)
		const index = tasks.findIndex(t => `task-${t.id}` === a.id)
		const moved = bucket.id !== current.from
		if (!moved && index === snapshot.current?.buckets.find(b => b.id === bucket.id)?.tasks.findIndex(t => t.id === current.task.id)) return

		const before = tasks[index - 1]
		const after = tasks[index + 1]
		const position = calculatePosition(before?.position ?? null, after?.position ?? null)
		const done = bucket.id === view.done_bucket_id ? true : current.from === view.done_bucket_id ? false : current.task.done
		const updated: Task = {...current.task, position, bucket_id: bucket.id, done}
		tasks = tasks.map(t => (t.id === updated.id ? updated : t))
		const rollback = snapshot.current
		setBoard(projectId, viewId, b => ({...b, buckets: list.map(x => (x.id === bucket.id ? {...x, tasks} : x))}))

		void (async () => {
			try {
				await persistTaskMove({
					project: projectId,
					view: viewId,
					task: updated,
					fromBucket: current.from,
					toBucket: bucket.id,
					position,
				})
				// Dropping at the top yields 0, which the next task may already hold.
				if (index === 0 && after?.position === 0) {
					await persistTaskMove({
						project: projectId,
						view: viewId,
						task: after,
						fromBucket: bucket.id,
						toBucket: bucket.id,
						position: calculatePosition(0, tasks[2]?.position ?? null),
					})
				}
			} catch (e) {
				if (rollback) queryClient.setQueryData(keys.kanban(projectId, viewId), rollback)
				toast.error(errorMessage(e))
			}
		})()
	}

	if (board.isPending) return <BoardSkeleton />
	if (board.isError) {
		return (
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyTitle>Couldn’t load the board</EmptyTitle>
					<EmptyDescription>{board.error.message}</EmptyDescription>
				</EmptyHeader>
				<Button size="sm" onClick={() => board.refetch()}>
					Retry
				</Button>
			</Empty>
		)
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<DndContext
				sensors={sensors}
				collisionDetection={collision}
				measuring={{droppable: {strategy: MeasuringStrategy.Always}}}
				onDragStart={onDragStart}
				onDragOver={onDragOver}
				onDragEnd={onDragEnd}
				onDragCancel={endDrag}
			>
				<div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto overscroll-x-contain p-4 md:px-6">
					<SortableContext
						items={buckets.map(b => `bucket-${b.id}`)}
						strategy={horizontalListSortingStrategy}
						disabled={!canEditBuckets}
					>
						{buckets.map(b => (
							<BucketColumn
								key={b.id}
								bucket={b}
								isDone={manual && view.done_bucket_id === b.id}
								isDefault={manual && view.default_bucket_id === b.id}
								collapsed={collapsed.has(b.id) && dragExpanded !== b.id}
								canWrite={canWrite && manual}
								canEditBuckets={canEditBuckets}
								canDelete={buckets.length > 1}
								dragDisabled={!canWrite}
								actions={{
									rename: title => bucketMut.update.mutate({id: b.id, title}),
									setLimit: limit => bucketMut.update.mutate({id: b.id, limit}),
									toggleDone: () =>
										viewUpdate.mutate({done_bucket_id: view.done_bucket_id === b.id ? 0 : b.id}),
									toggleDefault: () =>
										viewUpdate.mutate({default_bucket_id: view.default_bucket_id === b.id ? 0 : b.id}),
									remove: () =>
										bucketMut.remove.mutate(b.id, {onSuccess: () => toast.success(`Deleted “${b.title}”`)}),
									addTask: title =>
										createTaskInBucket(projectId, viewId, b.id, title).catch(e => toast.error(errorMessage(e))),
									loadMore: () =>
										loadBucketPage(projectId, viewId, b.id, (board.data?.pages[b.id] ?? 1) + 1).catch(e =>
											toast.error(errorMessage(e)),
										),
									toggleCollapsed: () => toggleCollapsed(b.id),
									openTask,
								}}
							/>
						))}
					</SortableContext>
					{canEditBuckets && <AddBucket onAdd={title => bucketMut.create.mutateAsync(title)} />}
					{buckets.length === 0 && !canEditBuckets && (
						<Empty className="flex-1">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<KanbanSquareIcon />
								</EmptyMedia>
								<EmptyTitle>No buckets</EmptyTitle>
								<EmptyDescription>This view has no buckets configured.</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</div>
				<DragOverlay dropAnimation={{duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)'}}>
					{active?.type === 'task' ? (
						<div className="w-[17rem]">
							<TaskCardBody task={active.task} overlay />
						</div>
					) : active?.type === 'bucket' ? (
						<div className="flex h-24 w-72 rotate-1 flex-col rounded-xl border bg-muted p-3 shadow-lg">
							<span className="text-sm font-semibold">{active.bucket.title}</span>
							<span className="text-xs text-muted-foreground">{active.bucket.count} tasks</span>
						</div>
					) : null}
				</DragOverlay>
			</DndContext>
		</div>
	)
}

function AddBucket({onAdd}: {onAdd: (title: string) => Promise<unknown>}) {
	const [open, setOpen] = useState(false)
	const [title, setTitle] = useState('')
	const [busy, setBusy] = useState(false)
	if (!open) {
		return (
			<Button
				className="h-11 w-72 shrink-0 justify-start rounded-xl border border-dashed text-muted-foreground"
				onClick={() => setOpen(true)}
			>
				<PlusIcon />
				Add bucket
			</Button>
		)
	}
	async function submit() {
		if (!title.trim() || busy) return
		setBusy(true)
		try {
			await onAdd(title.trim())
			setTitle('')
		} finally {
			setBusy(false)
		}
	}
	return (
		<div className="w-72 shrink-0 rounded-xl border bg-muted/40 p-2">
			<Input
				autoFocus
				value={title}
				readOnly={busy}
				placeholder="Bucket title, then Enter"
				className="bg-background"
				onChange={e => setTitle(e.target.value)}
				onKeyDown={e => {
					if (e.key === 'Enter') void submit()
					else if (e.key === 'Escape') setOpen(false)
				}}
				onBlur={() => !title.trim() && setOpen(false)}
			/>
		</div>
	)
}

function BoardSkeleton() {
	return (
		<div className="flex h-full gap-3 overflow-hidden p-4 md:px-6">
			{[4, 2, 3].map((n, i) => (
				<div key={i} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/40 p-2">
					<Skeleton className="m-1 h-5 w-24" />
					{Array.from({length: n}, (_, j) => (
						<Skeleton key={j} className="h-20 w-full rounded-lg" />
					))}
				</div>
			))}
		</div>
	)
}

export default KanbanView
