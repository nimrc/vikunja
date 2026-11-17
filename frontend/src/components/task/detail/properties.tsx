import {useState, type ReactNode} from 'react'
import {useQuery} from '@tanstack/react-query'
import {
	BellIcon,
	CalendarArrowDownIcon,
	CalendarArrowUpIcon,
	CalendarIcon,
	CheckIcon,
	CircleCheckIcon,
	CircleDashedIcon,
	CircleIcon,
	ColumnsIcon,
	FlagIcon,
	PaletteIcon,
	PercentIcon,
	RepeatIcon,
	TagIcon,
	UsersIcon,
} from 'lucide-react'
import {toast} from 'sonner'
import {bucketsList, taskBucketUpdate, type Bucket, type Project, type Task} from '@/client/generated'
import {ColorDot, ColorPicker} from '@/components/color-picker'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Separator} from '@/components/ui/separator'
import {Spinner} from '@/components/ui/spinner'
import {Tooltip} from '@/components/ui/tooltip'
import {errorMessage} from '@/lib/api'
import {displayName, formatDateTime, parseDate, PRIORITIES, relative, toApiDate} from '@/lib/format'
import {invalidateTasks} from '@/lib/queries'
import {cn} from '@/lib/utils'
import {AssigneesValue, UserChip} from './assignees'
import {DateValue} from './date-picker'
import {LabelsValue, patchDetail} from './labels'
import {RemindersValue} from './reminders'
import {RepeatValue} from './repeat'
import {Placeholder, PropertyRow, valueButton} from './shared'

const PRIORITY_COLOR: Record<number, string> = {
	1: 'text-muted-foreground',
	2: 'text-sky-600 dark:text-sky-400',
	3: 'text-amber-600 dark:text-amber-400',
	4: 'text-orange-600 dark:text-orange-400',
	5: 'text-red-600 dark:text-red-400',
}

export function PriorityIcon({priority, className}: {priority: number; className?: string}) {
	return <FlagIcon className={cn(priority ? PRIORITY_COLOR[priority] : 'text-muted-foreground', className)} />
}

export function TaskProperties({
	task,
	project,
	update,
	disabled,
}: {
	task: Task
	project?: Project
	update: (changes: Partial<Task>) => void
	disabled?: boolean
}) {
	const percent = Math.round((task.percent_done ?? 0) * 100)
	const priority = task.priority ?? 0
	const doneAt = parseDate(task.done_at)
	const created = parseDate(task.created)
	const updated = parseDate(task.updated)

	return (
		<div className="flex flex-col gap-0.5">
			<PropertyRow label="Status" icon={<CircleDashedIcon />}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild disabled={disabled}>
						<button type="button" className={valueButton}>
							{task.done ? (
								<>
									<CircleCheckIcon className="text-emerald-600 dark:text-emerald-400" />
									Done
								</>
							) : (
								<>
									<CircleIcon className="text-muted-foreground" />
									Open
								</>
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-40">
						<DropdownMenuRadioGroup value={task.done ? 'done' : 'open'} onValueChange={v => update({done: v === 'done'})}>
							<DropdownMenuRadioItem value="open">Open</DropdownMenuRadioItem>
							<DropdownMenuRadioItem value="done">Done</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</PropertyRow>

			<PropertyRow label="Priority" icon={<FlagIcon />}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild disabled={disabled}>
						<button type="button" className={valueButton}>
							{priority ? (
								<>
									<PriorityIcon priority={priority} />
									{PRIORITIES.find(p => p.value === priority)?.label}
								</>
							) : (
								<Placeholder>Set priority</Placeholder>
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-44">
						<DropdownMenuRadioGroup value={String(priority)} onValueChange={v => update({priority: Number(v)})}>
							{PRIORITIES.map(p => (
								<DropdownMenuRadioItem key={p.value} value={String(p.value)}>
									<PriorityIcon priority={p.value} />
									{p.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</PropertyRow>

			<PropertyRow label="Due date" icon={<CalendarIcon />}>
				<DateValue
					value={parseDate(task.due_date)}
					onChange={d => update({due_date: toApiDate(d)})}
					done={task.done}
					warnOverdue
					disabled={disabled}
				/>
			</PropertyRow>
			<PropertyRow label="Start date" icon={<CalendarArrowUpIcon />}>
				<DateValue value={parseDate(task.start_date)} onChange={d => update({start_date: toApiDate(d)})} disabled={disabled} />
			</PropertyRow>
			<PropertyRow label="End date" icon={<CalendarArrowDownIcon />}>
				<DateValue value={parseDate(task.end_date)} onChange={d => update({end_date: toApiDate(d)})} disabled={disabled} />
			</PropertyRow>
			<PropertyRow label="Reminders" icon={<BellIcon />}>
				<RemindersValue task={task} onChange={reminders => update({reminders})} disabled={disabled} />
			</PropertyRow>
			<PropertyRow label="Repeat" icon={<RepeatIcon />}>
				<RepeatValue task={task} onChange={update} disabled={disabled} />
			</PropertyRow>

			<PropertyRow label="Progress" icon={<PercentIcon />}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild disabled={disabled}>
						<button type="button" className={valueButton}>
							{percent ? (
								<>
									<ProgressRing value={percent} />
									<span className="tabular-nums">{percent}%</span>
								</>
							) : (
								<Placeholder>0%</Placeholder>
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-36">
						<DropdownMenuRadioGroup value={String(percent)} onValueChange={v => update({percent_done: Number(v) / 100})}>
							{Array.from({length: 11}, (_, i) => i * 10).map(p => (
								<DropdownMenuRadioItem key={p} value={String(p)} className="tabular-nums">
									<ProgressRing value={p} />
									{p}%
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</PropertyRow>

			<PropertyRow label="Color" icon={<PaletteIcon />}>
				<Popover>
					<PopoverTrigger disabled={disabled} render={<button type="button" className={valueButton} />}>
						{task.hex_color ? (
							<>
								<ColorDot color={task.hex_color} className="size-3.5" />
								<span className="font-mono text-xs uppercase">#{task.hex_color}</span>
							</>
						) : (
							<Placeholder>No color</Placeholder>
						)}
					</PopoverTrigger>
					<PopoverContent className="w-auto p-3" align="end">
						<ColorPicker value={task.hex_color ?? ''} onChange={hex => update({hex_color: hex})} />
					</PopoverContent>
				</Popover>
			</PropertyRow>

			<Separator className="my-2" />

			<PropertyRow label="Labels" icon={<TagIcon />}>
				<LabelsValue task={task} disabled={disabled} />
			</PropertyRow>
			<PropertyRow label="Assignees" icon={<UsersIcon />}>
				<AssigneesValue task={task} disabled={disabled} />
			</PropertyRow>
			{(task.buckets ?? []).map(b => (
				<BucketRow key={b.id} task={task} bucket={b} project={project} disabled={disabled} />
			))}

			<Separator className="my-2" />

			<dl className="flex flex-col gap-1.5 px-0.5 text-xs text-muted-foreground">
				{created && (
					<MetaLine label="Created" date={created}>
						{task.created_by && (
							<span className="inline-flex items-center gap-1">
								by <UserChip user={task.created_by} className="size-4" />
								<span className="text-foreground">{displayName(task.created_by)}</span>
							</span>
						)}
					</MetaLine>
				)}
				{updated && created && updated.getTime() - created.getTime() > 1000 && <MetaLine label="Updated" date={updated} />}
				{task.done && doneAt && <MetaLine label="Done" date={doneAt} />}
			</dl>
		</div>
	)
}

function MetaLine({label, date, children}: {label: string; date: Date; children?: ReactNode}) {
	return (
		<div className="flex flex-wrap items-center gap-x-1">
			<dt>{label}</dt>
			<dd className="flex flex-wrap items-center gap-x-1">
				<Tooltip label={formatDateTime(date)} render={<span />} className="text-foreground">
					{relative(date)}
				</Tooltip>
				{children}
			</dd>
		</div>
	)
}

function ProgressRing({value}: {value: number}) {
	const r = 6
	const c = 2 * Math.PI * r
	return (
		<svg viewBox="0 0 16 16" className="size-3.5 -rotate-90">
			<circle cx="8" cy="8" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
			<circle
				cx="8"
				cy="8"
				r={r}
				fill="none"
				strokeWidth="2.5"
				strokeDasharray={c}
				strokeDashoffset={c * (1 - value / 100)}
				className="stroke-primary"
			/>
		</svg>
	)
}

function BucketRow({task, bucket, project, disabled}: {task: Task; bucket: Bucket; project?: Project; disabled?: boolean}) {
	const [open, setOpen] = useState(false)
	const view = project?.views?.find(v => v.id === bucket.project_view_id)
	const viewId = bucket.project_view_id!
	const projectId = task.project_id!
	const buckets = useQuery({
		queryKey: ['buckets', projectId, viewId],
		queryFn: async ({signal}) => (await bucketsList({path: {project: projectId, view: viewId}, signal})).data.items ?? [],
		enabled: open,
	})

	const move = async (target: Bucket) => {
		if (target.id === bucket.id) return
		patchDetail(task.id!, {buckets: (task.buckets ?? []).map(b => (b.id === bucket.id ? target : b))} as Partial<Task>)
		try {
			await taskBucketUpdate({path: {project: projectId, view: viewId, bucket: target.id!}, body: {task_id: task.id}})
		} catch (e) {
			toast.error(errorMessage(e))
		} finally {
			void invalidateTasks()
		}
	}

	return (
		<PropertyRow label={view?.title ?? 'Bucket'} icon={<ColumnsIcon />}>
			<DropdownMenu open={open} onOpenChange={setOpen}>
				<DropdownMenuTrigger asChild disabled={disabled}>
					<button type="button" className={valueButton}>
						<span className="truncate">{bucket.title}</span>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-48">
					{buckets.isLoading && (
						<div className="flex justify-center py-3">
							<Spinner />
						</div>
					)}
					{buckets.data?.map(b => (
						<DropdownMenuItem key={b.id} onSelect={() => void move(b)}>
							<span className="truncate">{b.title}</span>
							{b.id === bucket.id && <CheckIcon className="ml-auto" />}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</PropertyRow>
	)
}
