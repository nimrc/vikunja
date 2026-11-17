import type {ReactNode} from 'react'
import {AlertDialog} from '@/components/ui/alert-dialog'

/** Controlled destructive confirmation; stays open until `onConfirm` settles, and on failure. */
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
	title: ReactNode
	description?: ReactNode
	confirmLabel?: string
	onConfirm: () => unknown
}) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			confirm={confirmLabel}
			onConfirm={onConfirm}
		/>
	)
}
