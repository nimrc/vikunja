import {useState, type ReactNode} from 'react'
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

/** Controlled destructive confirmation; `onConfirm` may be async and keeps the dialog busy until it settles. */
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
	const [busy, setBusy] = useState(false)
	return (
		<AlertDialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
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
								// the mutation already toasted
							} finally {
								setBusy(false)
							}
						}}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
