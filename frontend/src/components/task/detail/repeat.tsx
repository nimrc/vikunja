import {useState} from 'react'
import {RepeatIcon} from 'lucide-react'
import type {Task} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {SelectMenu} from '@/components/ui/select'
import {Separator} from '@/components/ui/separator'
import {Placeholder, valueButton} from './shared'

// repeat_mode: 0 = every repeat_after seconds, 1 = monthly, 2 = from the date it was marked done.
const MODE_DEFAULT = 0
const MODE_MONTHLY = 1
const MODE_FROM_DONE = 2

const UNITS = [
	{value: 'hours', seconds: 3600},
	{value: 'days', seconds: 86400},
	{value: 'weeks', seconds: 604800},
] as const
type Unit = (typeof UNITS)[number]['value']

function split(seconds: number): {amount: number; unit: Unit} {
	const unit = [...UNITS].reverse().find(u => seconds % u.seconds === 0) ?? UNITS[0]
	return {amount: seconds / unit.seconds, unit: unit.value}
}

export function repeatLabel(task: Task): string | null {
	const mode = task.repeat_mode ?? 0
	const after = task.repeat_after ?? 0
	if (mode === MODE_MONTHLY) return 'Monthly'
	if (!after) return null
	const {amount, unit} = split(after)
	const base = amount === 1 ? `Every ${unit.slice(0, -1)}` : `Every ${amount} ${unit}`
	return mode === MODE_FROM_DONE ? `${base}, from completion` : base
}

export function RepeatValue({
	task,
	onChange,
	disabled,
}: {
	task: Task
	onChange: (changes: Pick<Task, 'repeat_after' | 'repeat_mode'>) => void
	disabled?: boolean
}) {
	const [open, setOpen] = useState(false)
	const label = repeatLabel(task)
	const initial = split(task.repeat_after || 86400)
	const [mode, setMode] = useState(String(task.repeat_mode ?? 0))
	const [amount, setAmount] = useState(String(task.repeat_after ? initial.amount : 1))
	const [unit, setUnit] = useState<Unit>(initial.unit)

	const set = (changes: Pick<Task, 'repeat_after' | 'repeat_mode'>) => {
		onChange(changes)
		setOpen(false)
	}

	const save = () => {
		const m = Number(mode)
		if (m === MODE_MONTHLY) return set({repeat_mode: MODE_MONTHLY, repeat_after: 0})
		const n = Number(amount)
		if (!Number.isFinite(n) || n <= 0) return
		set({repeat_mode: m, repeat_after: Math.round(n * UNITS.find(u => u.value === unit)!.seconds)})
	}

	return (
		<Popover
			open={open}
			onOpenChange={o => {
				if (o) {
					const s = split(task.repeat_after || 86400)
					setMode(String(task.repeat_mode ?? 0))
					setAmount(String(task.repeat_after ? s.amount : 1))
					setUnit(s.unit)
				}
				setOpen(o)
			}}
		>
			<PopoverTrigger disabled={disabled} render={<button type="button" className={valueButton} />}>
				{label ? (
					<>
						<RepeatIcon className="text-muted-foreground" />
						<span className="truncate">{label}</span>
					</>
				) : (
					<Placeholder>Does not repeat</Placeholder>
				)}
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="end">
				<div className="grid grid-cols-2 gap-1 p-2">
					<Button size="sm" onClick={() => set({repeat_mode: MODE_DEFAULT, repeat_after: 86400})}>
						Every day
					</Button>
					<Button size="sm" onClick={() => set({repeat_mode: MODE_DEFAULT, repeat_after: 604800})}>
						Every week
					</Button>
					<Button size="sm" onClick={() => set({repeat_mode: MODE_MONTHLY, repeat_after: 0})}>
						Every month
					</Button>
					<Button
						size="sm"
						className="text-muted-foreground"
						disabled={!label}
						onClick={() => set({repeat_mode: MODE_DEFAULT, repeat_after: 0})}
					>
						Don’t repeat
					</Button>
				</div>
				<Separator />
				<form
					className="flex flex-col gap-3 p-3"
					onSubmit={e => {
						e.preventDefault()
						save()
					}}
				>
					<div className="flex flex-col gap-1.5">
						<Label className="text-xs text-muted-foreground">Repeat</Label>
						<SelectMenu
							label="Repeat"
							options={[
								{value: String(MODE_DEFAULT), label: 'From the previous date'},
								{value: String(MODE_FROM_DONE), label: 'From when it’s marked done'},
								{value: String(MODE_MONTHLY), label: 'Monthly, same day'},
							]}
							value={mode}
							onValueChange={setMode}
						/>
					</div>
					{Number(mode) !== MODE_MONTHLY && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">Every</span>
							<Input
								type="number"
								min={1}
								value={amount}
								onChange={e => setAmount(e.target.value)}
								className="h-8 w-16"
								aria-label="Amount"
							/>
							<div className="flex-1">
								<SelectMenu
									label="Unit"
									options={UNITS.map(u => ({value: u.value, label: u.value}))}
									value={unit}
									onValueChange={v => setUnit(v as Unit)}
								/>
							</div>
						</div>
					)}
					<Button type="submit" tone="primary" size="sm">
						Save
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	)
}
