import type {ReactNode} from 'react'
import {Link} from 'react-router'
import {FileQuestionIcon, TextIcon} from 'lucide-react'
import type {Task} from '@/client/generated'
import {RichTextEditor} from '@/components/editor'
import {Button} from '@/components/ui/button'
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Skeleton} from '@/components/ui/skeleton'
import {useUpdateTask} from '@/components/task/task-bits'
import {ApiError} from '@/lib/api'
import {useProject, useTask} from '@/lib/queries'
import {AttachmentDropZone, TaskAttachments, useUploadAttachments} from './detail/attachments'
import {TaskComments} from './detail/comments'
import {TaskHeader} from './detail/header'
import {TaskProperties} from './detail/properties'
import {TaskRelations} from './detail/relations'
import {canEditTask, SectionHeader} from './detail/shared'

export function TaskDetail({
	taskId,
	onClose,
	onDeleted,
	actions,
}: {
	taskId: number
	onClose?: () => void
	/** Called after the task was deleted; defaults to onClose. */
	onDeleted?: (task: Task) => void
	/** Extra buttons for the header's right edge (e.g. the dialog's "open full page" and close). */
	actions?: ReactNode
}) {
	const query = useTask(taskId)
	const task = query.data

	if (query.isPending) return <TaskDetailSkeleton actions={actions} />
	if (!task) {
		const missing = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 403)
		return (
			<div className="flex flex-col">
				{actions && <div className="flex justify-end">{actions}</div>}
				<Empty className="min-h-80">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FileQuestionIcon />
						</EmptyMedia>
						<EmptyTitle>{missing ? 'Task not found' : 'Couldn’t load this task'}</EmptyTitle>
						<EmptyDescription>
							{missing
								? 'It may have been deleted, or you don’t have access to it.'
								: (query.error?.message ?? 'Something went wrong.')}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent className="flex-row justify-center">
						{!missing && (
							<Button onClick={() => void query.refetch()}>
								Try again
							</Button>
						)}
						{onClose ? (
							<Button onClick={onClose}>Close</Button>
						) : (
							<Button render={<Link to="/" />}>Go home</Button>
						)}
					</EmptyContent>
				</Empty>
			</div>
		)
	}

	return <LoadedTask task={task} onDeleted={onDeleted ?? (onClose && (() => onClose()))} actions={actions} />
}

function LoadedTask({task, onDeleted, actions}: {task: Task; onDeleted?: (task: Task) => void; actions?: ReactNode}) {
	const mutation = useUpdateTask()
	const {data: project} = useProject(task.project_id ?? 0)
	const canEdit = canEditTask(task)
	const {upload, uploading} = useUploadAttachments(task.id!)

	const update = (changes: Partial<Task>) => mutation.mutate({task, changes})

	return (
		<AttachmentDropZone onFiles={files => void upload(files)} enabled={canEdit} className="flex flex-col gap-6">
			<TaskHeader task={task} canEdit={canEdit} update={update} onDeleted={onDeleted} actions={actions} />
			{/* Phones read description, then properties, then the rest; wide screens put properties in a side column. */}
			<div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:grid-rows-[auto_1fr]">
				<section className="min-w-0 lg:col-start-1 lg:row-start-1">
					<SectionHeader icon={<TextIcon />} title="Description" />
					<RichTextEditor
						value={task.description ?? ''}
						onSave={description => mutation.mutateAsync({task, changes: {description}})}
						placeholder="Add a description…"
						emptyText={canEdit ? 'Add a description…' : 'No description.'}
						readOnly={!canEdit}
					/>
				</section>
				<aside className="max-lg:rounded-xl max-lg:border max-lg:p-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
					<div className="lg:sticky lg:top-4">
						<TaskProperties task={task} project={project} update={update} disabled={!canEdit} />
					</div>
				</aside>
				<div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-2">
					<TaskAttachments
						task={task}
						canEdit={canEdit}
						upload={files => void upload(files)}
						uploading={uploading}
						onSetCover={id => update({cover_image_attachment_id: id})}
					/>
					<TaskRelations task={task} canEdit={canEdit} />
					<TaskComments task={task} canEdit={canEdit} />
				</div>
			</div>
		</AttachmentDropZone>
	)
}

function TaskDetailSkeleton({actions}: {actions?: ReactNode}) {
	return (
		<div className="flex flex-col gap-6" aria-busy="true">
			<div className="flex flex-col gap-3">
				<div className="flex h-8 items-center gap-2">
					<Skeleton className="h-4 w-40" />
					<div className="ml-auto flex items-center gap-1">{actions}</div>
				</div>
				<div className="flex items-center gap-3">
					<Skeleton className="size-7 rounded-full" />
					<Skeleton className="h-8 w-2/3" />
				</div>
			</div>
			<div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
				<div className="flex flex-col gap-2 lg:order-last">
					{Array.from({length: 8}, (_, i) => (
						<div key={i} className="flex items-center gap-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-6 flex-1" />
						</div>
					))}
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-4 w-2/3" />
					<Skeleton className="mt-6 h-4 w-24" />
					<Skeleton className="h-16 w-full rounded-xl" />
				</div>
			</div>
		</div>
	)
}
