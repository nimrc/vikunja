import {useDeferredValue, useMemo} from 'react'
import {useSearchParams} from 'react-router'
import {SearchIcon} from 'lucide-react'
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group'
import {Skeleton} from '@/components/ui/skeleton'
import {TaskRow} from '@/components/task/task-row'
import {useAllTasks, useProjects} from '@/lib/queries'

export default function Search() {
	const [params, setParams] = useSearchParams()
	const raw = params.get('q') ?? ''
	const q = useDeferredValue(raw.trim())
	const tasks = useAllTasks({q, per_page: 50, sort_by: ['done', 'id'], order_by: ['asc', 'desc']}, q.length > 0)
	const {projects} = useProjects()
	const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
			<h1 className="text-2xl font-semibold tracking-tight">Search</h1>
			<InputGroup className="h-10">
				<InputGroupAddon>
					<SearchIcon />
				</InputGroupAddon>
				<InputGroupInput
					autoFocus
					placeholder="Search tasks by title or description…"
					value={raw}
					onChange={e => setParams(e.target.value ? {q: e.target.value} : {}, {replace: true})}
				/>
			</InputGroup>
			{!q ? null : tasks.isPending ? (
				<div className="flex flex-col gap-2">
					{Array.from({length: 4}, (_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			) : tasks.data?.items?.length ? (
				<div className="flex flex-col gap-2">
					<p className="text-sm text-muted-foreground tabular-nums">{tasks.data.total} results</p>
					<div className="flex flex-col rounded-xl border bg-card p-1">
						{tasks.data.items.map(t => (
							<TaskRow key={t.id} task={t} project={projectById.get(t.project_id)} showProject />
						))}
					</div>
				</div>
			) : (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<SearchIcon />
						</EmptyMedia>
						<EmptyTitle>No results</EmptyTitle>
						<EmptyDescription>Nothing matches “{q}”.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</div>
	)
}
