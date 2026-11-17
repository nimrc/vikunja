import {useMemo} from 'react'
import {Link} from 'react-router'
import {AlertTriangleIcon, ArrowRightIcon, CalendarDaysIcon, CircleDotIcon, FolderPlusIcon, SparklesIcon} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Skeleton} from '@/components/ui/skeleton'
import {ColorDot} from '@/components/color-picker'
import {projectHref} from '@/components/app-sidebar'
import {ProjectCreateDialog} from '@/components/project-create-dialog'
import {TaskQuickAdd} from '@/components/task/task-quick-add'
import {TaskRow} from '@/components/task/task-row'
import {cn} from '@/lib/utils'
import {displayName, relative, parseDate} from '@/lib/format'
import {useAllTasks, useCurrentUser, useProjects} from '@/lib/queries'

function greeting() {
	const h = new Date().getHours()
	if (h < 5) return 'Good night'
	if (h < 12) return 'Good morning'
	if (h < 18) return 'Good afternoon'
	return 'Good evening'
}

function useCount(filter: string) {
	const q = useAllTasks({filter, per_page: 1})
	return {count: q.data?.total, pending: q.isPending}
}

export default function Home() {
	const {data: user} = useCurrentUser()
	const {projects} = useProjects()
	const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
	const realProjects = projects.filter(p => (p.id ?? 0) > 0 && !p.is_archived)
	const defaultProjectId = user?.settings?.default_project_id || realProjects[0]?.id

	const overdue = useCount('done = false && due_date < now')
	const today = useCount('done = false && due_date >= now/d && due_date < now/d+1d')
	const open = useCount('done = false')

	const upNext = useAllTasks({
		filter: 'done = false && due_date < now/d+7d',
		sort_by: ['due_date', 'id'],
		order_by: ['asc', 'asc'],
		per_page: 8,
		expand: ['comment_count'],
	})
	const recent = useAllTasks({filter: 'done = false', sort_by: ['updated'], order_by: ['desc'], per_page: 6})

	const topProjects = [...realProjects]
		.filter(p => !p.parent_project_id)
		.sort((a, b) => (parseDate(b.updated)?.getTime() ?? 0) - (parseDate(a.updated)?.getTime() ?? 0))
		.slice(0, 6)

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-4 md:p-6">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">
					{greeting()}
					{user ? `, ${displayName(user)}` : ''}
				</h1>
				<p className="text-sm text-muted-foreground">Here's what's on your plate.</p>
			</div>

			{defaultProjectId && (
				<TaskQuickAdd
					projectId={defaultProjectId}
					placeholder={`Add a task to ${projectById.get(defaultProjectId)?.title ?? 'your default project'}…`}
					className="bg-card"
				/>
			)}

			<div className="grid grid-cols-3 gap-2 sm:gap-4">
				<StatCard title="Overdue" icon={AlertTriangleIcon} value={overdue.count} pending={overdue.pending} tone={overdue.count ? 'danger' : undefined} to="/tasks/upcoming" />
				<StatCard title="Due today" icon={CalendarDaysIcon} value={today.count} pending={today.pending} to="/tasks/upcoming" />
				<StatCard title="Open tasks" icon={CircleDotIcon} value={open.count} pending={open.pending} to="/projects" />
			</div>

			<div className="grid gap-6 lg:grid-cols-5">
				<Card className="lg:col-span-3">
					<CardHeader className="flex flex-row items-center justify-between">
						<div className="flex flex-col gap-1">
							<CardTitle>Up next</CardTitle>
							<CardDescription>Overdue and due within a week</CardDescription>
						</div>
						<Button variant="ghost" size="sm" asChild>
							<Link to="/tasks/upcoming">
								View all
								<ArrowRightIcon />
							</Link>
						</Button>
					</CardHeader>
					<CardContent className="px-2">
						{upNext.isPending ? (
							<ListSkeleton />
						) : upNext.data?.items?.length ? (
							upNext.data.items.map(t => <TaskRow key={t.id} task={t} project={projectById.get(t.project_id)} showProject />)
						) : (
							<Empty className="py-8">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<SparklesIcon />
									</EmptyMedia>
									<EmptyTitle>You're all caught up</EmptyTitle>
									<EmptyDescription>Nothing is due this week.</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}
					</CardContent>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Recently updated</CardTitle>
						<CardDescription>Open tasks you or others touched last</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col px-2">
						{recent.isPending ? (
							<ListSkeleton />
						) : (
							recent.data?.items?.map(t => (
								<TaskRow key={t.id} task={t} project={projectById.get(t.project_id)} showProject />
							))
						)}
					</CardContent>
				</Card>
			</div>

			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold tracking-tight">Projects</h2>
					<div className="flex gap-1">
						<ProjectCreateDialog>
							<Button variant="outline" size="sm">
								<FolderPlusIcon />
								New project
							</Button>
						</ProjectCreateDialog>
						<Button variant="ghost" size="sm" asChild>
							<Link to="/projects">
								All projects
								<ArrowRightIcon />
							</Link>
						</Button>
					</div>
				</div>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{topProjects.map(p => (
						<Link
							key={p.id}
							to={projectHref(p)}
							className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
						>
							<div className="flex items-center gap-2">
								<ColorDot color={p.hex_color} className="size-3" />
								<span className="truncate font-medium">{p.title}</span>
								<ArrowRightIcon className="ml-auto size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
							</div>
							<span className="text-xs text-muted-foreground">
								Updated {parseDate(p.updated) ? relative(parseDate(p.updated)!) : '—'}
							</span>
						</Link>
					))}
				</div>
			</section>
		</div>
	)
}

function StatCard({
	title,
	icon: Icon,
	value,
	pending,
	tone,
	to,
}: {
	title: string
	icon: React.ComponentType<{className?: string}>
	value?: number
	pending: boolean
	tone?: 'danger'
	to: string
}) {
	return (
		<Link to={to} className="group">
			<Card className="gap-1 py-4 transition-colors group-hover:bg-muted/40 sm:gap-2 sm:py-5">
				<CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6">
					<CardDescription className="truncate">{title}</CardDescription>
					<Icon className={cn('hidden size-4 text-muted-foreground sm:block', tone === 'danger' && 'text-destructive')} />
				</CardHeader>
				<CardContent className="px-4 sm:px-6">
					{pending ? (
						<Skeleton className="h-8 w-12" />
					) : (
						<span className={cn('text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl', tone === 'danger' && 'text-destructive')}>
							{value ?? 0}
						</span>
					)}
				</CardContent>
			</Card>
		</Link>
	)
}

function ListSkeleton() {
	return (
		<div className="flex flex-col gap-2 px-2">
			{Array.from({length: 4}, (_, i) => (
				<Skeleton key={i} className="h-10 w-full" />
			))}
		</div>
	)
}
