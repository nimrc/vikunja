import {CheckIcon, XIcon} from 'lucide-react'
import {cn} from '@/lib/utils'
import {apiColor, cssColor} from '@/lib/format'

const SWATCHES = ['ef4444', 'f97316', 'f59e0b', '84cc16', '22c55e', '14b8a6', '06b6d4', '3b82f6', '6366f1', '8b5cf6', 'd946ef', 'ec4899', '78716c']

/** Value is a Vikunja hex color without '#', '' for none. */
export function ColorPicker({value, onChange}: {value: string; onChange: (hex: string) => void}) {
	const current = value.toLowerCase()
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<button
				type="button"
				onClick={() => onChange('')}
				className={cn(
					'flex size-6 items-center justify-center rounded-full border border-dashed text-muted-foreground',
					!current && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
				)}
				aria-label="No color"
			>
				<XIcon className="size-3" />
			</button>
			{SWATCHES.map(s => (
				<button
					key={s}
					type="button"
					onClick={() => onChange(s)}
					className={cn(
						'flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110',
						current === s && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
					)}
					style={{background: `#${s}`}}
					aria-label={`#${s}`}
				>
					{current === s && <CheckIcon className="size-3 text-white" />}
				</button>
			))}
			<label
				className="relative flex size-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]"
				title="Custom color"
			>
				<input
					type="color"
					className="absolute inset-0 cursor-pointer opacity-0"
					value={cssColor(current) ?? '#000000'}
					onChange={e => onChange(apiColor(e.target.value))}
				/>
			</label>
		</div>
	)
}

export function ColorDot({color, className}: {color?: string | null; className?: string}) {
	return (
		<span
			className={cn('inline-block size-2.5 shrink-0 rounded-full', !color && 'bg-muted-foreground/40', className)}
			style={color ? {background: cssColor(color)} : undefined}
		/>
	)
}
