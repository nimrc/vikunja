import {useState, type ReactNode} from 'react'
import {useMutation} from '@tanstack/react-query'
import {useNavigate} from 'react-router'
import {toast} from 'sonner'
import {ArchiveIcon, ArchiveRestoreIcon, CopyIcon, FolderPlusIcon, PencilIcon, Share2Icon, StarIcon, StarOffIcon, Trash2Icon} from 'lucide-react'
import {filtersDelete, projectsDelete, projectsDuplicate, projectsUpdate, type Project} from '@/client/generated'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {ProjectCreateDialog} from '@/components/project-create-dialog'
import {projectHref} from '@/components/app-sidebar'
import {isSavedFilter} from '@/lib/format'
import {invalidateProjects} from '@/lib/queries'

// Saved filters are exposed as projects with id = -(filterId + 1).
export const filterIdOf = (projectId: number) => -projectId - 1

/** v2 PUT replaces the project, so send the whole thing with the change. */
export function useUpdateProject() {
	return useMutation({
		mutationFn: async ({project, changes}: {project: Project; changes: Partial<Project>}) =>
			(await projectsUpdate({path: {id: project.id!}, body: {...project, ...changes}})).data,
		onSettled: () => invalidateProjects(),
	})
}

export function useToggleFavorite() {
	const update = useUpdateProject()
	return (project: Project) =>
		update.mutate(
			{project, changes: {is_favorite: !project.is_favorite}},
			{onSuccess: p => toast.success(p.is_favorite ? 'Added to favorites' : 'Removed from favorites')},
		)
}

export function ProjectActionsMenu({project, children, align = 'end'}: {project: Project; children: ReactNode; align?: 'start' | 'end'}) {
	const navigate = useNavigate()
	const [confirmDelete, setConfirmDelete] = useState(false)
	const update = useUpdateProject()
	const toggleFavorite = useToggleFavorite()
	const filter = isSavedFilter(project)
	const canAdmin = filter || (project.max_permission ?? 0) >= 2
	const canWrite = filter || (project.max_permission ?? 0) >= 1

	const duplicate = useMutation({
		mutationFn: async () =>
			(await projectsDuplicate({path: {projectid: project.id!}, body: {parent_project_id: project.parent_project_id ?? 0}})).data,
		onSuccess: async res => {
			await invalidateProjects()
			toast.success('Project duplicated')
			const dup = (res as {duplicated_project?: Project}).duplicated_project
			if (dup?.id) navigate(projectHref(dup))
		},
	})

	const remove = useMutation({
		mutationFn: async () => {
			if (filter) await filtersDelete({path: {filter: filterIdOf(project.id!)}})
			else await projectsDelete({path: {id: project.id!}})
		},
		onSuccess: async () => {
			await invalidateProjects()
			toast.success(filter ? 'Filter deleted' : 'Project moved to trash')
			navigate('/projects')
		},
	})

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
				<DropdownMenuContent align={align} className="w-52">
					{canWrite && (
						<DropdownMenuItem onSelect={() => navigate(`/projects/${project.id}/settings`)}>
							<PencilIcon />
							Edit
						</DropdownMenuItem>
					)}
					{!filter && canAdmin && (
						<DropdownMenuItem onSelect={() => navigate(`/projects/${project.id}/settings/share`)}>
							<Share2Icon />
							Share
						</DropdownMenuItem>
					)}
					{!filter && (
						<DropdownMenuItem onSelect={() => toggleFavorite(project)}>
							{project.is_favorite ? <StarOffIcon /> : <StarIcon />}
							{project.is_favorite ? 'Unfavorite' : 'Favorite'}
						</DropdownMenuItem>
					)}
					{!filter && canWrite && (
						<ProjectCreateDialog parentId={project.id}>
							<DropdownMenuItem onSelect={e => e.preventDefault()}>
								<FolderPlusIcon />
								New subproject
							</DropdownMenuItem>
						</ProjectCreateDialog>
					)}
					{!filter && canWrite && (
						<DropdownMenuItem onSelect={() => duplicate.mutate()}>
							<CopyIcon />
							Duplicate
						</DropdownMenuItem>
					)}
					{!filter && canAdmin && (
						<DropdownMenuItem
							onSelect={() =>
								update.mutate(
									{project, changes: {is_archived: !project.is_archived}},
									{onSuccess: p => toast.success(p.is_archived ? 'Project archived' : 'Project restored')},
								)
							}
						>
							{project.is_archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
							{project.is_archived ? 'Unarchive' : 'Archive'}
						</DropdownMenuItem>
					)}
					{canAdmin && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
								<Trash2Icon />
								Delete
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete “{project.title}”?</AlertDialogTitle>
						<AlertDialogDescription>
							{filter
								? 'The saved filter is removed. Tasks are not affected.'
								: 'The project, its subprojects and all their tasks move to the trash.'}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
