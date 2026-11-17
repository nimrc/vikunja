import {useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'
import {CalendarSyncIcon, PlusIcon, Trash2Icon} from 'lucide-react'
import {toast} from 'sonner'
import {caldavTokensCreate, caldavTokensDelete, caldavTokensList, type Token} from '@/client/generated'
import {ConfirmDialog} from '@/components/confirm-dialog'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {API_BASE} from '@/lib/api'
import {formatDateTime, parseDate, relative} from '@/lib/format'
import {queryClient, useCurrentUser} from '@/lib/queries'
import {SecretBox, SettingsHeader} from './common'

const caldavKey = ['caldav-tokens'] as const

export default function Caldav() {
	const {data: user} = useCurrentUser()
	const [created, setCreated] = useState<Token | null>(null)
	const [deleting, setDeleting] = useState<Token | null>(null)
	const root = new URL(API_BASE.replace(/\/api\/v2$/, '') || '/', location.origin).href.replace(/\/$/, '')
	const url = `${root}/dav/principals/${user?.username ?? ''}/`

	const {data: tokens, isLoading} = useQuery({
		queryKey: caldavKey,
		queryFn: async ({signal}) => (await caldavTokensList({query: {per_page: 50}, signal})).data.items ?? [],
	})
	const create = useMutation({
		mutationFn: async () => (await caldavTokensCreate()).data,
		onSuccess: t => {
			setCreated(t)
			queryClient.invalidateQueries({queryKey: caldavKey})
		},
	})
	const del = useMutation({
		mutationFn: (id: number) => caldavTokensDelete({path: {id}}),
		onSuccess: () => {
			toast.success('Token deleted')
			queryClient.invalidateQueries({queryKey: caldavKey})
		},
	})

	return (
		<>
			<SettingsHeader title="CalDAV" description="Sync your tasks with calendar and reminder apps like Thunderbird, DAVx⁵ or Apple Reminders." />
			<div className="grid gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Server URL</CardTitle>
						<CardDescription>
							Sign in with your username <span className="font-medium text-foreground">{user?.username}</span> and a
							CalDAV token as the password.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<SecretBox value={url} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
						<div className="grid gap-1.5">
							<CardTitle>Tokens</CardTitle>
							<CardDescription>Use one token per device so you can revoke them separately.</CardDescription>
						</div>
						<Button variant="outline" disabled={create.isPending} onClick={() => create.mutate()}>
							<PlusIcon />
							Create token
						</Button>
					</CardHeader>
					<CardContent className="grid gap-4 px-0">
						{created?.token && (
							<div className="px-4">
								<Alert>
									<CalendarSyncIcon />
									<AlertTitle>Copy your new token now</AlertTitle>
									<AlertDescription className="grid gap-2">
										<span>It won't be shown again.</span>
										<SecretBox value={created.token} className="w-full" />
									</AlertDescription>
								</Alert>
							</div>
						)}
						{isLoading ? (
							<div className="grid gap-2 px-4">
								<Skeleton className="h-10" />
							</div>
						) : !tokens?.length ? (
							<p className="px-4 text-sm text-muted-foreground">No CalDAV tokens yet.</p>
						) : (
							<ul className="-mb-4 divide-y border-t">
								{tokens.map(t => {
									const c = parseDate(t.created)
									return (
										<li key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
											<span className="font-mono text-xs text-muted-foreground">#{t.id}</span>
											<span className="flex-1" title={c ? formatDateTime(c) : undefined}>
												Created {c ? relative(c) : ''}
											</span>
											<Button variant="ghost" size="icon-sm" aria-label="Delete token" onClick={() => setDeleting(t)}>
												<Trash2Icon />
											</Button>
										</li>
									)
								})}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>
			<ConfirmDialog
				open={!!deleting}
				onOpenChange={o => !o && setDeleting(null)}
				title="Delete this CalDAV token?"
				description="Devices using it stop syncing until you give them a new token."
				onConfirm={() => deleting?.id && del.mutateAsync(deleting.id)}
			/>
		</>
	)
}
