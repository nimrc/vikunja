import {useEffect, useState, type ReactNode} from 'react'
import type {Task} from '@/client/generated'
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
import {Spinner} from '@/components/ui/spinner'
import {cn} from '@/lib/utils'

/** The API adds max_permission (0 read, 1 write, 2 admin) to single reads. */
export function canEditTask(task: Task) {
	return ((task as {max_permission?: number}).max_permission ?? 1) >= 1
}

export function SectionHeader({
	icon,
	title,
	count,
	children,
}: {
	icon?: ReactNode
	title: string
	count?: number
	children?: ReactNode
}) {
	return (
		<div className="mb-2 flex min-h-8 items-center gap-2">
			<h2 className="flex items-center gap-2 text-sm font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
				{icon}
				{title}
				{!!count && <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>}
			</h2>
			<div className="ml-auto flex items-center gap-1">{children}</div>
		</div>
	)
}

/** Linear-style property row: muted label on the left, an editable value on the right. */
export function PropertyRow({label, icon, children, className}: {label: string; icon?: ReactNode; children: ReactNode; className?: string}) {
	return (
		<div className={cn('flex min-h-8 items-start gap-2', className)}>
			<div className="flex h-8 w-24 shrink-0 items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5">
				{icon}
				{label}
			</div>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	)
}

/** Class for the ghost button that holds a property's value. */
export const valueButton =
	'flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none aria-expanded:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5 [&_svg]:shrink-0'

export function Placeholder({children}: {children: ReactNode}) {
	return <span className="text-muted-foreground">{children}</span>
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = 'Delete',
	onConfirm,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: ReactNode
	confirmLabel?: string
	onConfirm: () => Promise<unknown> | unknown
}) {
	const [busy, setBusy] = useState(false)
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description && <AlertDialogDescription>{description}</AlertDialogDescription>}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={busy}
						onClick={async e => {
							e.preventDefault()
							setBusy(true)
							try {
								await onConfirm()
								onOpenChange(false)
							} catch {
								// reported by the caller
							} finally {
								setBusy(false)
							}
						}}
					>
						{busy && <Spinner />}
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

export function useDebounced<T>(value: T, ms = 200) {
	const [v, setV] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setV(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return v
}
