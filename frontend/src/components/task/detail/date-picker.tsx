import {useState, type ReactNode} from 'react'
import {addDays, format, nextMonday, set, startOfDay} from 'date-fns'
import {XIcon} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Calendar} from '@/components/ui/calendar'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Separator} from '@/components/ui/separator'
import {formatDue, isOverdue} from '@/lib/format'
import {cn} from '@/lib/utils'
import {Placeholder, valueButton} from './shared'

const DEFAULT_HOUR = 12

function withTime(day: Date, time: Date | null) {
	return set(startOfDay(day), {
		hours: time ? time.getHours() : DEFAULT_HOUR,
		minutes: time ? time.getMinutes() : 0,
	})
}

/** Calendar + time + quick picks. Every change is emitted right away. */
export function DateTimePicker({
	value,
	onChange,
	clearable = true,
}: {
	value: Date | null
	onChange: (d: Date | null) => void
	clearable?: boolean
}) {
	const [time, setTime] = useState(value ? format(value, 'HH:mm') : '')
	const [month, setMonth] = useState<Date>(value ?? new Date())
	const today = new Date()
	const picks: {label: string; date: Date}[] = [
		{label: 'Today', date: today},
		{label: 'Tomorrow', date: addDays(today, 1)},
		{label: 'Next week', date: nextMonday(today)},
	]

	const commitTime = () => {
		const m = time.match(/^(\d{1,2}):(\d{2})$/)
		if (!m) return
		const base = value ?? today
		const next = set(base, {hours: Number(m[1]), minutes: Number(m[2]), seconds: 0, milliseconds: 0})
		if (!value || next.getTime() !== value.getTime()) onChange(next)
	}

	const pick = (day: Date) => {
		const next = withTime(day, value)
		setTime(format(next, 'HH:mm'))
		setMonth(next)
		onChange(next)
	}

	return (
		<div className="flex flex-col">
			<div className="flex flex-wrap gap-1 p-2 pb-0">
				{picks.map(p => (
					<Button key={p.label} size="sm" onClick={() => pick(p.date)}>
						{p.label}
						<span className="text-muted-foreground">{format(p.date, 'EEE')}</span>
					</Button>
				))}
				{clearable && value && (
					<Button
						size="sm"
						className="text-muted-foreground"
						onClick={() => {
							setTime('')
							onChange(null)
						}}
					>
						<XIcon />
						Clear
					</Button>
				)}
			</div>
			<Calendar
				mode="single"
				selected={value ?? undefined}
				onSelect={d => d && pick(d)}
				month={month}
				onMonthChange={setMonth}
				weekStartsOn={1}
				className="self-center"
			/>
			<Separator />
			<div className="flex items-center gap-2 p-2">
				<span className="text-xs text-muted-foreground">Time</span>
				<Input
					type="time"
					value={time}
					onChange={e => setTime(e.target.value)}
					onBlur={commitTime}
					onKeyDown={e => {
						if (e.key === 'Enter') {
							e.preventDefault()
							commitTime()
						}
					}}
					className="h-8 flex-1 [&::-webkit-calendar-picker-indicator]:hidden"
				/>
			</div>
		</div>
	)
}

/** A property-row value that opens a date picker. */
export function DateValue({
	value,
	onChange,
	placeholder = 'Set date',
	done,
	warnOverdue,
	disabled,
	icon,
}: {
	value: Date | null
	onChange: (d: Date | null) => void
	placeholder?: string
	done?: boolean
	/** Only due dates turn red when they pass. */
	warnOverdue?: boolean
	disabled?: boolean
	icon?: ReactNode
}) {
	const overdue = warnOverdue && isOverdue(value, done)
	return (
		<Popover>
			<PopoverTrigger disabled={disabled} className={cn(valueButton, overdue && 'text-destructive')}>
				{icon}
				{value ? <span className="truncate">{formatDue(value)}</span> : <Placeholder>{placeholder}</Placeholder>}
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="end">
				<DateTimePicker value={value} onChange={onChange} />
			</PopoverContent>
		</Popover>
	)
}
