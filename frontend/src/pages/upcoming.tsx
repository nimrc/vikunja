import {useMemo, useState} from 'react'
import {addDays, format, isBefore, startOfDay} from 'date-fns'
import {CalendarCheck2Icon} from 'lucide-react'
import type {Task} from '@/client/generated'
import {Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Label} from '@/components/ui/label'
import {Skeleton} from '@/components/ui/skeleton'
import {Switch} from '@/components/ui/switch'
import {ToggleGroup, ToggleGroupItem} from '@/components/ui/toggle-group'
import {TaskRow} from '@/components/task/task-row'
import {parseDate} from '@/lib/format'
import {useAllTasks, useProjects} from '@/lib/queries'

const RANGES = {
	today: {label: 'Today', days: 1},
	week: {label: 'Next 7 days', days: 7},
	month: {label: 'Next 30 days', days: 30},
} as const

type RangeKey = keyof typeof RANGES

export default function Upcoming() {
	const [range, setRange] = useState<RangeKey>('week')
	const [overdue, setOverdue] = useState(true)
	const days = RANGES[range].days
	const filter = overdue
		? `done = false && due_date < now/d+${days}d`
		: `done = false && due_date >= now/d && due_date < now/d+${days}d`
	const query = useAllTasks({filter, sort_by: ['due_date', 'id'], order_by: ['asc', 'asc'], per_page: 250, expand: ['comment_count']})
	const {projects} = useProjects()
	const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

	const groups = useMemo(() => {
		const today = startOfDay(new Date())
		const map = new Map<string, {title: string; overdue: boolean; tasks: Task[]}>()
		for (const t of query.data?.items ?? []) {
			const due = parseDate(t.due_date)
			if (!due) continue
			const isOverdue = isBefore(due, today)
			const key = isOverdue ? 'overdue' : format(due, 'yyyy-MM-dd')
			const title = isOverdue ? 'Overdue' : dayTitle(due, today)
			if (!map.has(key)) map.set(key, {title, overdue: isOverdue, tasks: []})
			map.get(key)!.tasks.push(t)
		}
		return [...map.values()]
	}, [query.data])

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Upcoming</h1>
					<p className="text-sm text-muted-foreground">Open tasks with a due date, across all projects.</p>
				</div>
				<div className="flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-2">
						<Switch id="show-overdue" checked={overdue} onCheckedChange={setOverdue} />
						<Label htmlFor="show-overdue" className="font-normal">
							Overdue
						</Label>
					</div>
					<ToggleGroup type="single" variant="outline" size="sm" value={range} onValueChange={v => v && setRange(v as RangeKey)}>
						{Object.entries(RANGES).map(([k, r]) => (
							<ToggleGroupItem key={k} value={k} className="px-3">
								{r.label}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			</div>

			{query.isPending ? (
				<div className="flex flex-col gap-2">
					{Array.from({length: 5}, (_, i) => (
						<Skeleton key={i} className="h-12 w-full" />
					))}
				</div>
			) : groups.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<CalendarCheck2Icon />
						</EmptyMedia>
						<EmptyTitle>Nothing due</EmptyTitle>
						<EmptyDescription>No open tasks are due in this period.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				groups.map(g => (
					<section key={g.title} className="flex flex-col gap-2">
						<h2 className={g.overdue ? 'text-sm font-semibold text-destructive' : 'text-sm font-semibold'}>
							{g.title}
							<span className="ml-2 font-normal text-muted-foreground tabular-nums">{g.tasks.length}</span>
						</h2>
						<div className="flex flex-col rounded-xl border bg-card p-1">
							{g.tasks.map(t => (
								<TaskRow key={t.id} task={t} project={projectById.get(t.project_id)} showProject />
							))}
						</div>
					</section>
				))
			)}
		</div>
	)
}

function dayTitle(d: Date, today: Date) {
	const day = startOfDay(d)
	if (day.getTime() === today.getTime()) return `Today · ${format(d, 'EEE, MMM d')}`
	if (day.getTime() === addDays(today, 1).getTime()) return `Tomorrow · ${format(d, 'EEE, MMM d')}`
	return format(d, 'EEEE, MMM d')
}
