import {useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'
import {CheckIcon, CopyIcon, LinkIcon, LockIcon, PlusIcon, Trash2Icon, UsersIcon, XIcon} from 'lucide-react'
import {toast} from 'sonner'
import {
	projectTeamsCreate,
	projectTeamsDelete,
	projectTeamsList,
	projectTeamsUpdate,
	projectUsersCreate,
	projectUsersDelete,
	projectUsersList,
	projectUsersUpdate,
	sharesCreate,
	sharesDelete,
	sharesList,
	teamsList,
	type LinkSharing,
} from '@/client/generated'
import {ConfirmDialog} from '@/components/confirm-dialog'
import {UserLine, UserPicker} from '@/components/user-picker'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command'
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '@/components/ui/dialog'
import {Field, FieldDescription, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Skeleton} from '@/components/ui/skeleton'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {displayName, parseDate, relative} from '@/lib/format'
import {useServerInfo} from '@/lib/info'
import {queryClient, useCurrentUser} from '@/lib/queries'

const PERMISSIONS = [
	{value: 0, label: 'Read only', hint: 'Can see everything, change nothing'},
	{value: 1, label: 'Read & write', hint: 'Can create and edit tasks'},
	{value: 2, label: 'Admin', hint: 'Can also manage sharing and settings'},
] as const

const shareKeys = {
	users: (p: number) => ['project-sharing', p, 'users'] as const,
	teams: (p: number) => ['project-sharing', p, 'teams'] as const,
	links: (p: number) => ['project-sharing', p, 'links'] as const,
}

function PermissionSelect({
	value,
	onChange,
	disabled,
	className,
}: {
	value: number
	onChange: (v: number) => void
	disabled?: boolean
	className?: string
}) {
	return (
		<Select value={String(value)} onValueChange={v => onChange(Number(v))} disabled={disabled}>
			<SelectTrigger size="sm" className={className ?? 'w-36'} aria-label="Permission">
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="end">
				{PERMISSIONS.map(p => (
					<SelectItem key={p.value} value={String(p.value)}>
						{p.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

function useCopy() {
	const [copied, setCopied] = useState<string | null>(null)
	return {
		copied,
		copy: async (text: string, id = text) => {
			try {
				await navigator.clipboard.writeText(text)
				setCopied(id)
				setTimeout(() => setCopied(c => (c === id ? null : c)), 1500)
			} catch {
				toast.error('Could not copy to the clipboard')
			}
		},
	}
}

export function ProjectSharing({projectId}: {projectId: number}) {
	const {data: info} = useServerInfo()
	return (
		<div className="grid gap-6">
			<UserShares projectId={projectId} />
			<TeamShares projectId={projectId} />
			{info?.link_sharing_enabled !== false && <LinkShares projectId={projectId} />}
		</div>
	)
}

function ListSkeleton() {
	return (
		<div className="grid gap-3 px-4">
			<Skeleton className="h-10" />
			<Skeleton className="h-10" />
		</div>
	)
}

function UserShares({projectId}: {projectId: number}) {
	const {data: me} = useCurrentUser()
	const key = shareKeys.users(projectId)
	const {data: users, isLoading} = useQuery({
		queryKey: key,
		queryFn: async ({signal}) =>
			(await projectUsersList({path: {project: projectId}, query: {per_page: 50}, signal})).data.items ?? [],
	})
	const refresh = () => queryClient.invalidateQueries({queryKey: key})
	const add = useMutation({
		mutationFn: (username: string) => projectUsersCreate({path: {project: projectId}, body: {username, permission: 0}}),
		onSuccess: () => {
			toast.success('Shared')
			refresh()
		},
	})
	const update = useMutation({
		mutationFn: ({username, permission}: {username: string; permission: number}) =>
			projectUsersUpdate({path: {project: projectId, user: username}, body: {permission}}),
		onSuccess: refresh,
	})
	const remove = useMutation({
		mutationFn: (username: string) => projectUsersDelete({path: {project: projectId, user: username}}),
		onSuccess: refresh,
	})

	return (
		<Card>
			<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
				<div className="grid gap-1.5">
					<CardTitle>People</CardTitle>
					<CardDescription>Share with individual users.</CardDescription>
				</div>
				<UserPicker
					label="Share with user"
					excludeIds={[me?.id ?? -1, ...(users ?? []).map(u => u.id ?? -1)]}
					disabled={add.isPending}
					onSelect={u => u.username && add.mutate(u.username)}
				/>
			</CardHeader>
			<CardContent className="px-0">
				{isLoading ? (
					<ListSkeleton />
				) : !users?.length ? (
					<p className="px-4 text-sm text-muted-foreground">Not shared with anyone yet.</p>
				) : (
					<ul className="-mb-4 divide-y border-t">
						{users.map(u => (
							<li key={u.id} className="flex items-center gap-2 px-4 py-3">
								<div className="min-w-0 flex-1">
									<UserLine user={u} />
								</div>
								<PermissionSelect
									value={u.permission ?? 0}
									onChange={permission => u.username && update.mutate({username: u.username, permission})}
								/>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Remove ${displayName(u)}`}
											onClick={() => u.username && remove.mutate(u.username)}
										>
											<XIcon />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Remove access</TooltipContent>
								</Tooltip>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}

function TeamShares({projectId}: {projectId: number}) {
	const key = shareKeys.teams(projectId)
	const [open, setOpen] = useState(false)
	const {data: info} = useServerInfo()
	const {data: teams, isLoading} = useQuery({
		queryKey: key,
		queryFn: async ({signal}) =>
			(await projectTeamsList({path: {project: projectId}, query: {per_page: 50}, signal})).data.items ?? [],
	})
	const {data: myTeams} = useQuery({
		queryKey: ['teams', 'list', 'with-public', !!info?.public_teams_enabled],
		queryFn: async ({signal}) =>
			(await teamsList({query: {per_page: 50, include_public: !!info?.public_teams_enabled}, signal})).data.items ?? [],
		enabled: open,
	})
	const shared = new Set((teams ?? []).map(t => t.id))
	const candidates = (myTeams ?? []).filter(t => !shared.has(t.id))
	const refresh = () => queryClient.invalidateQueries({queryKey: key})
	const add = useMutation({
		mutationFn: (teamId: number) => projectTeamsCreate({path: {project: projectId}, body: {team_id: teamId, permission: 0}}),
		onSuccess: () => {
			toast.success('Shared with team')
			refresh()
		},
	})
	const update = useMutation({
		mutationFn: ({team, permission}: {team: number; permission: number}) =>
			projectTeamsUpdate({path: {project: projectId, team}, body: {team_id: team, permission}}),
		onSuccess: refresh,
	})
	const remove = useMutation({
		mutationFn: (team: number) => projectTeamsDelete({path: {project: projectId, team}}),
		onSuccess: refresh,
	})

	return (
		<Card>
			<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
				<div className="grid gap-1.5">
					<CardTitle>Teams</CardTitle>
					<CardDescription>Everyone in the team gets the same access.</CardDescription>
				</div>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button variant="outline" disabled={add.isPending}>
							<UsersIcon />
							Share with team
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-64 p-0" align="end">
						<Command>
							<CommandInput placeholder="Search teams…" />
							<CommandList>
								<CommandEmpty>{myTeams ? 'No teams left to add.' : 'Loading…'}</CommandEmpty>
								<CommandGroup>
									{candidates.map(t => (
										<CommandItem
											key={t.id}
											value={`${t.name} ${t.id}`}
											onSelect={() => {
												add.mutate(t.id!)
												setOpen(false)
											}}
										>
											<span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
												{(t.name ?? '?').slice(0, 1).toUpperCase()}
											</span>
											<span className="truncate">{t.name}</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</CardHeader>
			<CardContent className="px-0">
				{isLoading ? (
					<ListSkeleton />
				) : !teams?.length ? (
					<p className="px-4 text-sm text-muted-foreground">Not shared with any team.</p>
				) : (
					<ul className="-mb-4 divide-y border-t">
						{teams.map(t => (
							<li key={t.id} className="flex items-center gap-2 px-4 py-3">
								<div className="flex min-w-0 flex-1 items-center gap-3">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
										{(t.name ?? '?').slice(0, 1).toUpperCase()}
									</span>
									<div className="grid min-w-0 text-sm leading-tight">
										<span className="truncate font-medium">{t.name}</span>
										<span className="truncate text-xs text-muted-foreground">
											{(t.members?.length ?? 0) || 'Team'}
											{t.members?.length ? ` member${t.members.length === 1 ? '' : 's'}` : ''}
										</span>
									</div>
								</div>
								<PermissionSelect
									value={t.permission ?? 0}
									onChange={permission => update.mutate({team: t.id!, permission})}
								/>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={`Remove ${t.name}`}
											onClick={() => remove.mutate(t.id!)}
										>
											<XIcon />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Remove access</TooltipContent>
								</Tooltip>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}

function shareUrl(hash?: string) {
	return `${location.origin}/share/${hash}/auth`
}

function LinkShares({projectId}: {projectId: number}) {
	const key = shareKeys.links(projectId)
	const [creating, setCreating] = useState(false)
	const [deleting, setDeleting] = useState<LinkSharing | null>(null)
	const {copied, copy} = useCopy()
	const {data: links, isLoading} = useQuery({
		queryKey: key,
		queryFn: async ({signal}) =>
			(await sharesList({path: {project: projectId}, query: {per_page: 50}, signal})).data.items ?? [],
	})
	const remove = useMutation({
		mutationFn: (share: number) => sharesDelete({path: {project: projectId, share}}),
		onSuccess: () => {
			toast.success('Link deleted')
			queryClient.invalidateQueries({queryKey: key})
		},
	})

	return (
		<Card>
			<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
				<div className="grid gap-1.5">
					<CardTitle>Share links</CardTitle>
					<CardDescription>Anyone with the link can open the project without an account.</CardDescription>
				</div>
				<Button variant="outline" onClick={() => setCreating(true)}>
					<LinkIcon />
					Create link
				</Button>
			</CardHeader>
			<CardContent className="px-0">
				{isLoading ? (
					<ListSkeleton />
				) : !links?.length ? (
					<p className="px-4 text-sm text-muted-foreground">No share links.</p>
				) : (
					<ul className="-mb-4 divide-y border-t">
						{links.map(l => {
							const url = shareUrl(l.hash)
							const created = parseDate(l.created)
							return (
								<li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
									<div className="flex min-w-0 flex-1 items-center gap-3">
										<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
											{l.sharing_type === 2 ? <LockIcon className="size-4" /> : <LinkIcon className="size-4" />}
										</span>
										<div className="grid min-w-0 text-sm leading-tight">
											<span className="flex items-center gap-2 truncate font-medium">
												{l.name || 'Unnamed link'}
												<Badge variant="secondary" className="font-normal">
													{PERMISSIONS[l.permission ?? 0]?.label}
												</Badge>
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{l.sharing_type === 2 ? 'Password protected · ' : ''}
												by {displayName(l.shared_by)}
												{created && ` · ${relative(created)}`}
											</span>
										</div>
									</div>
									<div className="flex items-center gap-1">
										<Input readOnly value={url} className="hidden h-7 w-56 font-mono text-xs md:block md:text-xs" onFocus={e => e.target.select()} />
										<Button variant="outline" size="sm" onClick={() => copy(url, String(l.id))}>
											{copied === String(l.id) ? <CheckIcon /> : <CopyIcon />}
											{copied === String(l.id) ? 'Copied' : 'Copy link'}
										</Button>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="icon-sm" aria-label="Delete link" onClick={() => setDeleting(l)}>
													<Trash2Icon />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Delete link</TooltipContent>
										</Tooltip>
									</div>
								</li>
							)
						})}
					</ul>
				)}
			</CardContent>
			<CreateLinkDialog projectId={projectId} open={creating} onOpenChange={setCreating} onCopy={copy} />
			<ConfirmDialog
				open={!!deleting}
				onOpenChange={o => !o && setDeleting(null)}
				title="Delete this share link?"
				description="Anyone using it loses access immediately."
				onConfirm={() => deleting?.id && remove.mutateAsync(deleting.id)}
			/>
		</Card>
	)
}

function CreateLinkDialog({
	projectId,
	open,
	onOpenChange,
	onCopy,
}: {
	projectId: number
	open: boolean
	onOpenChange: (o: boolean) => void
	onCopy: (text: string) => void
}) {
	const [permission, setPermission] = useState(0)
	const [name, setName] = useState('')
	const [password, setPassword] = useState('')
	const create = useMutation({
		mutationFn: async () =>
			(await sharesCreate({path: {project: projectId}, body: {permission, name: name.trim(), password}})).data,
		onSuccess: share => {
			queryClient.invalidateQueries({queryKey: shareKeys.links(projectId)})
			onCopy(shareUrl(share.hash))
			toast.success('Link created and copied')
			onOpenChange(false)
			setPermission(0)
			setName('')
			setPassword('')
		},
	})
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form
					className="grid gap-4"
					onSubmit={e => {
						e.preventDefault()
						create.mutate()
					}}
				>
					<DialogHeader>
						<DialogTitle>Create share link</DialogTitle>
						<DialogDescription>Actions taken through the link show up under its name.</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel>Permission</FieldLabel>
							<PermissionSelect value={permission} onChange={setPermission} className="w-full" />
							<FieldDescription>{PERMISSIONS[permission].hint}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="share-name">Name</FieldLabel>
							<Input id="share-name" placeholder="Optional, e.g. “Client review”" value={name} onChange={e => setName(e.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor="share-password">Password</FieldLabel>
							<Input
								id="share-password"
								type="password"
								autoComplete="new-password"
								placeholder="Optional"
								value={password}
								onChange={e => setPassword(e.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={create.isPending}>
							<PlusIcon />
							Create link
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
