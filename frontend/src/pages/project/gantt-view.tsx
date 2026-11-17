import {useState} from 'react'
import {keepPreviousData, useQuery} from '@tanstack/react-query'
import {addDays, endOfMonth, format, isSameYear, startOfDay, startOfMonth, subDays} from 'date-fns'
import {CalendarRangeIcon, GanttChartIcon} from 'lucide-react'
import type {DateRange} from 'react-day-picker'
import {projectViewTasksList, type Project, type ProjectView, type Task} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Calendar} from '@/components/ui/calendar'
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Skeleton} from '@/components/ui/skeleton'
import {Spinner} from '@/components/ui/spinner'
import {Switch} from '@/components/ui/switch'
import {useIsMobile} from '@/hooks/use-mobile'
import {GanttChart} from './gantt/gantt-chart'

function defaultRange(): {from: Date; to: Date} {
	const now = new Date()
	return {from: subDays(startOfMonth(now), 14), to: startOfDay(addDays(endOfMonth(now), 14))}
}

const day = (d: Date) => format(d, 'yyyy-MM-dd')

function ganttFilter(from: Date, to: Date) {
	const f = `"${day(from)}"`
	const t = `"${day(to)}"`
	return (
		`((start_date >= ${f} && start_date <= ${t}) || ` +
		`(end_date >= ${f} && end_date <= ${t}) || ` +
		`(due_date >= ${f} && due_date <= ${t}) || ` +
		`(start_date <= ${f} && end_date >= ${t}))`
	)
}

async function fetchGanttTasks(project: number, view: number, from: Date, to: Date, includeNulls: boolean, signal: AbortSignal) {
	const out: Task[] = []
	for (let page = 1; ; page++) {
		const {data} = await projectViewTasksList({
			path: {project, view},
			query: {
				page,
				per_page: 250,
				sort_by: ['start_date', 'done', 'id'],
				order_by: ['asc', 'asc', 'desc'],
				filter: ganttFilter(from, to),
				filter_include_nulls: includeNulls,
				filter_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
			signal,
		})
		out.push(...(data.items ?? []))
		if (!data.total_pages || page >= data.total_pages) return out
	}
}

function rangeLabel(from: Date, to: Date) {
	const sameYear = isSameYear(from, to)
	return `${format(from, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`
}

export function GanttView({project, view}: {project: Project; view: ProjectView}) {
	const [range, setRange] = useState(defaultRange)
	const [draft, setDraft] = useState<DateRange | undefined>()
	const [pickerOpen, setPickerOpen] = useState(false)
	const [showUndated, setShowUndated] = useState(false)
	const isMobile = useIsMobile()
	const canWrite = project.max_permission == null || project.max_permission > 0

	const q = useQuery({
		queryKey: ['tasks', 'gantt', project.id, view.id, day(range.from), day(range.to), showUndated],
		queryFn: ({signal}) => fetchGanttTasks(project.id!, view.id!, range.from, range.to, showUndated, signal),
		placeholderData: keepPreviousData,
	})

	return (
		<div className="flex h-full min-h-0 flex-col gap-3 p-4 md:px-6">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<Popover
					open={pickerOpen}
					onOpenChange={o => {
						setPickerOpen(o)
						if (o) setDraft({from: range.from, to: range.to})
					}}
				>
					<PopoverTrigger render={<Button size="sm" className="font-normal" />}>
						<CalendarRangeIcon />
						{rangeLabel(range.from, range.to)}
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							mode="range"
							numberOfMonths={isMobile ? 1 : 2}
							defaultMonth={draft?.from}
							selected={draft}
							onSelect={setDraft}
						/>
						<div className="flex items-center justify-end gap-2 border-t p-2">
							<Button
								size="sm"
								onClick={() => {
									setRange(defaultRange())
									setPickerOpen(false)
								}}
							>
								Reset
							</Button>
							<Button
								tone="primary"
								size="sm"
								disabled={!draft?.from || !draft?.to}
								onClick={() => {
									if (draft?.from && draft.to) setRange({from: startOfDay(draft.from), to: startOfDay(draft.to)})
									setPickerOpen(false)
								}}
							>
								Apply
							</Button>
						</div>
					</PopoverContent>
				</Popover>
				<Switch
					label="Show tasks without dates"
					checked={showUndated}
					onCheckedChange={setShowUndated}
				/>
				<div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
					{q.isFetching && !q.isPending && <Spinner className="size-3.5" />}
					{q.data && `${q.data.length} ${q.data.length === 1 ? 'task' : 'tasks'}`}
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
				{q.isPending ? (
					<div className="flex flex-col gap-3 p-4">
						<Skeleton className="h-10 w-full" />
						{[60, 40, 75, 30, 50].map((w, i) => (
							<Skeleton key={i} className="h-7" style={{width: `${w}%`, marginLeft: `${i * 6}%`}} />
						))}
					</div>
				) : q.isError ? (
					<Empty className="flex-1">
						<EmptyHeader>
							<EmptyTitle>Couldn’t load tasks</EmptyTitle>
							<EmptyDescription>{q.error.message}</EmptyDescription>
						</EmptyHeader>
						<Button size="sm" onClick={() => q.refetch()}>
							Retry
						</Button>
					</Empty>
				) : q.data.length === 0 ? (
					<Empty className="flex-1">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<GanttChartIcon />
							</EmptyMedia>
							<EmptyTitle>Nothing scheduled</EmptyTitle>
							<EmptyDescription>
								No tasks have dates between {rangeLabel(range.from, range.to)}. Pick another range or show tasks
								without dates.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<GanttChart tasks={q.data} from={range.from} to={range.to} canWrite={canWrite} />
				)}
			</div>
		</div>
	)
}

export default GanttView
