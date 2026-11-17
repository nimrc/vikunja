import {lazy, Suspense, useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'
import {Link, NavLink, Route, Routes, useNavigate, useParams} from 'react-router'
import {toast} from 'sonner'
import {ArrowLeftIcon, GanttChartIcon, KanbanSquareIcon, ListIcon, PencilIcon, PlusIcon, Table2Icon, Trash2Icon} from 'lucide-react'
import {
	filtersRead,
	filtersUpdate,
	projectViewsCreate,
	projectViewsDelete,
	projectViewsUpdate,
	type Project,
	type ProjectView,
	type SavedFilter,
} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card'
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Field, FieldDescription, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Skeleton} from '@/components/ui/skeleton'
import {Spinner} from '@/components/ui/spinner'
import {Switch} from '@/components/ui/switch'
import {Textarea} from '@/components/ui/textarea'
import {ColorPicker} from '@/components/color-picker'
import {ConfirmDialog} from '@/components/confirm-dialog'
import {RichTextEditor} from '@/components/editor'
import {PageSpinner} from '@/components/page-spinner'
import {filterIdOf, useUpdateProject} from '@/components/project-actions'
import {ProjectSelect} from '@/components/project-select'
import {projectHref} from '@/components/app-sidebar'
import {cn} from '@/lib/utils'
import {isSavedFilter} from '@/lib/format'
import {invalidateProjects, invalidateTasks, keys, queryClient, useProject, useProjects} from '@/lib/queries'

const ProjectSharing = lazy(() => import('@/components/project-sharing').then(m => ({default: m.ProjectSharing})))

export default function ProjectSettings() {
	const projectId = Number(useParams().projectId)
	const {projects} = useProjects()
	const detail = useProject(projectId)
	const project = projectId > 0 ? detail.data : projects.find(p => p.id === projectId)
	const filter = projectId < -1

	if (!project) return <PageSpinner />

	const tabs = filter
		? [{to: '', label: 'Filter'}, {to: 'views', label: 'Views'}]
		: [
				{to: '', label: 'General'},
				{to: 'views', label: 'Views'},
				...((project.max_permission ?? 0) >= 2 ? [{to: 'share', label: 'Sharing'}] : []),
			]

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-3">
				<Button variant="ghost" size="sm" asChild className="-ml-2 w-fit text-muted-foreground">
					<Link to={projectHref(project)}>
						<ArrowLeftIcon />
						{project.title}
					</Link>
				</Button>
				<h1 className="text-2xl font-semibold tracking-tight">{filter ? 'Filter settings' : 'Project settings'}</h1>
				<nav className="flex gap-1 border-b">
					{tabs.map(t => (
						<NavLink
							key={t.to}
							to={`/projects/${projectId}/settings${t.to ? `/${t.to}` : ''}`}
							end
							className={({isActive}) =>
								cn(
									'-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition-colors',
									isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
								)
							}
						>
							{t.label}
						</NavLink>
					))}
				</nav>
			</div>
			<Routes>
				<Route index element={filter ? <FilterForm projectId={projectId} /> : <GeneralForm key={project.id} project={project} />} />
				<Route path="views" element={<ViewsManager project={project} />} />
				<Route
					path="share"
					element={
						<Suspense fallback={<PageSpinner />}>
							<ProjectSharing projectId={projectId} />
						</Suspense>
					}
				/>
				{/* Old Vue URLs */}
				<Route path="edit" element={filter ? <FilterForm projectId={projectId} /> : <GeneralForm key={project.id} project={project} />} />
			</Routes>
		</div>
	)
}

function GeneralForm({project}: {project: Project}) {
	const [title, setTitle] = useState(project.title ?? '')
	const [identifier, setIdentifier] = useState(project.identifier ?? '')
	const [description, setDescription] = useState(project.description ?? '')
	const [color, setColor] = useState(project.hex_color ?? '')
	const [parent, setParent] = useState<number | null>(project.parent_project_id || null)
	const update = useUpdateProject()
	const canEdit = (project.max_permission ?? 0) >= 1

	const save = () =>
		update.mutate(
			{
				project,
				changes: {title: title.trim(), identifier: identifier.trim(), description, hex_color: color, parent_project_id: parent ?? 0},
			},
			{
				onSuccess: p => {
					queryClient.setQueryData(keys.project(p.id!), p)
					toast.success('Project saved')
				},
			},
		)

	return (
		<Card>
			<CardHeader>
				<CardTitle>General</CardTitle>
				<CardDescription>Name, identifier and appearance.</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
						<Field>
							<FieldLabel htmlFor="p-title">Title</FieldLabel>
							<Input id="p-title" value={title} disabled={!canEdit} onChange={e => setTitle(e.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor="p-ident">Identifier</FieldLabel>
							<Input
								id="p-ident"
								value={identifier}
								maxLength={10}
								disabled={!canEdit}
								onChange={e => setIdentifier(e.target.value.toUpperCase())}
								placeholder="e.g. HOME"
							/>
						</Field>
					</div>
					<FieldDescription className="-mt-4">The identifier prefixes task numbers, like HOME-12.</FieldDescription>
					<Field>
						<FieldLabel>Parent project</FieldLabel>
						<ProjectSelect value={parent} onChange={setParent} allowNone noneLabel="None (top level)" excludeId={project.id} />
					</Field>
					<Field>
						<FieldLabel>Color</FieldLabel>
						<ColorPicker value={color} onChange={setColor} />
					</Field>
					<Field>
						<FieldLabel>Description</FieldLabel>
						<RichTextEditor
							value={description}
							onSave={html => setDescription(html)}
							readOnly={!canEdit}
							placeholder="What is this project about?"
							emptyText="No description. Click to add one."
							saveLabel="Done"
							className="rounded-lg border p-3"
						/>
					</Field>
				</FieldGroup>
			</CardContent>
			{canEdit && (
				<CardFooter className="justify-end border-t">
					<Button onClick={save} disabled={!title.trim() || update.isPending}>
						{update.isPending && <Spinner />}
						Save changes
					</Button>
				</CardFooter>
			)}
		</Card>
	)
}

function FilterForm({projectId}: {projectId: number}) {
	const filterId = filterIdOf(projectId)
	const query = useQuery({
		queryKey: ['filter', filterId],
		queryFn: async ({signal}) => (await filtersRead({path: {filter: filterId}, signal})).data,
	})
	if (!query.data) return <Skeleton className="h-80 w-full rounded-xl" />
	return <FilterEditor key={filterId} filter={query.data} filterId={filterId} />
}

export function FilterFields({
	value,
	onChange,
}: {
	value: {title: string; description: string; filter: string; includeNulls: boolean}
	onChange: (v: {title: string; description: string; filter: string; includeNulls: boolean}) => void
}) {
	return (
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="f-title">Title</FieldLabel>
				<Input id="f-title" value={value.title} onChange={e => onChange({...value, title: e.target.value})} />
			</Field>
			<Field>
				<FieldLabel htmlFor="f-query">Filter query</FieldLabel>
				<Textarea
					id="f-query"
					className="font-mono text-sm"
					rows={3}
					value={value.filter}
					onChange={e => onChange({...value, filter: e.target.value})}
					placeholder="done = false && priority >= 3 && labels in bug"
				/>
				<FieldDescription>
					Fields: done, priority, due_date, start_date, end_date, labels, assignees, project, percent_done… Operators: = != &gt; &gt;= &lt; &lt;= like in,
					joined with &amp;&amp; and ||. Dates accept now, now/d, now+7d.
				</FieldDescription>
			</Field>
			<Field orientation="horizontal">
				<Switch id="f-nulls" checked={value.includeNulls} onCheckedChange={v => onChange({...value, includeNulls: v})} />
				<FieldLabel htmlFor="f-nulls" className="font-normal">
					Include tasks where the filtered field is empty
				</FieldLabel>
			</Field>
			<Field>
				<FieldLabel htmlFor="f-desc">Description</FieldLabel>
				<Textarea id="f-desc" value={value.description} onChange={e => onChange({...value, description: e.target.value})} />
			</Field>
		</FieldGroup>
	)
}

function FilterEditor({filter, filterId}: {filter: SavedFilter; filterId: number}) {
	const [value, setValue] = useState({
		title: filter.title ?? '',
		description: filter.description ?? '',
		filter: filter.filters?.filter ?? '',
		includeNulls: !!filter.filters?.filter_include_nulls,
	})
	const save = useMutation({
		mutationFn: async () =>
			(
				await filtersUpdate({
					path: {filter: filterId},
					body: {
						title: value.title.trim(),
						description: value.description,
						is_favorite: filter.is_favorite,
						filters: {...filter.filters, filter: value.filter, filter_include_nulls: value.includeNulls},
					},
				})
			).data,
		onSuccess: async () => {
			await Promise.all([invalidateProjects(), invalidateTasks(), queryClient.invalidateQueries({queryKey: ['filter', filterId]})])
			toast.success('Filter saved')
		},
	})
	return (
		<Card>
			<CardHeader>
				<CardTitle>Saved filter</CardTitle>
				<CardDescription>A saved filter shows matching tasks from all your projects.</CardDescription>
			</CardHeader>
			<CardContent>
				<FilterFields value={value} onChange={setValue} />
			</CardContent>
			<CardFooter className="justify-end border-t">
				<Button onClick={() => save.mutate()} disabled={!value.title.trim() || save.isPending}>
					{save.isPending && <Spinner />}
					Save filter
				</Button>
			</CardFooter>
		</Card>
	)
}

const KIND_ICON = {list: ListIcon, table: Table2Icon, kanban: KanbanSquareIcon, gantt: GanttChartIcon}
const KINDS = ['list', 'table', 'kanban', 'gantt'] as const

function ViewsManager({project}: {project: Project}) {
	const views = [...(project.views ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
	const [editing, setEditing] = useState<ProjectView | 'new' | null>(null)
	const [deleting, setDeleting] = useState<ProjectView | null>(null)
	const canAdmin = isSavedFilter(project) || (project.max_permission ?? 0) >= 2
	const navigate = useNavigate()

	const remove = useMutation({
		mutationFn: async (v: ProjectView) => projectViewsDelete({path: {project: project.id!, view: v.id!}}),
		onSuccess: async () => {
			await invalidateProjects()
			toast.success('View deleted')
		},
	})

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between">
				<div className="flex flex-col gap-1.5">
					<CardTitle>Views</CardTitle>
					<CardDescription>Each view shows the project's tasks in its own layout, with its own filter.</CardDescription>
				</div>
				{canAdmin && (
					<Button size="sm" onClick={() => setEditing('new')}>
						<PlusIcon />
						Add view
					</Button>
				)}
			</CardHeader>
			<CardContent className="flex flex-col divide-y">
				{views.map(v => {
					const Icon = KIND_ICON[v.view_kind ?? 'list']
					return (
						<div key={v.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
							<div className="flex size-8 items-center justify-center rounded-md border bg-muted/50">
								<Icon className="size-4" />
							</div>
							<button
								type="button"
								className="flex min-w-0 flex-1 flex-col text-left"
								onClick={() => navigate(`/projects/${project.id}/${v.id}`)}
							>
								<span className="truncate text-sm font-medium">{v.title}</span>
								<span className="truncate text-xs text-muted-foreground">
									<span className="capitalize">{v.view_kind}</span>
									{v.filter?.filter ? <span className="font-mono"> · {v.filter.filter}</span> : null}
								</span>
							</button>
							{canAdmin && (
								<div className="flex gap-1">
									<Button variant="ghost" size="icon-sm" onClick={() => setEditing(v)} aria-label="Edit view">
										<PencilIcon />
									</Button>
									<Button variant="ghost" size="icon-sm" onClick={() => setDeleting(v)} aria-label="Delete view">
										<Trash2Icon />
									</Button>
								</div>
							)}
						</div>
					)
				})}
			</CardContent>
			{editing && (
				<ViewDialog
					project={project}
					view={editing === 'new' ? null : editing}
					nextPosition={(views.at(-1)?.position ?? 0) + 100}
					onClose={() => setEditing(null)}
				/>
			)}
			<ConfirmDialog
				open={!!deleting}
				onOpenChange={o => !o && setDeleting(null)}
				title={`Delete view “${deleting?.title}”?`}
				description="Tasks are not affected. Kanban buckets of this view are removed."
				confirmLabel="Delete"
				onConfirm={() => deleting && remove.mutateAsync(deleting)}
			/>
		</Card>
	)
}

function ViewDialog({project, view, nextPosition, onClose}: {project: Project; view: ProjectView | null; nextPosition: number; onClose: () => void}) {
	const [title, setTitle] = useState(view?.title ?? '')
	const [kind, setKind] = useState<(typeof KINDS)[number]>(view?.view_kind ?? 'list')
	const [filter, setFilter] = useState(view?.filter?.filter ?? '')
	const [bucketMode, setBucketMode] = useState(view?.bucket_configuration_mode ?? 'manual')

	const save = useMutation({
		mutationFn: async () => {
			const body = {
				...view,
				title: title.trim(),
				view_kind: kind,
				filter: {...view?.filter, filter},
				bucket_configuration_mode: kind === 'kanban' ? bucketMode : ('none' as const),
				position: view?.position ?? nextPosition,
			}
			if (view?.id) return (await projectViewsUpdate({path: {project: project.id!, view: view.id}, body})).data
			return (await projectViewsCreate({path: {project: project.id!}, body})).data
		},
		onSuccess: async () => {
			await invalidateProjects()
			toast.success(view ? 'View saved' : 'View created')
			onClose()
		},
	})

	return (
		<Dialog open onOpenChange={o => !o && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<form
					onSubmit={e => {
						e.preventDefault()
						if (title.trim()) save.mutate()
					}}
				>
					<DialogHeader>
						<DialogTitle>{view ? 'Edit view' : 'New view'}</DialogTitle>
					</DialogHeader>
					<FieldGroup className="py-6">
						<Field>
							<FieldLabel htmlFor="v-title">Title</FieldLabel>
							<Input id="v-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} />
						</Field>
						<Field>
							<FieldLabel>Layout</FieldLabel>
							<div className="grid grid-cols-4 gap-2">
								{KINDS.map(k => {
									const Icon = KIND_ICON[k]
									return (
										<button
											key={k}
											type="button"
											disabled={!!view}
											onClick={() => setKind(k)}
											className={cn(
												'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-60',
												kind === k ? 'border-foreground bg-muted' : 'hover:bg-muted/50',
											)}
										>
											<Icon className="size-4" />
											{k}
										</button>
									)
								})}
							</div>
						</Field>
						<Field>
							<FieldLabel htmlFor="v-filter">Filter</FieldLabel>
							<Input
								id="v-filter"
								className="font-mono text-sm"
								value={filter}
								onChange={e => setFilter(e.target.value)}
								placeholder="done = false"
							/>
							<FieldDescription>Only tasks matching this query show up in the view. Leave empty for all.</FieldDescription>
						</Field>
						{kind === 'kanban' && (
							<Field>
								<FieldLabel>Buckets</FieldLabel>
								<Select value={bucketMode} onValueChange={v => setBucketMode(v as typeof bucketMode)}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="manual">Manual — drag tasks between buckets</SelectItem>
										<SelectItem value="filter">Filter — each bucket is a query</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						)}
					</FieldGroup>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={!title.trim() || save.isPending}>
							{save.isPending && <Spinner />}
							{view ? 'Save' : 'Create view'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
