import {useMemo, useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {MoreHorizontalIcon, PencilIcon, PlusIcon, SearchIcon, TagIcon, Trash2Icon} from 'lucide-react'
import {toast} from 'sonner'
import {labelsCreate, labelsDelete, labelsUpdate, type Label} from '@/client/generated'
import {ColorPicker} from '@/components/color-picker'
import {ConfirmDialog} from '@/components/confirm-dialog'
import {LabelBadge} from '@/components/task/task-bits'
import {UserAvatarPlain} from '@/components/user-picker'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Field, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {InputGroup, InputGroupAddon, InputGroupInput} from '@/components/ui/input-group'
import {Skeleton} from '@/components/ui/skeleton'
import {Textarea} from '@/components/ui/textarea'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {cssColor, displayName} from '@/lib/format'
import {invalidateTasks, keys, queryClient, useCurrentUser, useLabels} from '@/lib/queries'

/** Descriptions may come back as HTML from the old editor. */
function plain(html?: string) {
	if (!html) return ''
	return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
}

export default function Labels() {
	const {labels, isLoading} = useLabels()
	const {data: me} = useCurrentUser()
	const [q, setQ] = useState('')
	const [editing, setEditing] = useState<Label | 'new' | null>(null)
	const [deleting, setDeleting] = useState<Label | null>(null)

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase()
		const list = [...labels].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
		if (!needle) return list
		return list.filter(l => l.title?.toLowerCase().includes(needle) || plain(l.description).toLowerCase().includes(needle))
	}, [labels, q])

	const del = useMutation({
		mutationFn: (id: number) => labelsDelete({path: {id}}),
		onSuccess: () => {
			toast.success('Label deleted')
			queryClient.invalidateQueries({queryKey: keys.labels})
			invalidateTasks()
		},
	})

	return (
		<div className="mx-auto w-full max-w-6xl p-4 md:p-6">
			<div className="mb-6 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Labels</h1>
					<p className="text-sm text-muted-foreground">Tag tasks across projects. You can edit labels you created.</p>
				</div>
				<div className="flex w-full gap-2 sm:w-auto">
					<InputGroup className="sm:w-64">
						<InputGroupAddon>
							<SearchIcon />
						</InputGroupAddon>
						<InputGroupInput placeholder="Search labels…" value={q} onChange={e => setQ(e.target.value)} />
					</InputGroup>
					<Button onClick={() => setEditing('new')}>
						<PlusIcon />
						New label
					</Button>
				</div>
			</div>

			{isLoading ? (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({length: 6}, (_, i) => (
						<Skeleton key={i} className="h-24 rounded-xl" />
					))}
				</div>
			) : labels.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<TagIcon />
						</EmptyMedia>
						<EmptyTitle>No labels yet</EmptyTitle>
						<EmptyDescription>Labels help you group related tasks, like “bug” or “waiting”.</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={() => setEditing('new')}>
							<PlusIcon />
							Create a label
						</Button>
					</EmptyContent>
				</Empty>
			) : filtered.length === 0 ? (
				<p className="py-12 text-center text-sm text-muted-foreground">No labels match “{q}”.</p>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map(l => {
						const mine = !!me?.id && l.created_by?.id === me.id
						const desc = plain(l.description)
						return (
							<div
								key={l.id}
								className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
							>
								<span
									className="absolute inset-y-3 left-0 w-1 rounded-r-full"
									style={{background: cssColor(l.hex_color) ?? 'var(--muted)'}}
								/>
								<div className="flex items-start justify-between gap-2">
									<LabelBadge label={l} className="h-6 max-w-full truncate text-xs" />
									{mine ? (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon-sm"
													className="-mt-1 -mr-1 opacity-60 group-hover:opacity-100"
													aria-label="Label actions"
												>
													<MoreHorizontalIcon />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onSelect={() => setEditing(l)}>
													<PencilIcon />
													Edit
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem variant="destructive" onSelect={() => setDeleting(l)}>
													<Trash2Icon />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									) : (
										<Tooltip>
											<TooltipTrigger asChild>
												<span>
													<UserAvatarPlain user={l.created_by} size={20} />
												</span>
											</TooltipTrigger>
											<TooltipContent>Created by {displayName(l.created_by)} · read only</TooltipContent>
										</Tooltip>
									)}
								</div>
								<p className="line-clamp-2 text-sm text-muted-foreground">
									{desc || <span className="italic opacity-60">No description</span>}
								</p>
							</div>
						)
					})}
				</div>
			)}

			<LabelDialog label={editing} onClose={() => setEditing(null)} />
			<ConfirmDialog
				open={!!deleting}
				onOpenChange={o => !o && setDeleting(null)}
				title={`Delete “${deleting?.title}”?`}
				description="It will be removed from every task that uses it. This cannot be undone."
				onConfirm={() => deleting?.id && del.mutateAsync(deleting.id)}
			/>
		</div>
	)
}

function LabelDialog({label, onClose}: {label: Label | 'new' | null; onClose: () => void}) {
	return (
		<Dialog open={!!label} onOpenChange={o => !o && onClose()}>
			<DialogContent className="sm:max-w-md">
				{label && <LabelForm key={label === 'new' ? 'new' : label.id} label={label} onClose={onClose} />}
			</DialogContent>
		</Dialog>
	)
}

function LabelForm({label, onClose}: {label: Label | 'new'; onClose: () => void}) {
	const isNew = label === 'new'
	const initial = isNew ? {} : label
	const [title, setTitle] = useState(initial.title ?? '')
	const [description, setDescription] = useState(plain(initial.description))
	const [color, setColor] = useState(initial.hex_color ?? '')

	const save = useMutation({
		mutationFn: async () => {
			const body = {title: title.trim(), description, hex_color: color}
			if (isNew) return labelsCreate({body})
			return labelsUpdate({path: {id: label.id!}, body})
		},
		onSuccess: () => {
			toast.success(isNew ? 'Label created' : 'Label saved')
			queryClient.invalidateQueries({queryKey: keys.labels})
			if (!isNew) invalidateTasks()
			onClose()
		},
	})

	return (
		<form
			onSubmit={e => {
				e.preventDefault()
				if (title.trim()) save.mutate()
			}}
			className="grid gap-4"
		>
			<DialogHeader>
				<DialogTitle>{isNew ? 'New label' : 'Edit label'}</DialogTitle>
				<DialogDescription>Preview: {title.trim() ? <LabelBadge label={{title, hex_color: color}} /> : '—'}</DialogDescription>
			</DialogHeader>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="label-title">Title</FieldLabel>
					<Input id="label-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} required />
				</Field>
				<Field>
					<FieldLabel htmlFor="label-desc">Description</FieldLabel>
					<Textarea
						id="label-desc"
						rows={3}
						value={description}
						onChange={e => setDescription(e.target.value)}
						placeholder="Optional"
					/>
				</Field>
				<Field>
					<FieldLabel>Color</FieldLabel>
					<ColorPicker value={color} onChange={setColor} />
				</Field>
			</FieldGroup>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onClose}>
					Cancel
				</Button>
				<Button type="submit" disabled={!title.trim() || save.isPending}>
					{isNew ? 'Create' : 'Save'}
				</Button>
			</DialogFooter>
		</form>
	)
}
