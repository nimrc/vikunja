import {useEffect, useMemo, useRef, useState} from 'react'
import {
	addDays,
	differenceInCalendarDays,
	eachDayOfInterval,
	endOfDay,
	format,
	isToday,
	isWeekend,
	startOfDay,
} from 'date-fns'
import {CheckIcon} from 'lucide-react'
import type {Task} from '@/client/generated'
import {useUpdateTask} from '@/components/task/task-bits'
import {useIsMobile} from '@/hooks/use-mobile'
import {contrastText, cssColor, parseDate, toApiDate} from '@/lib/format'
import {useOpenTask} from '@/lib/navigation'
import {cn} from '@/lib/utils'

const ROW_H = 40
const HEADER_H = 56
// Undated tasks get a placeholder bar of this many days starting today.
const PLACEHOLDER_DAYS = 7

type Span = {start: Date; end: Date; placeholder: boolean}
type DragMode = 'move' | 'start' | 'end'
type Drag = {id: number; mode: DragMode; x0: number; delta: number; moved: boolean}

export function taskSpan(task: Task): Span {
	const start = parseDate(task.start_date) ?? parseDate(task.end_date) ?? parseDate(task.due_date)
	const end = parseDate(task.end_date) ?? parseDate(task.due_date) ?? start
	if (!start || !end) {
		const today = startOfDay(new Date())
		return {start: today, end: endOfDay(addDays(today, PLACEHOLDER_DAYS - 1)), placeholder: true}
	}
	return end < start ? {start: end, end: start, placeholder: false} : {start, end, placeholder: false}
}

function applyDrag(span: Span, mode: DragMode, delta: number): Span {
	if (!delta) return span
	if (mode === 'move') return {...span, start: addDays(span.start, delta), end: addDays(span.end, delta)}
	if (mode === 'start') {
		const start = addDays(span.start, delta)
		return {...span, start: start > span.end ? startOfDay(span.end) : start}
	}
	const end = addDays(span.end, delta)
	return {...span, end: end < span.start ? endOfDay(span.start) : end}
}

export function GanttChart({
	tasks,
	from,
	to,
	canWrite,
}: {
	tasks: Task[]
	from: Date
	to: Date
	canWrite: boolean
}) {
	const isMobile = useIsMobile()
	const dayW = isMobile ? 28 : 34
	const labelW = isMobile ? 132 : 240
	const days = useMemo(() => eachDayOfInterval({start: from, end: to}), [from, to])
	const width = days.length * dayW
	const scroller = useRef<HTMLDivElement>(null)
	const openTask = useOpenTask()
	const update = useUpdateTask()
	const [drag, setDrag] = useState<Drag | null>(null)

	const todayIdx = days.findIndex(d => isToday(d))

	useEffect(() => {
		const el = scroller.current
		if (!el || todayIdx < 0) return
		el.scrollLeft = Math.max(0, todayIdx * dayW - (el.clientWidth - labelW) / 3)
	}, [todayIdx, dayW, labelW])

	const months = useMemo(() => {
		const out: {label: string; span: number}[] = []
		for (const d of days) {
			const label = format(d, 'MMMM yyyy')
			const last = out[out.length - 1]
			if (last?.label === label) last.span++
			else out.push({label, span: 1})
		}
		return out
	}, [days])

	function onPointerDown(e: React.PointerEvent, task: Task, mode: DragMode) {
		if (e.button !== 0) return
		e.stopPropagation()
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
		setDrag({id: task.id!, mode: canWrite ? mode : 'move', x0: e.clientX, delta: 0, moved: false})
	}

	function onPointerMove(e: React.PointerEvent) {
		if (!drag) return
		const dx = e.clientX - drag.x0
		const moved = drag.moved || Math.abs(dx) > 4
		const delta = canWrite && moved ? Math.round(dx / dayW) : 0
		if (delta !== drag.delta || moved !== drag.moved) setDrag({...drag, delta, moved})
	}

	function onPointerUp(task: Task, span: Span) {
		const d = drag
		setDrag(null)
		if (!d) return
		if (!d.moved) {
			openTask(task.id!)
			return
		}
		if (!d.delta && !span.placeholder) return
		const next = applyDrag(span, d.mode, d.delta)
		update.mutate({task, changes: {start_date: toApiDate(next.start), end_date: toApiDate(next.end)}})
	}

	const dayOffset = (d: Date) => differenceInCalendarDays(d, from)

	return (
		<div ref={scroller} className="relative min-h-0 flex-1 overflow-auto overscroll-contain">
			<div className="relative" style={{width: labelW + width, minHeight: '100%'}}>
				{/* Day backdrop: weekends and today, behind every row. */}
				<div
					className="pointer-events-none absolute top-0"
					style={{left: labelW, width, height: HEADER_H + tasks.length * ROW_H}}
					aria-hidden
				>
					{days.map((d, i) =>
						isWeekend(d) || i === todayIdx ? (
							<div
								key={i}
								className={cn('absolute inset-y-0', i === todayIdx ? 'bg-primary/[0.06]' : 'bg-muted/60')}
								style={{left: i * dayW, width: dayW}}
							/>
						) : null,
					)}
					<div
						className="absolute inset-0"
						style={{
							backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px)',
							backgroundSize: `${dayW}px 100%`,
							opacity: 0.6,
						}}
					/>
					{todayIdx >= 0 && (
						<div className="absolute inset-y-0 z-[5] w-0.5 bg-primary/70" style={{left: todayIdx * dayW + dayW / 2 - 1}} />
					)}
				</div>

				{/* Header */}
				<div className="sticky top-0 z-20 flex border-b bg-card/95 backdrop-blur" style={{height: HEADER_H}}>
					<div
						className="sticky left-0 z-30 flex shrink-0 items-end border-r bg-card px-3 pb-2 text-xs font-medium text-muted-foreground"
						style={{width: labelW}}
					>
						Task
					</div>
					<div className="flex flex-col" style={{width}}>
						<div className="flex h-6 border-b">
							{months.map((m, i) => (
								<div key={i} className="border-r text-xs leading-6 font-medium" style={{width: m.span * dayW}}>
									{/* Sticky so the month name stays readable while scrolled into the month. */}
									<span className="sticky inline-block truncate px-2" style={{left: labelW, maxWidth: m.span * dayW}}>
										{m.label}
									</span>
								</div>
							))}
						</div>
						<div className="flex flex-1">
							{days.map((d, i) => (
								<div
									key={i}
									className={cn(
										'flex flex-col items-center justify-center text-[10px] leading-tight text-muted-foreground',
										isWeekend(d) && 'text-muted-foreground/60',
									)}
									style={{width: dayW}}
								>
									<span>{format(d, 'EEEEE')}</span>
									<span
										className={cn(
											'flex size-5 items-center justify-center rounded-full text-[11px] font-medium tabular-nums',
											i === todayIdx ? 'bg-primary text-primary-foreground' : 'text-foreground',
										)}
									>
										{format(d, 'd')}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Rows */}
				{tasks.map(task => {
					const base = taskSpan(task)
					const live = drag && drag.id === task.id ? applyDrag(base, drag.mode, drag.delta) : base
					const s = dayOffset(live.start)
					const e = dayOffset(live.end)
					const visible = e >= 0 && s < days.length
					const left = Math.max(s, 0)
					const right = Math.min(e, days.length - 1)
					const color = cssColor(task.hex_color)
					const dragging = !!drag && drag.id === task.id && drag.moved
					return (
						<div key={task.id} className="group/row flex border-b border-border/60" style={{height: ROW_H}}>
							<button
								type="button"
								className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-card px-3 text-left text-sm transition-colors hover:bg-muted"
								style={{width: labelW}}
								onClick={() => openTask(task.id!)}
							>
								{task.done ? (
									<CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
								) : (
									<span
										className="size-2 shrink-0 rounded-full bg-primary"
										style={color ? {background: color} : undefined}
									/>
								)}
								<span className={cn('truncate', task.done && 'text-muted-foreground line-through')}>{task.title}</span>
							</button>
							<div className="relative" style={{width}}>
								{visible && (
									<div
										role="button"
										tabIndex={0}
										aria-label={`${task.title}: ${format(live.start, 'MMM d')} – ${format(live.end, 'MMM d')}`}
										title={`${task.title}\n${format(live.start, 'MMM d')} – ${format(live.end, 'MMM d')}`}
										className={cn(
											'group/bar absolute top-1.5 z-10 flex h-7 items-center overflow-hidden rounded-md text-xs font-medium shadow-xs outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
											canWrite ? 'cursor-grab' : 'cursor-pointer',
											dragging && 'cursor-grabbing shadow-md ring-2 ring-ring/40',
											task.done && 'opacity-55',
											live.placeholder
												? 'border border-dashed border-muted-foreground/50 bg-background text-muted-foreground'
												: !color && 'bg-primary text-primary-foreground',
											s < 0 && 'rounded-l-none',
											e > days.length - 1 && 'rounded-r-none',
										)}
										style={{
											left: left * dayW + 2,
											width: Math.max((right - left + 1) * dayW - 4, 8),
											...(color && !live.placeholder ? {background: color, color: contrastText(task.hex_color)} : {}),
										}}
										onPointerDown={ev => onPointerDown(ev, task, 'move')}
										onPointerMove={onPointerMove}
										onPointerUp={() => onPointerUp(task, base)}
										onPointerCancel={() => setDrag(null)}
										onKeyDown={ev => ev.key === 'Enter' && openTask(task.id!)}
									>
										{canWrite && s >= 0 && (
											<span
												className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 transition-opacity group-hover/bar:opacity-100 after:absolute after:inset-y-1.5 after:left-0.5 after:w-0.5 after:rounded-full after:bg-current/50"
												onPointerDown={ev => onPointerDown(ev, task, 'start')}
												onPointerMove={onPointerMove}
												onPointerUp={ev => {
													ev.stopPropagation()
													onPointerUp(task, base)
												}}
											/>
										)}
										{((right - left + 1) * dayW >= 96 || live.placeholder) && (
											<span className="truncate px-2.5">
												{live.placeholder && !dragging ? 'No dates · drag to schedule' : task.title}
											</span>
										)}
										{canWrite && e <= days.length - 1 && (
											<span
												className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 transition-opacity group-hover/bar:opacity-100 after:absolute after:inset-y-1.5 after:right-0.5 after:w-0.5 after:rounded-full after:bg-current/50"
												onPointerDown={ev => onPointerDown(ev, task, 'end')}
												onPointerMove={onPointerMove}
												onPointerUp={ev => {
													ev.stopPropagation()
													onPointerUp(task, base)
												}}
											/>
										)}
									</div>
								)}
								{visible && (right - left + 1) * dayW < 96 && !live.placeholder && (
									<span
										className={cn(
											'pointer-events-none absolute inset-y-0 z-10 flex items-center text-xs whitespace-nowrap text-muted-foreground',
											task.done && 'line-through',
										)}
										style={{left: (right + 1) * dayW + 4}}
									>
										{task.title}
									</span>
								)}
								{!visible && (
									<span className="absolute inset-y-0 flex items-center px-2 text-xs text-muted-foreground" style={{left: s < 0 ? 0 : undefined, right: s >= 0 ? 0 : undefined}}>
										{s < 0 ? `← ${format(live.end, 'MMM d')}` : `${format(live.start, 'MMM d')} →`}
									</span>
								)}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
