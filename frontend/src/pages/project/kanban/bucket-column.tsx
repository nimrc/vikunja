import {useEffect, useRef, useState} from 'react'
import {SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {
	CheckCircle2Icon,
	ChevronsLeftRightIcon,
	ChevronsRightLeftIcon,
	GaugeIcon,
	InboxIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from 'lucide-react'
import {AlertDialog} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Input} from '@/components/ui/input'
import {Spinner} from '@/components/ui/spinner'
import {Tooltip} from '@/components/ui/tooltip'
import {cn} from '@/lib/utils'
import {bucketFull, bucketHasMore, type BoardBucket} from './board-data'
import {SortableTaskCard} from './task-card'

export type BucketActions = {
	rename: (title: string) => void
	setLimit: (limit: number) => void
	toggleDone: () => void
	toggleDefault: () => void
	remove: () => void
	addTask: (title: string) => Promise<unknown>
	loadMore: () => Promise<unknown>
	toggleCollapsed: () => void
	openTask: (id: number) => void
}

export function BucketColumn({
	bucket,
	isDone,
	isDefault,
	collapsed,
	canWrite,
	canEditBuckets,
	canDelete,
	dragDisabled,
	actions,
}: {
	bucket: BoardBucket
	isDone: boolean
	isDefault: boolean
	collapsed: boolean
	canWrite: boolean
	canEditBuckets: boolean
	canDelete: boolean
	dragDisabled: boolean
	actions: BucketActions
}) {
	const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
		id: `bucket-${bucket.id}`,
		data: {type: 'bucket', bucketId: bucket.id},
		disabled: !canEditBuckets,
	})
	const [editing, setEditing] = useState<'title' | 'limit' | null>(null)
	const [confirmDelete, setConfirmDelete] = useState(false)
	const [adding, setAdding] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const style = {transform: CSS.Translate.toString(transform), transition}
	const full = bucketFull(bucket)

	if (collapsed) {
		return (
			<div
				ref={setNodeRef}
				style={style}
				className={cn(
					'flex w-11 shrink-0 cursor-pointer flex-col items-center gap-3 rounded-xl border bg-muted/40 py-3 transition-colors hover:bg-muted',
					isDragging && 'opacity-50',
				)}
				onClick={actions.toggleCollapsed}
				title="Expand"
				{...attributes}
				{...listeners}
			>
				<ChevronsLeftRightIcon className="size-4 text-muted-foreground" />
				<span className="text-xs text-muted-foreground tabular-nums">{bucket.count}</span>
				<span className="text-sm font-medium [writing-mode:vertical-rl]">{bucket.title}</span>
			</div>
		)
	}

	async function onScroll(e: React.UIEvent<HTMLDivElement>) {
		const el = e.currentTarget
		if (loadingMore || !bucketHasMore(bucket)) return
		if (el.scrollHeight - el.scrollTop - el.clientHeight > 200) return
		setLoadingMore(true)
		try {
			await actions.loadMore()
		} finally {
			setLoadingMore(false)
		}
	}

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				'flex max-h-full w-[18rem] shrink-0 flex-col rounded-xl border bg-muted/40 sm:w-72',
				isDragging && 'opacity-50',
			)}
		>
			<div
				className={cn('flex h-11 shrink-0 items-center gap-1.5 pr-1.5 pl-3', canEditBuckets && 'cursor-grab active:cursor-grabbing')}
				{...attributes}
				{...listeners}
				tabIndex={-1}
			>
				{editing === 'title' ? (
					<InlineInput
						initial={bucket.title}
						onSubmit={v => {
							setEditing(null)
							if (v.trim() && v.trim() !== bucket.title) actions.rename(v.trim())
						}}
						onCancel={() => setEditing(null)}
					/>
				) : editing === 'limit' ? (
					<InlineInput
						type="number"
						placeholder="Limit (0 = none)"
						initial={String(bucket.limit || '')}
						onSubmit={v => {
							setEditing(null)
							const n = Math.max(0, parseInt(v || '0', 10) || 0)
							if (n !== bucket.limit) actions.setLimit(n)
						}}
						onCancel={() => setEditing(null)}
					/>
				) : (
					<>
						{isDone && (
							<Tooltip label="Done bucket: tasks moved here are marked done" render={<span />}>
								<CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
							</Tooltip>
						)}
						<h3
							className="min-w-0 truncate text-sm font-semibold"
							onDoubleClick={() => canEditBuckets && setEditing('title')}
						>
							{bucket.title}
						</h3>
						<span
							className={cn(
								'rounded-md px-1.5 text-xs text-muted-foreground tabular-nums',
								full && 'bg-destructive/10 font-medium text-destructive',
							)}
						>
							{bucket.limit > 0 ? `${bucket.count}/${bucket.limit}` : bucket.count}
						</span>
						{isDefault && (
							<Tooltip label="Default bucket: new tasks land here" render={<span />}>
								<InboxIcon className="size-3.5 shrink-0 text-muted-foreground" />
							</Tooltip>
						)}
						<div className="ml-auto flex items-center">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button round className="text-muted-foreground" aria-label="Bucket actions">
										<MoreHorizontalIcon />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-52">
									{canEditBuckets && (
										<>
											<DropdownMenuItem onSelect={() => setEditing('title')}>
												<PencilIcon />
												Rename
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => setEditing('limit')}>
												<GaugeIcon />
												Set limit
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuCheckboxItem checked={isDone} onCheckedChange={actions.toggleDone}>
												Done bucket
											</DropdownMenuCheckboxItem>
											<DropdownMenuCheckboxItem checked={isDefault} onCheckedChange={actions.toggleDefault}>
												Default bucket
											</DropdownMenuCheckboxItem>
											<DropdownMenuSeparator />
										</>
									)}
									<DropdownMenuItem onSelect={actions.toggleCollapsed}>
										<ChevronsRightLeftIcon />
										Collapse
									</DropdownMenuItem>
									{canEditBuckets && (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												disabled={!canDelete}
												onSelect={() => setConfirmDelete(true)}
											>
												<Trash2Icon />
												Delete
											</DropdownMenuItem>
										</>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</>
				)}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" onScroll={onScroll}>
				<SortableContext items={bucket.tasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
					<div className="flex min-h-10 flex-col gap-2">
						{bucket.tasks.map(t => (
							<SortableTaskCard
								key={t.id}
								task={t}
								bucketId={bucket.id}
								disabled={dragDisabled}
								onOpen={actions.openTask}
							/>
						))}
						{bucket.tasks.length === 0 && !adding && (
							<div className="flex h-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
								No tasks
							</div>
						)}
					</div>
				</SortableContext>
				{loadingMore && (
					<div className="flex justify-center py-2">
						<Spinner className="size-4 text-muted-foreground" />
					</div>
				)}
			</div>

			{canWrite && (
				<div className="shrink-0 px-2 pb-2">
					{adding ? (
						<QuickAdd
							disabled={full}
							onAdd={actions.addTask}
							onClose={() => setAdding(false)}
						/>
					) : (
						<Button
							size="sm"
							className="w-full justify-start text-muted-foreground"
							disabled={full}
							onClick={() => setAdding(true)}
						>
							<PlusIcon />
							{full ? 'Limit reached' : 'Add task'}
						</Button>
					)}
				</div>
			)}

			<AlertDialog
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete “${bucket.title}”?`}
				description="Its tasks are not deleted; they move to the default bucket."
				confirm="Delete"
				onConfirm={actions.remove}
			/>
		</div>
	)
}

function InlineInput({
	initial,
	onSubmit,
	onCancel,
	type = 'text',
	placeholder,
}: {
	initial: string
	onSubmit: (v: string) => void
	onCancel: () => void
	type?: string
	placeholder?: string
}) {
	const [value, setValue] = useState(initial)
	const done = useRef(false)
	return (
		<Input
			autoFocus
			type={type}
			min={type === 'number' ? 0 : undefined}
			value={value}
			placeholder={placeholder}
			className="h-7 text-sm font-semibold"
			onFocus={e => e.currentTarget.select()}
			onChange={e => setValue(e.target.value)}
			onPointerDown={e => e.stopPropagation()}
			onKeyDown={e => {
				e.stopPropagation()
				if (e.key === 'Enter') {
					done.current = true
					onSubmit(value)
				} else if (e.key === 'Escape') {
					done.current = true
					onCancel()
				}
			}}
			onBlur={() => {
				if (!done.current) onSubmit(value)
			}}
		/>
	)
}

function QuickAdd({
	onAdd,
	onClose,
	disabled,
}: {
	onAdd: (title: string) => Promise<unknown>
	onClose: () => void
	disabled: boolean
}) {
	const [value, setValue] = useState('')
	const [busy, setBusy] = useState(false)
	const ref = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (disabled) onClose()
	}, [disabled, onClose])

	async function submit() {
		const title = value.trim()
		if (!title || busy) return
		setBusy(true)
		try {
			await onAdd(title)
			setValue('')
		} finally {
			setBusy(false)
			ref.current?.focus()
		}
	}

	return (
		<div className="relative">
			<Input
				ref={ref}
				autoFocus
				value={value}
				placeholder="Task title, then Enter"
				className="bg-background pr-8"
				readOnly={busy}
				onChange={e => setValue(e.target.value)}
				onKeyDown={e => {
					if (e.key === 'Enter') void submit()
					else if (e.key === 'Escape') onClose()
				}}
				onBlur={() => !value.trim() && !busy && onClose()}
			/>
			{busy && <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />}
		</div>
	)
}
