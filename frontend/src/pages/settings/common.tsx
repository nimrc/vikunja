import {useState, type ReactNode} from 'react'
import {CheckIcon, CopyIcon} from 'lucide-react'
import {toast} from 'sonner'
import {Button} from '@/components/ui/button'
import {cn} from '@/lib/utils'

export function SettingsHeader({title, description, action}: {title: string; description?: ReactNode; action?: ReactNode}) {
	return (
		<div className="mb-6 flex flex-wrap items-start justify-between gap-3">
			<div className="grid gap-1">
				<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
			</div>
			{action}
		</div>
	)
}

export function CopyButton({value, label = 'Copy', className}: {value: string; label?: string; className?: string}) {
	const [copied, setCopied] = useState(false)
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={className}
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(value)
					setCopied(true)
					setTimeout(() => setCopied(false), 1500)
				} catch {
					toast.error('Could not copy to the clipboard')
				}
			}}
		>
			{copied ? <CheckIcon /> : <CopyIcon />}
			{copied ? 'Copied' : label}
		</Button>
	)
}

/** A one-time secret: monospace, selectable, with a copy button. */
export function SecretBox({value, className}: {value: string; className?: string}) {
	return (
		<div className={cn('flex items-center gap-2 rounded-lg border bg-muted/50 p-1.5 pl-3', className)}>
			<code className="min-w-0 flex-1 truncate font-mono text-xs select-all">{value}</code>
			<CopyButton value={value} />
		</div>
	)
}
