import {useEffect, useRef, useState, type DragEvent, type ReactNode} from 'react'
import {useQuery} from '@tanstack/react-query'
import {
	DownloadIcon,
	FileArchiveIcon,
	FileIcon,
	FileTextIcon,
	ImageIcon,
	ImageOffIcon,
	MoreHorizontalIcon,
	PaperclipIcon,
	Trash2Icon,
	UploadIcon,
} from 'lucide-react'
import {toast} from 'sonner'
import {
	taskAttachmentsDelete,
	taskAttachmentsDownload,
	taskAttachmentsPreview,
	taskAttachmentsUpload,
	type Task,
	type TaskAttachment,
} from '@/client/generated'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Skeleton} from '@/components/ui/skeleton'
import {Spinner} from '@/components/ui/spinner'
import {errorMessage} from '@/lib/api'
import {displayName, parseDate, relative} from '@/lib/format'
import {invalidateTasks} from '@/lib/queries'
import {cn} from '@/lib/utils'
import {ConfirmDialog, SectionHeader} from './shared'

function formatSize(bytes = 0) {
	if (bytes < 1024) return `${bytes} B`
	const units = ['KB', 'MB', 'GB']
	let v = bytes / 1024
	let i = 0
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024
		i++
	}
	return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

const isImage = (a: TaskAttachment) => !!a.file?.mime?.startsWith('image/')

function fileIcon(a: TaskAttachment) {
	const mime = a.file?.mime ?? ''
	if (mime.startsWith('image/')) return ImageIcon
	if (mime.startsWith('text/') || mime === 'application/pdf') return FileTextIcon
	if (/zip|tar|gzip|compressed|7z|rar/.test(mime)) return FileArchiveIcon
	return FileIcon
}

/** Attachments are behind the bearer token, so images are fetched as blobs. */
function usePreview(taskId: number, a: TaskAttachment, size: 'md' | 'xl', enabled = true) {
	return useQuery({
		queryKey: ['attachment-preview', taskId, a.id, size],
		queryFn: async ({signal}) => {
			const {data} = await taskAttachmentsPreview({
				path: {task: taskId, attachment: a.id!},
				query: {size},
				parseAs: 'blob',
				signal,
			})
			return URL.createObjectURL(data as Blob)
		},
		enabled: enabled && isImage(a),
		staleTime: Infinity,
		retry: false,
	})
}

export async function downloadAttachment(taskId: number, a: TaskAttachment) {
	try {
		const {data} = await taskAttachmentsDownload({path: {task: taskId, attachment: a.id!}, parseAs: 'blob'})
		const url = URL.createObjectURL(data as Blob)
		const link = document.createElement('a')
		link.href = url
		link.download = a.file?.name ?? 'attachment'
		document.body.append(link)
		link.click()
		link.remove()
		setTimeout(() => URL.revokeObjectURL(url), 10_000)
	} catch (e) {
		toast.error(errorMessage(e))
	}
}

export function useUploadAttachments(taskId: number) {
	const [uploading, setUploading] = useState(0)
	const upload = async (files: File[]) => {
		if (!files.length) return
		setUploading(n => n + files.length)
		try {
			const {data} = await taskAttachmentsUpload({path: {task: taskId}, body: {files}})
			for (const err of data.errors ?? []) toast.error(err.message ?? 'Upload failed')
			const ok = data.success?.length ?? 0
			if (ok) toast.success(ok === 1 ? 'File uploaded' : `${ok} files uploaded`)
		} catch (e) {
			toast.error(errorMessage(e))
		} finally {
			setUploading(n => n - files.length)
			void invalidateTasks()
		}
	}
	return {upload, uploading: uploading > 0}
}

/** Accepts dropped and pasted files anywhere inside. */
export function AttachmentDropZone({
	onFiles,
	enabled,
	children,
	className,
}: {
	onFiles: (files: File[]) => void
	enabled: boolean
	children: ReactNode
	className?: string
}) {
	const [dragging, setDragging] = useState(false)
	const depth = useRef(0)
	const onFilesRef = useRef(onFiles)
	onFilesRef.current = onFiles

	useEffect(() => {
		if (!enabled) return
		const onPaste = (e: ClipboardEvent) => {
			const files = Array.from(e.clipboardData?.files ?? [])
			if (!files.length) return
			e.preventDefault()
			onFilesRef.current(files)
		}
		window.addEventListener('paste', onPaste)
		return () => window.removeEventListener('paste', onPaste)
	}, [enabled])

	const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files')

	return (
		<div
			className={cn('relative', className)}
			onDragEnter={e => {
				if (!enabled || !hasFiles(e)) return
				depth.current++
				setDragging(true)
			}}
			onDragOver={e => {
				if (enabled && hasFiles(e)) e.preventDefault()
			}}
			onDragLeave={() => {
				if (!enabled) return
				depth.current = Math.max(0, depth.current - 1)
				if (!depth.current) setDragging(false)
			}}
			onDrop={e => {
				if (!enabled || !hasFiles(e)) return
				e.preventDefault()
				depth.current = 0
				setDragging(false)
				onFilesRef.current(Array.from(e.dataTransfer.files))
			}}
		>
			{children}
			{dragging && (
				<div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-background/80 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-2 text-sm font-medium">
						<UploadIcon className="size-6 text-muted-foreground" />
						Drop files to attach
					</div>
				</div>
			)}
		</div>
	)
}

export function TaskAttachments({
	task,
	canEdit,
	upload,
	uploading,
	onSetCover,
}: {
	task: Task
	canEdit: boolean
	upload: (files: File[]) => void
	uploading: boolean
	onSetCover: (attachmentId: number) => void
}) {
	const input = useRef<HTMLInputElement>(null)
	const attachments = task.attachments ?? []
	const [viewing, setViewing] = useState<TaskAttachment | null>(null)

	return (
		<section>
			<SectionHeader icon={<PaperclipIcon />} title="Attachments" count={attachments.length}>
				{canEdit && (
					<>
						<input
							ref={input}
							type="file"
							multiple
							hidden
							onChange={e => {
								upload(Array.from(e.target.files ?? []))
								e.target.value = ''
							}}
						/>
						<Button variant="ghost" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
							{uploading ? <Spinner /> : <UploadIcon />}
							Upload
						</Button>
					</>
				)}
			</SectionHeader>
			{attachments.length === 0 ? (
				canEdit && (
					<button
						type="button"
						onClick={() => input.current?.click()}
						className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
					>
						<UploadIcon className="size-4" />
						Drop, paste or click to add files
					</button>
				)
			) : (
				<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{attachments.map(a => (
						<AttachmentCard
							key={a.id}
							task={task}
							attachment={a}
							canEdit={canEdit}
							onOpen={() => (isImage(a) ? setViewing(a) : void downloadAttachment(task.id!, a))}
							onSetCover={onSetCover}
						/>
					))}
				</ul>
			)}
			<ImageViewer task={task} attachment={viewing} onClose={() => setViewing(null)} />
		</section>
	)
}

function AttachmentCard({
	task,
	attachment: a,
	canEdit,
	onOpen,
	onSetCover,
}: {
	task: Task
	attachment: TaskAttachment
	canEdit: boolean
	onOpen: () => void
	onSetCover: (id: number) => void
}) {
	const taskId = task.id!
	const preview = usePreview(taskId, a, 'md')
	const [confirm, setConfirm] = useState(false)
	const isCover = task.cover_image_attachment_id === a.id
	const Icon = fileIcon(a)
	const created = parseDate(a.created)

	return (
		<li className="group/att flex items-center gap-3 rounded-xl border bg-card p-2 pr-1 transition-colors hover:bg-muted/40">
			<button
				type="button"
				onClick={onOpen}
				className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground"
				aria-label={`Open ${a.file?.name}`}
			>
				{isImage(a) && preview.isLoading ? (
					<Skeleton className="size-full" />
				) : preview.data ? (
					<img src={preview.data} alt="" className="size-full object-cover" />
				) : isImage(a) && preview.isError ? (
					<ImageOffIcon className="size-5" />
				) : (
					<Icon className="size-5" />
				)}
			</button>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5">
					<button type="button" onClick={onOpen} className="truncate text-left text-sm font-medium hover:underline">
						{a.file?.name}
					</button>
					{isCover && (
						<Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px]">
							Cover
						</Badge>
					)}
				</div>
				<p className="truncate text-xs text-muted-foreground">
					{formatSize(a.file?.size)}
					{created && ` · ${relative(created)}`}
					{a.created_by && ` · ${displayName(a.created_by)}`}
				</p>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Attachment actions">
						<MoreHorizontalIcon />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => void downloadAttachment(taskId, a)}>
						<DownloadIcon />
						Download
					</DropdownMenuItem>
					{canEdit && isImage(a) && (
						<DropdownMenuItem onSelect={() => onSetCover(isCover ? 0 : a.id!)}>
							<ImageIcon />
							{isCover ? 'Remove cover image' : 'Set as cover image'}
						</DropdownMenuItem>
					)}
					{canEdit && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
								<Trash2Icon />
								Delete
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<ConfirmDialog
				open={confirm}
				onOpenChange={setConfirm}
				title="Delete attachment?"
				description={<>“{a.file?.name}” will be removed from this task.</>}
				onConfirm={async () => {
					try {
						await taskAttachmentsDelete({path: {task: taskId, attachment: a.id!}})
						await invalidateTasks()
					} catch (e) {
						toast.error(errorMessage(e))
						throw e
					}
				}}
			/>
		</li>
	)
}

function ImageViewer({task, attachment, onClose}: {task: Task; attachment: TaskAttachment | null; onClose: () => void}) {
	const [last, setLast] = useState(attachment)
	if (attachment && attachment !== last) setLast(attachment)
	const shown = attachment ?? last
	const preview = usePreview(task.id!, shown ?? {}, 'xl', !!shown)
	return (
		<Dialog open={!!attachment} onOpenChange={o => !o && onClose()}>
			<DialogContent className="gap-3 sm:max-w-4xl">
				<DialogTitle className="truncate pr-8 text-sm">{shown?.file?.name}</DialogTitle>
				<div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg bg-muted">
					{preview.data ? (
						<img src={preview.data} alt={shown?.file?.name} className="max-h-[70vh] w-auto object-contain" />
					) : (
						<Spinner />
					)}
				</div>
				<div className="flex justify-end">
					<Button variant="outline" size="sm" onClick={() => shown && void downloadAttachment(task.id!, shown)}>
						<DownloadIcon />
						Download original
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
