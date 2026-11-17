import {keepPreviousData, QueryClient, queryOptions, useQuery} from '@tanstack/react-query'
import {toast} from 'sonner'
import {
	labelsList,
	projectsList,
	projectsRead,
	tasksList,
	tasksRead,
	userShow,
	type Label,
	type Project,
	type Task,
	type TasksListData,
} from '@/client/generated'
import {ApiError} from '@/lib/api'

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
			refetchOnWindowFocus: true,
		},
		mutations: {
			onError: e => toast.error(e.message),
		},
	},
})

export type TaskQuery = NonNullable<TasksListData['query']>

export const keys = {
	user: ['user'] as const,
	projects: ['projects'] as const,
	project: (id: number) => ['project', id] as const,
	tasks: ['tasks'] as const,
	taskList: (scope: string, params: object) => ['tasks', 'list', scope, params] as const,
	task: (id: number) => ['tasks', 'detail', id] as const,
	labels: ['labels'] as const,
	kanban: (project: number, view: number) => ['tasks', 'kanban', project, view] as const,
}

export const currentUserQuery = () =>
	queryOptions({
		queryKey: keys.user,
		queryFn: async ({signal}) => (await userShow({signal})).data,
		staleTime: 5 * 60_000,
	})

export function useCurrentUser() {
	return useQuery(currentUserQuery())
}

// Paginate through everything: the sidebar and pickers need the whole tree.
async function fetchAll<T>(
	fetchPage: (page: number) => Promise<{items?: T[] | null; total_pages?: number}>,
): Promise<T[]> {
	const out: T[] = []
	for (let page = 1; ; page++) {
		const res = await fetchPage(page)
		out.push(...(res.items ?? []))
		if (!res.total_pages || page >= res.total_pages) return out
	}
}

export const projectsQuery = () =>
	queryOptions({
		queryKey: keys.projects,
		queryFn: ({signal}) =>
			fetchAll<Project>(async page =>
				(await projectsList({query: {page, is_archived: true, expand: 'permissions'}, signal})).data,
			),
	})

export function useProjects() {
	const q = useQuery(projectsQuery())
	return {...q, projects: q.data ?? []}
}

export function useProject(id: number) {
	return useQuery({
		queryKey: keys.project(id),
		queryFn: async ({signal}) => (await projectsRead({path: {id}, signal})).data,
		enabled: id > 0,
	})
}

export function useLabels() {
	const q = useQuery({
		queryKey: keys.labels,
		queryFn: ({signal}) => fetchAll<Label>(async page => (await labelsList({query: {page}, signal})).data),
	})
	return {...q, labels: q.data ?? []}
}

export function useTask(id: number) {
	return useQuery({
		queryKey: keys.task(id),
		queryFn: async ({signal}) =>
			(await tasksRead({path: {task: id}, query: {expand: ['comments', 'reactions', 'buckets']}, signal})).data,
		enabled: id > 0,
	})
}

/** Tasks across all projects (overview, upcoming, search). */
export function useAllTasks(params: TaskQuery, enabled = true) {
	return useQuery({
		queryKey: keys.taskList('all', params),
		queryFn: async ({signal}) => (await tasksList({query: params, signal})).data,
		placeholderData: keepPreviousData,
		enabled,
	})
}

export function invalidateTasks() {
	return queryClient.invalidateQueries({queryKey: keys.tasks})
}

export function invalidateProjects() {
	return Promise.all([
		queryClient.invalidateQueries({queryKey: keys.projects}),
		queryClient.invalidateQueries({queryKey: ['project']}),
	])
}

/** Patch a task everywhere it is cached so views update without a refetch. */
export function patchCachedTask(task: Task) {
	queryClient.setQueriesData({queryKey: keys.tasks}, (old: unknown) => patchDeep(old, task))
}

function patchDeep(value: unknown, task: Task): unknown {
	if (Array.isArray(value)) return value.map(v => patchDeep(v, task))
	if (value && typeof value === 'object') {
		const obj = value as Record<string, unknown>
		if (typeof obj.id === 'number' && obj.id === task.id && 'title' in obj && 'project_id' in obj) {
			return {...obj, ...task}
		}
		let changed = false
		const next: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(obj)) {
			const nv = patchDeep(v, task)
			if (nv !== v) changed = true
			next[k] = nv
		}
		return changed ? next : value
	}
	return value
}
