import {useState} from 'react'
import {MessageSquareIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon} from 'lucide-react'
import {toast} from 'sonner'
import {taskCommentsCreate, taskCommentsDelete, taskCommentsUpdate, type Task, type TaskComment} from '@/client/generated'
import {RichTextEditor} from '@/components/editor'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Button} from '@/components/ui/button'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {errorMessage} from '@/lib/api'
import {useAvatarSrc} from '@/lib/avatar'
import {displayName, formatDateTime, initials, parseDate, relative} from '@/lib/format'
import {invalidateTasks, useCurrentUser} from '@/lib/queries'
import {ConfirmDialog, SectionHeader} from './shared'

function CommentAvatar({user}: {user?: TaskComment['author']}) {
	return (
		<Avatar className="size-7">
			<AvatarImage src={useAvatarSrc(user, 56)} alt="" />
			<AvatarFallback className="text-[10px]">{initials(user)}</AvatarFallback>
		</Avatar>
	)
}

export function TaskComments({task, canEdit}: {task: Task; canEdit: boolean}) {
	const {data: me} = useCurrentUser()
	const comments = task.comments ?? []
	const taskId = task.id!

	const add = async (html: string) => {
		try {
			await taskCommentsCreate({path: {task: taskId}, body: {comment: html}})
			await invalidateTasks()
		} catch (e) {
			toast.error(errorMessage(e))
			throw e
		}
	}

	return (
		<section>
			<SectionHeader icon={<MessageSquareIcon />} title="Comments" count={comments.length} />
			{comments.length > 0 && (
				<ol className="relative mb-4 flex flex-col gap-4">
					{comments.map(c => (
						<CommentItem key={c.id} taskId={taskId} comment={c} own={!!me && c.author?.id === me.id} />
					))}
				</ol>
			)}
			{canEdit && (
				<div className="flex gap-3">
					<div className="pt-1">
						<CommentAvatar user={me} />
					</div>
					<RichTextEditor
						mode="composer"
						value=""
						onSave={add}
						placeholder="Leave a comment…"
						className="min-w-0 flex-1"
					/>
				</div>
			)}
		</section>
	)
}

function CommentItem({taskId, comment, own}: {taskId: number; comment: TaskComment; own: boolean}) {
	const [editing, setEditing] = useState(false)
	const [confirm, setConfirm] = useState(false)
	const created = parseDate(comment.created)
	const updated = parseDate(comment.updated)
	const edited = created && updated && updated.getTime() - created.getTime() > 1000

	const save = async (html: string) => {
		if (!html) {
			setConfirm(true)
			throw new Error('empty')
		}
		try {
			await taskCommentsUpdate({path: {task: taskId, commentid: comment.id!}, body: {comment: html}})
			await invalidateTasks()
		} catch (e) {
			toast.error(errorMessage(e))
			throw e
		}
	}

	return (
		<li className="flex gap-3">
			<div className="pt-0.5">
				<CommentAvatar user={comment.author} />
			</div>
			<div className="min-w-0 flex-1 rounded-xl border bg-card px-3 py-2">
				<div className="flex items-center gap-2 text-xs">
					<span className="font-medium">{displayName(comment.author)}</span>
					{created && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="text-muted-foreground">{relative(created)}</span>
							</TooltipTrigger>
							<TooltipContent>{formatDateTime(created)}</TooltipContent>
						</Tooltip>
					)}
					{edited && updated && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="text-muted-foreground">· edited</span>
							</TooltipTrigger>
							<TooltipContent>{formatDateTime(updated)}</TooltipContent>
						</Tooltip>
					)}
					{own && !editing && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-xs" className="-mr-1 ml-auto text-muted-foreground" aria-label="Comment actions">
									<MoreHorizontalIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onSelect={() => setEditing(true)}>
									<PencilIcon />
									Edit
								</DropdownMenuItem>
								<DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
									<Trash2Icon />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
				<RichTextEditor
					value={comment.comment ?? ''}
					onSave={save}
					editing={editing}
					onEditingChange={setEditing}
					clickToEdit={false}
					readOnly={!own}
					emptyText=""
					className="mt-1"
				/>
			</div>
			<ConfirmDialog
				open={confirm}
				onOpenChange={setConfirm}
				title="Delete comment?"
				description="This comment will be removed for everyone."
				onConfirm={async () => {
					try {
						await taskCommentsDelete({path: {task: taskId, commentid: comment.id!}})
						await invalidateTasks()
						toast.success('Comment deleted')
					} catch (e) {
						toast.error(errorMessage(e))
						throw e
					}
				}}
			/>
		</li>
	)
}
