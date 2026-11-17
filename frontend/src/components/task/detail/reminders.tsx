import {useState} from 'react'
import {BellIcon, PlusIcon, XIcon} from 'lucide-react'
import type {Task, TaskReminder} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {formatDateTime, parseDate, toApiDate} from '@/lib/format'
import {cn} from '@/lib/utils'
import {DateTimePicker} from './date-picker'
import {Placeholder, valueButton} from './shared'

const UNITS = [
	{value: 'minutes', label: 'minutes', seconds: 60},
	{value: 'hours', label: 'hours', seconds: 3600},
	{value: 'days', label: 'days', seconds: 86400},
	{value: 'weeks', label: 'weeks', seconds: 604800},
] as const

const RELATIVE_TO = [
	{value: 'due_date', label: 'due date', field: 'due_date'},
	{value: 'start_date', label: 'start date', field: 'start_date'},
	{value: 'end_date', label: 'end date', field: 'end_date'},
] as const

function splitPeriod(seconds: number) {
	const abs = Math.abs(seconds)
	const unit = [...UNITS].reverse().find(u => abs % u.seconds === 0) ?? UNITS[0]
	return {amount: abs / unit.seconds, unit}
}

export function reminderLabel(r: TaskReminder): string {
	if (r.relative_to) {
		const to = RELATIVE_TO.find(x => x.value === r.relative_to)?.label ?? r.relative_to
		const period = r.relative_period ?? 0
		if (period === 0) return `At ${to}`
		const {amount, unit} = splitPeriod(period)
		const u = amount === 1 ? unit.label.slice(0, -1) : unit.label
		return `${amount} ${u} ${period < 0 ? 'before' : 'after'} ${to}`
	}
	const d = parseDate(r.reminder)
	return d ? formatDateTime(d) : 'Invalid reminder'
}

export function RemindersValue({
	task,
	onChange,
	disabled,
}: {
	task: Task
	onChange: (reminders: TaskReminder[]) => void
	disabled?: boolean
}) {
	const reminders = task.reminders ?? []
	const [open, setOpen] = useState(false)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild disabled={disabled}>
				<button type="button" className={cn(valueButton, 'items-start')}>
					{reminders.length ? (
						<span className="flex min-w-0 flex-col gap-0.5">
							{reminders.map((r, i) => (
								<span key={i} className="flex items-center gap-1.5 truncate">
									<BellIcon className="text-muted-foreground" />
									{reminderLabel(r)}
								</span>
							))}
						</span>
					) : (
						<Placeholder>Add reminder</Placeholder>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="end">
				{reminders.length > 0 && (
					<ul className="flex flex-col gap-0.5 border-b p-1.5">
						{reminders.map((r, i) => (
							<li key={i} className="flex items-center gap-2 rounded-md py-1 pr-1 pl-2 text-sm hover:bg-muted">
								<BellIcon className="size-3.5 text-muted-foreground" />
								<span className="flex-1 truncate">{reminderLabel(r)}</span>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label="Remove reminder"
									onClick={() => onChange(reminders.filter((_, j) => j !== i))}
								>
									<XIcon />
								</Button>
							</li>
						))}
					</ul>
				)}
				<AddReminder task={task} onAdd={r => onChange([...reminders, r])} />
			</PopoverContent>
		</Popover>
	)
}

function AddReminder({task, onAdd}: {task: Task; onAdd: (r: TaskReminder) => void}) {
	const firstSet = RELATIVE_TO.find(x => parseDate(task[x.field])) ?? RELATIVE_TO[0]
	const [tab, setTab] = useState<'relative' | 'date'>(parseDate(task[firstSet.field]) ? 'relative' : 'date')
	const [amount, setAmount] = useState('1')
	const [unit, setUnit] = useState<(typeof UNITS)[number]['value']>('days')
	const [direction, setDirection] = useState<'before' | 'after'>('before')
	const [relativeTo, setRelativeTo] = useState<string>(firstSet.value)
	const [date, setDate] = useState<Date | null>(null)

	const relField = RELATIVE_TO.find(x => x.value === relativeTo)!
	const relMissing = !parseDate(task[relField.field])

	const addRelative = () => {
		const n = Number(amount)
		if (!Number.isFinite(n) || n < 0) return
		const secs = Math.round(n * UNITS.find(u => u.value === unit)!.seconds)
		onAdd({relative_to: relativeTo, relative_period: direction === 'before' ? -secs : secs})
	}

	return (
		<Tabs value={tab} onValueChange={v => setTab(v as typeof tab)} className="gap-0">
			<div className="p-2 pb-0">
				<TabsList className="w-full">
					<TabsTrigger value="relative">Relative</TabsTrigger>
					<TabsTrigger value="date">Date & time</TabsTrigger>
				</TabsList>
			</div>
			<TabsContent value="relative" className="flex flex-col gap-2 p-2">
				<div className="flex gap-2">
					<Input
						type="number"
						min={0}
						value={amount}
						onChange={e => setAmount(e.target.value)}
						className="h-8 w-20"
						aria-label="Amount"
					/>
					<Select value={unit} onValueChange={v => setUnit(v as typeof unit)}>
						<SelectTrigger size="sm" className="flex-1">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{UNITS.map(u => (
								<SelectItem key={u.value} value={u.value}>
									{u.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex gap-2">
					<Select value={direction} onValueChange={v => setDirection(v as typeof direction)}>
						<SelectTrigger size="sm" className="w-24">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="before">before</SelectItem>
							<SelectItem value="after">after</SelectItem>
						</SelectContent>
					</Select>
					<Select value={relativeTo} onValueChange={setRelativeTo}>
						<SelectTrigger size="sm" className="flex-1">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{RELATIVE_TO.map(r => (
								<SelectItem key={r.value} value={r.value}>
									{r.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{relMissing && (
					<p className="text-xs text-muted-foreground">
						The task has no {relField.label} yet; the reminder fires once it is set.
					</p>
				)}
				<Button size="sm" onClick={addRelative}>
					<PlusIcon />
					Add reminder
				</Button>
			</TabsContent>
			<TabsContent value="date" className="flex flex-col">
				<DateTimePicker value={date} onChange={setDate} clearable={false} />
				<div className="p-2 pt-0">
					<Button
						size="sm"
						className="w-full"
						disabled={!date}
						onClick={() => {
							if (!date) return
							onAdd({reminder: toApiDate(date)})
							setDate(null)
						}}
					>
						<PlusIcon />
						Add reminder
					</Button>
				</div>
			</TabsContent>
		</Tabs>
	)
}
