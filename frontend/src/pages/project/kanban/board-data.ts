import {useMutation} from '@tanstack/react-query'
import {
	bucketsCreate,
	bucketsDelete,
	bucketsUpdate,
	projectViewBucketsTasksList,
	projectViewsUpdate,
	projectViewTasksList,
	taskBucketUpdate,
	tasksCreate,
	tasksPositionUpdate,
	type Bucket,
	type Project,
	type ProjectView,
	type Task,
} from '@/client/generated'
import {invalidateProjects, keys, patchCachedTask, queryClient} from '@/lib/queries'

export const TASKS_PER_BUCKET = 25
const TASK_EXPAND: Array<'comment_count' | 'is_unread'> = ['comment_count', 'is_unread']

export type BoardBucket = {
	id: number
	title: string
	count: number
	limit: number
	position: number
	tasks: Task[]
}

export type BoardData = {buckets: BoardBucket[]; pages: Record<number, number>}

export function normalizeBucket(b: Bucket): BoardBucket {
	return {
		id: b.id ?? 0,
		title: b.title ?? '',
		count: b.count ?? 0,
		limit: b.limit ?? 0,
		position: b.position ?? 0,
		tasks: b.tasks ?? [],
	}
}

export function boardQuery(project: number, view: number) {
	return {
		queryKey: keys.kanban(project, view),
		queryFn: async ({signal}: {signal: AbortSignal}): Promise<BoardData> => {
			const {data} = await projectViewBucketsTasksList({
				path: {project, view},
				query: {per_page: TASKS_PER_BUCKET, expand: TASK_EXPAND},
				signal,
			})
			const buckets = (data.items ?? []).map(normalizeBucket).sort((a, b) => a.position - b.position)
			return {buckets, pages: Object.fromEntries(buckets.map(b => [b.id, 1]))}
		},
	}
}

export const bucketHasMore = (b: BoardBucket) => b.tasks.length < b.count
export const bucketFull = (b: BoardBucket) => b.limit > 0 && b.count >= b.limit

// Matches the backend's MinPositionSpacing; positions are midpoints between neighbours.
const MIN_POSITION_SPACING = 0.01
export function calculatePosition(before: number | null, after: number | null): number {
	if (before !== null && after !== null && before === after) return after + MIN_POSITION_SPACING
	if (before === null) return after === null ? 0 : after / 2
	if (after === null) return before + 2 ** 16
	return before + (after - before) / 2
}

export function setBoard(project: number, view: number, fn: (b: BoardData) => BoardData) {
	queryClient.setQueryData<BoardData>(keys.kanban(project, view), old => (old ? fn(old) : old))
}

export function getBoard(project: number, view: number) {
	return queryClient.getQueryData<BoardData>(keys.kanban(project, view))
}

function invalidateBoard(project: number, view: number) {
	return queryClient.invalidateQueries({queryKey: keys.kanban(project, view)})
}

export async function loadBucketPage(project: number, view: number, bucket: number, page: number) {
	const {data} = await projectViewTasksList({
		path: {project, view},
		query: {
			page,
			per_page: TASKS_PER_BUCKET,
			sort_by: ['position'],
			order_by: ['asc'],
			filter: `bucket_id = ${bucket}`,
			expand: TASK_EXPAND,
		},
	})
	setBoard(project, view, b => {
		if ((b.pages[bucket] ?? 1) !== page - 1) return b
		return {
			...b,
			buckets: b.buckets.map(x =>
				x.id === bucket
					? {...x, tasks: [...x.tasks, ...(data.items ?? []).filter(t => !x.tasks.some(o => o.id === t.id))]}
					: x,
			),
			pages: {...b.pages, [bucket]: page},
		}
	})
}

type Ctx = {project: number; view: number}

export function useBucketMutations({project, view}: Ctx) {
	const create = useMutation({
		mutationFn: async (title: string) => (await bucketsCreate({path: {project, view}, body: {title}})).data,
		onSuccess: bucket => {
			const created = normalizeBucket(bucket)
			setBoard(project, view, b => ({...b, buckets: [...b.buckets, created], pages: {...b.pages, [created.id]: 1}}))
		},
	})

	// PUT replaces the bucket, so untouched fields come from the cache.
	const update = useMutation({
		mutationFn: async ({id, ...patch}: {id: number} & Partial<Pick<BoardBucket, 'title' | 'limit' | 'position'>>) => {
			const cur = getBoard(project, view)?.buckets.find(b => b.id === id)
			const body = {title: cur?.title, limit: cur?.limit, position: cur?.position, ...patch}
			return (await bucketsUpdate({path: {project, view, bucket: id}, body})).data
		},
		onMutate: ({id, ...patch}) => {
			const snapshot = getBoard(project, view)
			setBoard(project, view, b => ({
				...b,
				buckets: b.buckets.map(x => (x.id === id ? {...x, ...patch} : x)).sort((a, c) => a.position - c.position),
			}))
			return {snapshot}
		},
		onError: (_e, _v, ctx) => {
			if (ctx?.snapshot) queryClient.setQueryData(keys.kanban(project, view), ctx.snapshot)
		},
		onSuccess: saved =>
			setBoard(project, view, b => ({
				...b,
				buckets: b.buckets
					.map(x =>
						x.id === saved.id
							? {...x, title: saved.title ?? x.title, limit: saved.limit ?? 0, position: saved.position ?? x.position}
							: x,
					)
					.sort((a, c) => a.position - c.position),
			})),
	})

	const remove = useMutation({
		mutationFn: async (id: number) => {
			await bucketsDelete({path: {project, view, bucket: id}})
		},
		onSuccess: (_d, id) => setBoard(project, view, b => ({...b, buckets: b.buckets.filter(x => x.id !== id)})),
		// Tasks fall back into the default bucket and the view may lose its done/default bucket.
		onSettled: () => Promise.all([invalidateBoard(project, view), invalidateProjects()]),
	})

	return {create, update, remove}
}

export function useViewUpdate(project: Project, view: ProjectView) {
	return useMutation({
		mutationFn: async (changes: Partial<ProjectView>) => {
			const next = {...view, ...changes}
			const body = {
				title: next.title,
				view_kind: next.view_kind,
				filter: next.filter,
				position: next.position,
				bucket_configuration_mode: next.bucket_configuration_mode,
				bucket_configuration: next.bucket_configuration,
				default_bucket_id: next.default_bucket_id ?? 0,
				done_bucket_id: next.done_bucket_id ?? 0,
			}
			return (await projectViewsUpdate({path: {project: project.id!, view: view.id!}, body})).data
		},
		onMutate: changes => patchProjectView(project.id!, view.id!, changes),
		onError: () => patchProjectView(project.id!, view.id!, view),
		onSettled: () => invalidateProjects(),
	})
}

function patchProjectView(projectId: number, viewId: number, changes: Partial<ProjectView>) {
	const apply = (p?: Project) =>
		p && {...p, views: p.views?.map(v => (v.id === viewId ? {...v, ...changes} : v))}
	queryClient.setQueryData<Project>(keys.project(projectId), apply)
	queryClient.setQueryData<Project[]>(keys.projects, list => list?.map(p => (p.id === projectId ? apply(p)! : p)))
}

export async function createTaskInBucket(project: number, view: number, bucket: number, title: string) {
	const {data: task} = await tasksCreate({path: {project}, body: {title, bucket_id: bucket, project_id: project}})
	setBoard(project, view, b => ({
		...b,
		buckets: b.buckets.map(x =>
			// The server places new tasks at the top of their bucket.
			x.id === (task.bucket_id || bucket) ? {...x, count: x.count + 1, tasks: [task, ...x.tasks]} : x,
		),
	}))
	return task
}

/** Persists a drop: bucket change first (server may mark done / redirect), then the position. */
export async function persistTaskMove({
	project,
	view,
	task,
	fromBucket,
	toBucket,
	position,
}: Ctx & {task: Task; fromBucket: number; toBucket: number; position: number}) {
	if (fromBucket !== toBucket) {
		const {data} = await taskBucketUpdate({path: {project, view, bucket: toBucket}, body: {task_id: task.id}})
		if (data.task) patchCachedTask(data.task)
		// Done state may have changed; refresh other views but leave this board alone mid-interaction.
		void queryClient.invalidateQueries({queryKey: keys.tasks, predicate: q => q.queryKey[1] !== 'kanban'})
		if (data.bucket_id && data.bucket_id !== toBucket) {
			await invalidateBoard(project, view)
			return
		}
	}
	const {data} = await tasksPositionUpdate({path: {task: task.id!}, body: {position, project_view_id: view}})
	setBoard(project, view, b => ({
		...b,
		buckets: b.buckets.map(x => ({
			...x,
			tasks: x.tasks.map(t => (t.id === task.id ? {...t, position: data.position ?? position} : t)),
		})),
	}))
}
