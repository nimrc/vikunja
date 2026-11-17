import {useMemo, useState, type ReactNode} from 'react'
import {useNavigate} from 'react-router'
import {useInfiniteQuery, useMutation} from '@tanstack/react-query'
import {BellIcon, CheckCheckIcon, KeyRoundIcon, Trash2Icon} from 'lucide-react'
import {
	notificationsDeleteAll,
	notificationsList,
	notificationsMarkAllRead,
	notificationsMarkRead,
	type DatabaseNotifications,
	type User,
} from '@/client/generated'
import {UserAvatarPlain} from '@/components/user-picker'
import {Button} from '@/components/ui/button'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {ScrollArea} from '@/components/ui/scroll-area'
import {Tooltip} from '@/components/ui/tooltip'
import {displayName, formatDateTime, parseDate, relative} from '@/lib/format'
import {useOpenTask} from '@/lib/navigation'
import {queryClient, useCurrentUser} from '@/lib/queries'
import {cn} from '@/lib/utils'

const KEY = ['notifications'] as const
const PER_PAGE = 30

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' ? (v as Rec) : {})
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : 0)

function taskRef(task: Rec) {
	const identifier = str(task.identifier)
	const index = num(task.index)
	return identifier && identifier !== `-${index}` ? identifier : `#${index}`
}

type Target = {task: number} | {project: number} | {team: number} | {path: string} | null

type Row = {
	id: number
	doer?: User
	text: ReactNode
	created: Date | null
	read: boolean
	target: Target
}

function T({children}: {children: ReactNode}) {
	return <span className="font-medium text-foreground">{children}</span>
}

function describe(n: DatabaseNotifications, me?: {id?: number}): Omit<Row, 'id' | 'created' | 'read'> {
	const p = rec(n.notification)
	const task = rec(p.task)
	const project = rec(p.project)
	const doer = typeof rec(p.doer).id === 'number' ? (p.doer as User) : undefined
	const taskTarget = num(task.id) > 0 ? {task: num(task.id)} : null
	const taskLabel = (
		<T>
			{taskRef(task)}
			{str(task.title) && ` ${str(task.title)}`}
		</T>
	)

	switch (n.name) {
		case 'task.comment':
			return {doer, text: <>commented on {taskLabel}</>, target: taskTarget}
		case 'task.mentioned':
			return {doer, text: <>mentioned you on {taskLabel}</>, target: taskTarget}
		case 'task.assigned': {
			const assignee = rec(p.assignee)
			const who = me?.id === assignee.id ? 'you' : displayName(assignee as User)
			return {doer, text: <>assigned {who} to {taskLabel}</>, target: taskTarget}
		}
		case 'task.deleted':
			return {doer, text: <>deleted {taskLabel}</>, target: null}
		case 'task.created':
			return {doer, text: <>created {taskLabel}</>, target: taskTarget}
		case 'task.reminder':
			return {
				doer,
				text: (
					<>
						Reminder for {taskLabel}
						{str(project.title) && <> in {str(project.title)}</>}
					</>
				),
				target: taskTarget,
			}
		case 'task.undone.overdue':
			return {doer, text: <>{taskLabel} is overdue</>, target: taskTarget}
		case 'project.created':
			return {
				doer,
				text: <>created the project <T>{str(project.title)}</T></>,
				target: num(project.id) > 0 ? {project: num(project.id)} : null,
			}
		case 'team.member.added': {
			const member = rec(p.member)
			const team = rec(p.team)
			const who = me?.id === member.id ? 'you' : displayName(member as User)
			return {
				doer,
				text: (
					<>
						added {who} to the <T>{str(team.name)}</T> team
					</>
				),
				target: num(team.id) > 0 ? {team: num(team.id)} : null,
			}
		}
		case 'api_token.expiring.week':
		case 'api_token.expiring.day': {
			const token = rec(p.api_token)
			return {
				text: (
					<>
						API token <T>{str(token.title)}</T> expires {n.name.endsWith('day') ? 'tomorrow' : 'within a week'}
					</>
				),
				target: {path: '/settings/api-tokens'},
			}
		}
		case 'data.export.ready':
			return {text: <>Your data export is ready to download</>, target: {path: '/settings/data-export'}}
	}
	return {doer, text: <span className="text-muted-foreground">{n.name}</span>, target: null}
}

export function NotificationsButton() {
	const [open, setOpen] = useState(false)
	const navigate = useNavigate()
	const openTask = useOpenTask()
	const {data: me} = useCurrentUser()

	const q = useInfiniteQuery({
		queryKey: KEY,
		queryFn: async ({pageParam, signal}) =>
			(await notificationsList({query: {page: pageParam, per_page: PER_PAGE}, signal})).data,
		initialPageParam: 1,
		getNextPageParam: (last, _all, page) => ((last.total_pages ?? 0) > page ? page + 1 : undefined),
		refetchInterval: 60_000,
		staleTime: 15_000,
	})

	const rows = useMemo<Row[]>(() => {
		const seen = new Map<number, DatabaseNotifications>()
		// A notification arriving between page loads shifts offsets and repeats a row.
		for (const page of q.data?.pages ?? []) for (const n of page.items ?? []) if (n.id) seen.set(n.id, n)
		return [...seen.values()].map(n => ({
			id: n.id!,
			created: parseDate(n.created),
			read: !!parseDate(n.read_at),
			...describe(n, me),
		}))
	}, [q.data, me])
	const unread = rows.filter(r => !r.read).length

	const invalidate = () => queryClient.invalidateQueries({queryKey: KEY})
	const markRead = useMutation({
		mutationFn: (id: number) => notificationsMarkRead({path: {notificationid: id}, body: {read: true}}),
		onSuccess: invalidate,
	})
	const markAll = useMutation({mutationFn: () => notificationsMarkAllRead(), onSuccess: invalidate})
	const clearAll = useMutation({mutationFn: () => notificationsDeleteAll(), onSuccess: invalidate})

	function go(r: Row) {
		if (!r.read) markRead.mutate(r.id)
		if (!r.target) return
		setOpen(false)
		const t = r.target
		if ('task' in t) openTask(t.task)
		else if ('project' in t) navigate(`/projects/${t.project}`)
		else if ('team' in t) navigate(`/teams/${t.team}`)
		else navigate(t.path)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						round
						className="relative"
						aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
					/>
				}
			>
				<BellIcon />
				{unread > 0 && (
					<span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
				)}
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
				initialFocus="none"
			>
				<div className="flex items-center gap-1 border-b px-4 py-2.5">
					<div className="flex-1">
						<p className="text-sm font-semibold">Notifications</p>
						<p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : 'All caught up'}</p>
					</div>
					{unread > 0 && (
						<Tooltip label="Mark all as read" onClick={() => markAll.mutate()}>
							<CheckCheckIcon />
						</Tooltip>
					)}
					{rows.length > 0 && (
						<Tooltip label="Clear all" onClick={() => clearAll.mutate()}>
							<Trash2Icon />
						</Tooltip>
					)}
				</div>
				{rows.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
						<div className="flex size-9 items-center justify-center rounded-lg bg-muted">
							<BellIcon className="size-4" />
						</div>
						<p className="text-sm font-medium">{q.isLoading ? 'Loading…' : 'No notifications'}</p>
						<p className="text-xs text-muted-foreground">
							You'll hear about comments, assignments and reminders on tasks you follow here.
						</p>
					</div>
				) : (
					<ScrollArea className="max-h-[min(28rem,70vh)]">
						<ul className="p-1">
							{rows.map(r => (
								<li key={r.id}>
									<button
										type="button"
										onClick={() => go(r)}
										className={cn(
											'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
											r.read && 'opacity-70',
										)}
									>
										{r.doer ? (
											<UserAvatarPlain user={r.doer} size={28} />
										) : (
											<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
												<KeyRoundIcon className="size-3.5" />
											</span>
										)}
										<span className="min-w-0 flex-1">
											<span className="block text-muted-foreground">
												{r.doer && <span className="font-medium text-foreground">{displayName(r.doer)} </span>}
												{r.text}
											</span>
											{r.created && (
												<span className="text-xs text-muted-foreground" title={formatDateTime(r.created)}>
													{relative(r.created)}
												</span>
											)}
										</span>
										{!r.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
									</button>
								</li>
							))}
						</ul>
						{q.hasNextPage && (
							<div className="p-2 pt-0">
								<Button
									size="sm"
									className="w-full"
									disabled={q.isFetchingNextPage}
									onClick={() => q.fetchNextPage()}
								>
									Load more
								</Button>
							</div>
						)}
					</ScrollArea>
				)}
			</PopoverContent>
		</Popover>
	)
}
