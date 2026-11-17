import {lazy, Suspense, useEffect, useMemo} from 'react'
import {Link, Navigate, useNavigate, useParams} from 'react-router'
import {
	ArchiveIcon,
	FilterIcon,
	GanttChartIcon,
	KanbanSquareIcon,
	ListIcon,
	MoreHorizontalIcon,
	StarIcon,
	Table2Icon,
} from 'lucide-react'
import type {ProjectView} from '@/client/generated'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Empty, EmptyDescription, EmptyHeader, EmptyTitle} from '@/components/ui/empty'
import {Skeleton} from '@/components/ui/skeleton'
import {Tooltip} from '@/components/ui/tooltip'
import {ColorDot} from '@/components/color-picker'
import {PageSpinner} from '@/components/page-spinner'
import {ProjectActionsMenu, useToggleFavorite} from '@/components/project-actions'
import {cn} from '@/lib/utils'
import {isSavedFilter} from '@/lib/format'
import {useProject, useProjects} from '@/lib/queries'
import {ListView} from './list-view'
import {TableView} from './table-view'

const KanbanView = lazy(() => import('./kanban-view').then(m => ({default: m.KanbanView})))
const GanttView = lazy(() => import('./gantt-view').then(m => ({default: m.GanttView})))

const VIEW_ICON = {list: ListIcon, table: Table2Icon, kanban: KanbanSquareIcon, gantt: GanttChartIcon}

const LAST_VIEW_KEY = 'lastProjectView'

function rememberView(projectId: number, viewId: number) {
	try {
		const all = JSON.parse(localStorage.getItem(LAST_VIEW_KEY) ?? '{}')
		all[projectId] = viewId
		localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(all))
	} catch {
		// per-browser convenience only
	}
}

function lastView(projectId: number): number | undefined {
	try {
		return JSON.parse(localStorage.getItem(LAST_VIEW_KEY) ?? '{}')[projectId]
	} catch {
		return undefined
	}
}

export default function ProjectPage() {
	const params = useParams()
	const projectId = Number(params.projectId)
	const viewId = params.viewId ? Number(params.viewId) : undefined
	const navigate = useNavigate()
	const {projects} = useProjects()
	// Pseudo projects (favorites, saved filters) have no detail endpoint: read them from the list.
	const listed = projects.find(p => p.id === projectId)
	const detail = useProject(projectId)
	const project = projectId > 0 ? detail.data : listed
	const toggleFavorite = useToggleFavorite()

	const views = useMemo(
		() => [...(project?.views ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
		[project?.views],
	)
	const view = views.find(v => v.id === viewId)

	useEffect(() => {
		if (project?.title) document.title = `${project.title} · Vikunja`
		return () => {
			document.title = 'Vikunja'
		}
	}, [project?.title])

	useEffect(() => {
		if (view?.id) rememberView(projectId, view.id)
	}, [projectId, view?.id])

	if (detail.isError && projectId > 0) {
		return (
			<Empty className="m-6">
				<EmptyHeader>
					<EmptyTitle>Project not found</EmptyTitle>
					<EmptyDescription>It may have been deleted, or you no longer have access.</EmptyDescription>
				</EmptyHeader>
				<Button onClick={() => navigate('/projects')}>
					All projects
				</Button>
			</Empty>
		)
	}

	if (!project) return <ProjectSkeleton />

	if (!view && views.length) {
		const remembered = lastView(projectId)
		const target = views.find(v => v.id === remembered) ?? views[0]
		return <Navigate to={`/projects/${projectId}/${target.id}`} replace />
	}

	const filter = isSavedFilter(project)

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="border-b px-4 pt-4 md:px-6 md:pt-5">
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							{filter ? (
								<FilterIcon className="size-5 text-muted-foreground" />
							) : (
								<ColorDot color={project.hex_color} className="size-3" />
							)}
							<h1 className="truncate text-2xl font-semibold tracking-tight">{project.title}</h1>
							{project.is_archived && (
								<Badge tone="neutral" className="gap-1">
									<ArchiveIcon className="size-3" />
									Archived
								</Badge>
							)}
						</div>
						{project.description && project.description !== '<p></p>' && (
							<div
								className="mt-1 line-clamp-1 max-w-3xl text-sm text-muted-foreground [&_*]:inline"
								dangerouslySetInnerHTML={{__html: project.description}}
							/>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-1">
						{!filter && projectId > 0 && (
							<Tooltip
								label={project.is_favorite ? 'Unfavorite' : 'Favorite'}
								render={<Button round onClick={() => toggleFavorite(project)} />}
							>
								<StarIcon className={cn(project.is_favorite && 'fill-amber-400 text-amber-400')} />
							</Tooltip>
						)}
						{projectId !== -1 && (
							<ProjectActionsMenu project={project}>
								<Button round aria-label="Project actions">
									<MoreHorizontalIcon />
								</Button>
							</ProjectActionsMenu>
						)}
					</div>
				</div>
				<nav className="-mb-px mt-3 flex gap-1 overflow-x-auto">
					{views.map(v => (
						<ViewTab key={v.id} view={v} projectId={projectId} active={v.id === view?.id} />
					))}
				</nav>
			</div>
			{view && (
				<Suspense fallback={<PageSpinner />}>
					<ViewBody key={view.id} project={project} view={view} />
				</Suspense>
			)}
			{!views.length && (
				<Empty className="m-6">
					<EmptyHeader>
						<EmptyTitle>No views</EmptyTitle>
						<EmptyDescription>This project has no views yet.</EmptyDescription>
					</EmptyHeader>
					<Button render={<Link to={`/projects/${projectId}/settings/views`} />}>Manage views</Button>
				</Empty>
			)}
		</div>
	)
}

function ViewTab({view, projectId, active}: {view: ProjectView; projectId: number; active: boolean}) {
	const Icon = VIEW_ICON[view.view_kind ?? 'list'] ?? ListIcon
	return (
		<Link
			to={`/projects/${projectId}/${view.id}`}
			className={cn(
				'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-1 text-sm font-medium transition-colors',
				active
					? 'border-foreground text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground',
			)}
		>
			<Icon className="size-4" />
			{view.title}
		</Link>
	)
}

function ViewBody({project, view}: {project: NonNullable<ReturnType<typeof useProject>['data']>; view: ProjectView}) {
	switch (view.view_kind) {
		case 'kanban':
			return <KanbanView project={project} view={view} />
		case 'gantt':
			return <GanttView project={project} view={view} />
		case 'table':
			return <TableView project={project} view={view} />
		default:
			return <ListView project={project} view={view} />
	}
}

function ProjectSkeleton() {
	return (
		<div className="flex flex-col gap-4 p-4 md:p-6">
			<Skeleton className="h-8 w-64" />
			<div className="flex gap-3">
				{Array.from({length: 4}, (_, i) => (
					<Skeleton key={i} className="h-6 w-20" />
				))}
			</div>
			<div className="mt-4 flex flex-col gap-2">
				{Array.from({length: 6}, (_, i) => (
					<Skeleton key={i} className="h-11 w-full" />
				))}
			</div>
		</div>
	)
}
