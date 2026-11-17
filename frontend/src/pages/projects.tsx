import {useMemo, useState} from 'react'
import {Link} from 'react-router'
import {ArchiveIcon, FilterIcon, FolderKanbanIcon, MoreHorizontalIcon, PlusIcon, SearchIcon, StarIcon} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group'
import {Skeleton} from '@/components/ui/skeleton'
import {Switch} from '@/components/ui/switch'
import {ColorDot} from '@/components/color-picker'
import {projectHref} from '@/components/app-sidebar'
import {ProjectActionsMenu} from '@/components/project-actions'
import {ProjectCreateDialog} from '@/components/project-create-dialog'
import {cn} from '@/lib/utils'
import {cssColor, projectTree, type ProjectNode} from '@/lib/format'
import {useProjects} from '@/lib/queries'

export default function Projects() {
	const {projects, isPending} = useProjects()
	const [showArchived, setShowArchived] = useState(false)
	const [search, setSearch] = useState('')

	const tree = useMemo(() => {
		const real = projects.filter(p => (p.id ?? 0) > 0)
		const q = search.trim().toLowerCase()
		if (q) {
			return real
				.filter(p => (showArchived || !p.is_archived) && p.title?.toLowerCase().includes(q))
				.map(p => ({...p, id: p.id!, children: []}) as ProjectNode)
		}
		return projectTree(real, showArchived)
	}, [projects, showArchived, search])

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
					<p className="text-sm text-muted-foreground">Everything you have access to.</p>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Switch label="Show archived" checked={showArchived} onCheckedChange={setShowArchived} />
					<InputGroup className="w-48">
						<InputGroupAddon>
							<SearchIcon />
						</InputGroupAddon>
						<InputGroupInput placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
					</InputGroup>
					<Button render={<Link to="/filters/new" />}>
						<FilterIcon />
						New filter
					</Button>
					<ProjectCreateDialog>
						<Button tone="primary">
							<PlusIcon />
							New project
						</Button>
					</ProjectCreateDialog>
				</div>
			</div>

			{isPending ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({length: 6}, (_, i) => (
						<Skeleton key={i} className="h-36 rounded-xl" />
					))}
				</div>
			) : tree.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FolderKanbanIcon />
						</EmptyMedia>
						<EmptyTitle>No projects</EmptyTitle>
						<EmptyDescription>{search ? 'Nothing matches your search.' : 'Create a project to get started.'}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{tree.map(p => (
						<ProjectCard key={p.id} project={p} />
					))}
				</div>
			)}
		</div>
	)
}

function ProjectCard({project}: {project: ProjectNode}) {
	const color = cssColor(project.hex_color)
	return (
		<div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
			<div
				className={cn('h-16 w-full', !color && 'bg-muted')}
				style={color ? {background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, transparent))`} : undefined}
			/>
			<Link to={projectHref(project)} className="absolute inset-0" aria-label={project.title} />
			<div className="flex flex-1 flex-col gap-2 p-4">
				<div className="flex items-center gap-2">
					<span className="truncate font-medium">{project.title}</span>
					{project.is_favorite && <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
					{project.is_archived && (
						<Badge tone="neutral" className="gap-1">
							<ArchiveIcon className="size-3" />
							Archived
						</Badge>
					)}
				</div>
				{project.description && project.description !== '<p></p>' && (
					<div
						className="line-clamp-2 text-sm text-muted-foreground [&_*]:inline"
						dangerouslySetInnerHTML={{__html: project.description}}
					/>
				)}
				{project.children.length > 0 && (
					<div className="relative z-10 mt-auto flex flex-wrap gap-1.5 pt-1">
						{project.children.map(c => (
							<Link
								key={c.id}
								to={projectHref(c)}
								className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs hover:bg-muted"
							>
								<ColorDot color={c.hex_color} className="size-2" />
								{c.title}
							</Link>
						))}
					</div>
				)}
			</div>
			<div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
				<ProjectActionsMenu project={project}>
					<Button
						round
						className="shadow-sm"
						aria-label="Project actions"
					>
						<MoreHorizontalIcon />
					</Button>
				</ProjectActionsMenu>
			</div>
		</div>
	)
}
