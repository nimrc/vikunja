import {useMutation, useQuery} from '@tanstack/react-query'
import {LaptopIcon, LogOutIcon, SmartphoneIcon, TerminalIcon} from 'lucide-react'
import {toast} from 'sonner'
import {sessionsDelete, sessionsList, type Session} from '@/client/generated'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Skeleton} from '@/components/ui/skeleton'
import {getToken, tokenPayload} from '@/lib/api'
import {formatDateTime, parseDate, relative} from '@/lib/format'
import {queryClient} from '@/lib/queries'
import {SettingsHeader} from './common'

const sessionsKey = ['sessions'] as const

/** Rough, dependency-free user-agent summary: "Chrome on Linux". */
function describeAgent(ua = '') {
	if (!ua) return {label: 'Unknown device', icon: LaptopIcon}
	if (!/Mozilla/.test(ua)) return {label: ua.split(' ')[0], icon: TerminalIcon}
	const browser =
		/Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
	const os = /Android/.test(ua)
		? 'Android'
		: /iPhone|iPad/.test(ua)
			? 'iOS'
			: /Mac OS X/.test(ua)
				? 'macOS'
				: /Windows/.test(ua)
					? 'Windows'
					: /Linux/.test(ua)
						? 'Linux'
						: ''
	const mobile = /Android|iPhone|iPad|Mobile/.test(ua)
	return {label: os ? `${browser} on ${os}` : browser, icon: mobile ? SmartphoneIcon : LaptopIcon}
}

export default function Sessions() {
	const currentId = tokenPayload(getToken()) as {sid?: string} | null
	const {data: sessions, isLoading} = useQuery({
		queryKey: sessionsKey,
		queryFn: async ({signal}) => (await sessionsList({query: {per_page: 50}, signal})).data.items ?? [],
	})
	const sorted = [...(sessions ?? [])].sort((a, b) =>
		a.id === currentId?.sid ? -1 : b.id === currentId?.sid ? 1 : (b.last_active ?? '').localeCompare(a.last_active ?? ''),
	)
	const others = sorted.filter(s => s.id !== currentId?.sid)

	const revoke = useMutation({
		mutationFn: (id: string) => sessionsDelete({path: {session: id}}),
		onSuccess: () => queryClient.invalidateQueries({queryKey: sessionsKey}),
	})
	const revokeOthers = useMutation({
		// Sequential: parallel deletes trip SQLite's write lock.
		mutationFn: async () => {
			for (const s of others) await sessionsDelete({path: {session: s.id!}})
		},
		onSuccess: () => toast.success('Signed out of all other sessions'),
		onSettled: () => queryClient.invalidateQueries({queryKey: sessionsKey}),
	})

	return (
		<>
			<SettingsHeader
				title="Sessions"
				description="Devices currently signed in to your account. API tokens are managed separately."
				action={
					others.length > 0 ? (
						<Button variant="outline" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
							<LogOutIcon />
							Sign out other sessions
						</Button>
					) : undefined
				}
			/>
			{isLoading ? (
				<Skeleton className="h-40 rounded-xl" />
			) : (
				<ul className="divide-y overflow-hidden rounded-xl border bg-card">
					{sorted.map(s => (
						<SessionRow
							key={s.id}
							session={s}
							current={s.id === currentId?.sid}
							busy={revoke.isPending && revoke.variables === s.id}
							onRevoke={() => revoke.mutate(s.id!)}
						/>
					))}
				</ul>
			)}
		</>
	)
}

function SessionRow({session, current, busy, onRevoke}: {session: Session; current: boolean; busy: boolean; onRevoke: () => void}) {
	const {label, icon: Icon} = describeAgent(session.device_info)
	const active = parseDate(session.last_active)
	const created = parseDate(session.created)
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
			<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
				<Icon className="size-4" />
			</span>
			<div className="grid min-w-0 flex-1 gap-0.5">
				<div className="flex items-center gap-2">
					<span className="truncate text-sm font-medium" title={session.device_info}>
						{label}
					</span>
					{current && <Badge variant="secondary">This device</Badge>}
				</div>
				<span className="truncate text-xs text-muted-foreground">
					{session.ip_address}
					{active && <span title={formatDateTime(active)}> · active {relative(active)}</span>}
					{created && <span title={formatDateTime(created)}> · signed in {relative(created)}</span>}
				</span>
			</div>
			{!current && (
				<Button variant="ghost" size="sm" disabled={busy} onClick={onRevoke}>
					Sign out
				</Button>
			)}
		</li>
	)
}
