import {useMemo, useState} from 'react'
import {useSearchParams} from 'react-router'
import {useMutation, useQuery} from '@tanstack/react-query'
import {addDays, format} from 'date-fns'
import {CalendarIcon, KeyRoundIcon, PlusIcon, TerminalIcon, Trash2Icon} from 'lucide-react'
import {toast} from 'sonner'
import {tokenRoutes, tokensCreate, tokensDelete, tokensList, type ApiToken} from '@/client/generated'
import {ConfirmDialog} from '@/components/confirm-dialog'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Calendar} from '@/components/ui/calendar'
import {Checkbox} from '@/components/ui/checkbox'
import {Dialog, DialogActions, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog'
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Field, FieldError, FieldLabel} from '@/components/ui/field'
import {HoverCard} from '@/components/ui/hover-card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {SelectMenu} from '@/components/ui/select'
import {Skeleton} from '@/components/ui/skeleton'
import {Tooltip} from '@/components/ui/tooltip'
import {API_BASE} from '@/lib/api'
import {formatDateTime, parseDate, relative} from '@/lib/format'
import {queryClient} from '@/lib/queries'
import {cn} from '@/lib/utils'
import {CopyButton, SecretBox, SettingsHeader} from './common'

const tokensKey = ['api-tokens'] as const
type Routes = Record<string, string[]>
type Selection = Record<string, Set<string>>

const PRESETS: {id: string; label: string; groups: Record<string, string[] | '*'>}[] = [
	{id: 'read', label: 'Read only', groups: {'*': ['read_one', 'read_all', 'read']}},
	{
		id: 'tasks',
		label: 'Tasks',
		groups: {
			tasks: '*',
			tasks_attachments: '*',
			tasks_assignees: '*',
			tasks_labels: '*',
			tasks_comments: '*',
			tasks_relations: '*',
			labels: ['read_one', 'read_all', 'create'],
			projects: ['read_one', 'read_all', 'views_buckets_tasks_update'],
			projects_views: ['read_one', 'read_all'],
			projects_views_tasks: ['read_one', 'read_all'],
		},
	},
	{
		id: 'projects',
		label: 'Projects',
		groups: {
			projects: '*',
			projects_views: '*',
			projects_teams: '*',
			projects_users: '*',
			projects_shares: '*',
			projects_webhooks: '*',
			projects_views_tasks: '*',
			tasks: ['read_one', 'read_all'],
			teams: ['read_one', 'read_all'],
		},
	},
	{id: 'full', label: 'Full access', groups: {'*': '*'}},
]

const EXPIRY = [
	{value: '7', label: '7 days'},
	{value: '30', label: '30 days'},
	{value: '60', label: '60 days'},
	{value: '90', label: '90 days'},
	{value: '365', label: '1 year'},
	{value: 'custom', label: 'Custom date'},
]

const human = (s: string) => s.replaceAll('_', ' ')
const humanGroup = (s: string) => {
	const h = human(s)
	return h.charAt(0).toUpperCase() + h.slice(1)
}

function useTokenRoutes() {
	return useQuery({
		queryKey: ['token-routes'],
		queryFn: async ({signal}): Promise<Routes> => {
			const data = (await tokenRoutes({signal})).data
			const entries = Object.entries(data).map(([g, r]) => [g, Object.keys(r).sort()] as const)
			// "other" is a grab bag; keep it last.
			entries.sort(([a], [b]) => (a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b)))
			return Object.fromEntries(entries)
		},
		staleTime: Infinity,
	})
}

export default function ApiTokens() {
	const [params, setParams] = useSearchParams()
	// Tools can deep-link here with ?title=…&scopes=group:perm,group:perm to prefill the form.
	const prefill = useMemo(() => {
		const title = params.get('title') ?? ''
		const scopes = params.get('scopes') ?? ''
		return title || scopes ? {title, scopes} : null
	}, [params])
	const [creating, setCreating] = useState(!!prefill)
	const [created, setCreated] = useState<ApiToken | null>(null)
	const [deleting, setDeleting] = useState<ApiToken | null>(null)

	const {data: tokens, isLoading} = useQuery({
		queryKey: tokensKey,
		queryFn: async ({signal}) => (await tokensList({query: {per_page: 50}, signal})).data.items ?? [],
	})
	const del = useMutation({
		mutationFn: (id: number) => tokensDelete({path: {id}}),
		onSuccess: () => {
			toast.success('Token deleted')
			queryClient.invalidateQueries({queryKey: tokensKey})
		},
	})

	const closeCreate = (o: boolean) => {
		setCreating(o)
		if (!o && prefill) setParams({}, {replace: true})
	}

	return (
		<>
			<SettingsHeader
				title="API tokens"
				description={
					<>
						Let scripts, CLIs and agents call the API as you, limited to the scopes you pick.{' '}
						<a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
							API docs
						</a>
					</>
				}
				action={
					tokens?.length ? (
						<Button tone="primary" onClick={() => setCreating(true)}>
							<PlusIcon />
							New token
						</Button>
					) : undefined
				}
			/>

			{isLoading ? (
				<div className="grid gap-2">
					<Skeleton className="h-16 rounded-xl" />
					<Skeleton className="h-16 rounded-xl" />
				</div>
			) : !tokens?.length ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<KeyRoundIcon />
						</EmptyMedia>
						<EmptyTitle>No API tokens</EmptyTitle>
						<EmptyDescription>Create a token to use Vikunja from scripts, a CLI or an AI agent.</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button tone="primary" onClick={() => setCreating(true)}>
							<PlusIcon />
							Create token
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<ul className="divide-y overflow-hidden rounded-xl border bg-card">
					{tokens.map(t => (
						<TokenRow key={t.id} token={t} onDelete={() => setDeleting(t)} />
					))}
				</ul>
			)}

			<Dialog open={creating} onOpenChange={closeCreate}>
				<DialogContent>
					{creating && (
						<CreateTokenForm
							prefill={prefill}
							onCancel={() => closeCreate(false)}
							onCreated={t => {
								closeCreate(false)
								setCreated(t)
							}}
						/>
					)}
				</DialogContent>
			</Dialog>

			<Dialog open={!!created} onOpenChange={o => !o && setCreated(null)}>
				<DialogContent>
					{created && <CreatedToken token={created} onDone={() => setCreated(null)} />}
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={!!deleting}
				onOpenChange={o => !o && setDeleting(null)}
				title={`Delete “${deleting?.title}”?`}
				description="Anything still using this token stops working immediately."
				onConfirm={() => deleting?.id && del.mutateAsync(deleting.id)}
			/>
		</>
	)
}

function TokenRow({token, onDelete}: {token: ApiToken; onDelete: () => void}) {
	const expires = parseDate(token.expires_at)
	const created = parseDate(token.created)
	const expired = !!expires && expires.getTime() < Date.now()
	const groups = Object.entries(token.permissions ?? {}).filter(([, p]) => p?.length)
	const total = groups.reduce((n, [, p]) => n + (p?.length ?? 0), 0)
	return (
		<li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
			<span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted', expired && 'opacity-50')}>
				<KeyRoundIcon className="size-4" />
			</span>
			<div className="grid min-w-0 flex-1 gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className={cn('truncate text-sm font-medium', expired && 'text-muted-foreground line-through')}>{token.title}</span>
					{expired && <Badge tone="danger">Expired</Badge>}
				</div>
				<div className="flex flex-wrap items-center gap-1">
					{groups.slice(0, 4).map(([g]) => (
						<Badge key={g} tone="neutral" className="font-normal text-muted-foreground">
							{human(g)}
						</Badge>
					))}
					<HoverCard
						trigger={
							<span className="cursor-default text-xs text-muted-foreground">
								{groups.length > 4 && `+${groups.length - 4} more · `}
								{total} scope{total === 1 ? '' : 's'}
							</span>
						}
					>
						<div className="grid max-w-sm gap-0.5 text-xs">
							{groups.map(([g, p]) => (
								<div key={g}>
									<span className="font-medium">{g}</span>: {p?.join(', ')}
								</div>
							))}
						</div>
					</HoverCard>
				</div>
			</div>
			<div className="grid text-right text-xs text-muted-foreground">
				{expires && (
					<span title={formatDateTime(expires)} className={cn(expired && 'text-destructive')}>
						{expired ? 'Expired' : 'Expires'} {relative(expires)}
					</span>
				)}
				{created && <span title={formatDateTime(created)}>Created {relative(created)}</span>}
			</div>
			<Tooltip
				label="Delete token"
				aria-label={`Delete ${token.title}`}
				render={<Button round onClick={onDelete} />}
			>
				<Trash2Icon />
			</Tooltip>
		</li>
	)
}

function applyScopes(routes: Routes, groups: Record<string, string[] | '*'>): Selection {
	const sel: Selection = {}
	for (const [g, perms] of Object.entries(routes)) {
		const want = groups[g] ?? groups['*']
		if (!want) continue
		const picked = want === '*' ? perms : perms.filter(p => want.includes(p))
		if (picked.length) sel[g] = new Set(picked)
	}
	return sel
}

function parseScopes(raw: string): Record<string, string[]> {
	const out: Record<string, string[]> = {}
	for (const pair of raw.split(',')) {
		const [g, p] = pair.split(':').map(s => s?.trim())
		if (g && p) (out[g] ??= []).push(p)
	}
	return out
}

function CreateTokenForm({
	prefill,
	onCancel,
	onCreated,
}: {
	prefill: {title: string; scopes: string} | null
	onCancel: () => void
	onCreated: (t: ApiToken) => void
}) {
	const {data: routes} = useTokenRoutes()
	const [title, setTitle] = useState(prefill?.title ?? '')
	const [expiry, setExpiry] = useState('30')
	const [customDate, setCustomDate] = useState<Date | undefined>(addDays(new Date(), 30))
	const [selection, setSelection] = useState<Selection | null>(null)
	const [preset, setPreset] = useState<string | null>(null)
	const [triedSubmit, setTriedSubmit] = useState(false)

	// Seed once routes arrive: from the deep link if any, else nothing selected.
	const sel: Selection = useMemo(
		() => selection ?? (routes && prefill?.scopes ? applyScopes(routes, parseScopes(prefill.scopes)) : {}),
		[selection, routes, prefill],
	)
	const update = (next: Selection) => {
		setSelection(next)
		setPreset(null)
	}
	const count = Object.values(sel).reduce((n, s) => n + s.size, 0)
	const allPerms = routes ? Object.values(routes).reduce((n, p) => n + p.length, 0) : 0
	const expiresAt = expiry === 'custom' ? customDate : addDays(new Date(), Number(expiry))
	const expiryValid = !!expiresAt && expiresAt.getTime() > Date.now()

	const toggle = (g: string, p: string, on: boolean) => {
		const next = {...sel, [g]: new Set(sel[g])}
		if (on) next[g].add(p)
		else next[g].delete(p)
		update(next)
	}
	const toggleGroup = (g: string, on: boolean) => update({...sel, [g]: new Set(on ? routes![g] : [])})
	const toggleAll = (on: boolean) =>
		update(on && routes ? Object.fromEntries(Object.entries(routes).map(([g, p]) => [g, new Set(p)])) : {})

	const create = useMutation({
		mutationFn: async () => {
			const permissions = Object.fromEntries(
				Object.entries(sel)
					.filter(([, s]) => s.size)
					.map(([g, s]) => [g, [...s]]),
			)
			return (await tokensCreate({body: {title: title.trim(), expires_at: expiresAt!.toISOString(), permissions}})).data
		},
		onSuccess: t => {
			queryClient.invalidateQueries({queryKey: tokensKey})
			onCreated(t)
		},
	})

	return (
		<form
			className="flex min-h-0 flex-1 flex-col"
			onSubmit={e => {
				e.preventDefault()
				setTriedSubmit(true)
				if (title.trim() && count > 0 && expiryValid) create.mutate()
			}}
		>
			<DialogTitle>New API token</DialogTitle>
			<DialogDescription>The token is shown once after creation. Grant only what the tool needs.</DialogDescription>
			<div className="grid max-h-[60dvh] min-h-0 flex-1 gap-5 overflow-y-auto py-4">
				<div className="grid gap-4 sm:grid-cols-[1fr_auto]">
					<Field data-invalid={(triedSubmit && !title.trim()) || undefined}>
						<FieldLabel htmlFor="token-title">Name</FieldLabel>
						<Input
							id="token-title"
							autoFocus
							placeholder="e.g. Agent CLI on devbox"
							value={title}
							aria-invalid={(triedSubmit && !title.trim()) || undefined}
							onChange={e => setTitle(e.target.value)}
						/>
					</Field>
					<Field data-invalid={!expiryValid || undefined}>
						<FieldLabel>Expires</FieldLabel>
						<div className="flex gap-2">
							<SelectMenu label="Expires" options={EXPIRY} value={expiry} onValueChange={setExpiry} />
							{expiry === 'custom' && (
								<Popover>
									<PopoverTrigger render={<Button className="font-normal" />}>
										<CalendarIcon />
										{customDate ? format(customDate, 'MMM d, yyyy') : 'Pick a date'}
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="end">
										<Calendar
											mode="single"
											selected={customDate}
											onSelect={d => setCustomDate(d ?? undefined)}
											disabled={{before: addDays(new Date(), 1)}}
										/>
									</PopoverContent>
								</Popover>
							)}
						</div>
						{expiry !== 'custom' && expiresAt && (
							<span className="text-xs text-muted-foreground">On {format(expiresAt, 'MMM d, yyyy')}</span>
						)}
					</Field>
				</div>

				<div className="grid gap-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<Label className="text-sm">Permissions</Label>
							<p className="text-xs text-muted-foreground">
								{count} of {allPerms} selected
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-1">
							{PRESETS.map(p => (
								<Button
									key={p.id}
									type="button"
									size="sm"
									tone={preset === p.id ? 'primary' : 'secondary'}
									disabled={!routes}
									onClick={() => {
										setSelection(applyScopes(routes!, p.groups))
										setPreset(p.id)
									}}
								>
									{p.label}
								</Button>
							))}
							<Button
								type="button"
								size="sm"
								className="text-muted-foreground"
								disabled={!count}
								onClick={() => toggleAll(false)}
							>
								Clear
							</Button>
						</div>
					</div>
					{triedSubmit && count === 0 && <FieldError>Select at least one permission.</FieldError>}
					{!routes ? (
						<div className="grid gap-2 sm:grid-cols-2">
							{Array.from({length: 6}, (_, i) => (
								<Skeleton key={i} className="h-20 rounded-lg" />
							))}
						</div>
					) : (
						<>
							<div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
								<Checkbox label="Select all" checked={count === allPerms} onCheckedChange={toggleAll} />
								<span className="text-xs text-muted-foreground">every scope the API offers</span>
							</div>
							<div className="grid items-start gap-2 sm:grid-cols-2">
								{Object.entries(routes).map(([g, perms]) => {
									const picked = sel[g]?.size ?? 0
									return (
										<fieldset
											key={g}
											className={cn('rounded-lg border p-3 transition-colors', picked > 0 && 'border-primary/30 bg-muted/40')}
										>
											<div className="mb-2 flex items-center gap-2 text-sm">
												<span className="flex-1">
													<Checkbox
														label={humanGroup(g)}
														checked={picked === perms.length}
														onCheckedChange={v => toggleGroup(g, v)}
													/>
												</span>
												<span className="text-xs text-muted-foreground tabular-nums">
													{picked}/{perms.length}
												</span>
											</div>
											<div className="flex flex-wrap gap-1.5">
												{perms.map(p => {
													const on = !!sel[g]?.has(p)
													return (
														<button
															key={p}
															type="button"
															role="checkbox"
															aria-checked={on}
															onClick={() => toggle(g, p, !on)}
															className={cn(
																'rounded-md border px-2 py-0.5 text-xs transition-colors',
																on
																	? 'border-primary bg-primary text-primary-foreground'
																	: 'text-muted-foreground hover:bg-muted hover:text-foreground',
															)}
														>
															{human(p)}
														</button>
													)
												})}
											</div>
										</fieldset>
									)
								})}
							</div>
						</>
					)}
				</div>
			</div>
			<DialogActions>
				<Button type="button" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" tone="primary" disabled={create.isPending}>
					Create token
				</Button>
			</DialogActions>
		</form>
	)
}

function CreatedToken({token, onDone}: {token: ApiToken; onDone: () => void}) {
	const apiBase = new URL(API_BASE, location.origin).href
	const curl = `curl -H "Authorization: Bearer ${token.token}" ${apiBase}/tasks`
	return (
		<>
			<DialogTitle>Token created</DialogTitle>
			<DialogDescription>
				Copy <span className="font-medium text-foreground">{token.title}</span> now. You won't be able to see it again.
			</DialogDescription>
			<div className="grid gap-4">
				<SecretBox value={token.token ?? ''} />
				<div className="grid gap-2">
					<div className="flex items-center justify-between">
						<span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
							<TerminalIcon className="size-3.5" />
							Try it
						</span>
						<CopyButton value={curl} label="Copy command" />
					</div>
					<pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
						{curl}
					</pre>
				</div>
			</div>
			<DialogActions>
				<Button tone="primary" onClick={onDone}>
					Done
				</Button>
			</DialogActions>
		</>
	)
}
