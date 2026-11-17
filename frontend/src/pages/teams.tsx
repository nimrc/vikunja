import {useState} from 'react'
import {Link, Route, Routes, useNavigate, useParams} from 'react-router'
import {useMutation, useQuery} from '@tanstack/react-query'
import {
	ArrowLeftIcon,
	ChevronRightIcon,
	MoreHorizontalIcon,
	PlusIcon,
	ShieldCheckIcon,
	ShieldIcon,
	Trash2Icon,
	UserMinusIcon,
	UsersIcon,
} from 'lucide-react'
import {toast} from 'sonner'
import {
	teamsCreate,
	teamsDelete,
	teamsList,
	teamsMembersAdd,
	teamsMembersRemove,
	teamsMembersToggleAdmin,
	teamsRead,
	teamsUpdate,
	type Team,
} from '@/client/generated'
import {ConfirmDialog} from '@/components/confirm-dialog'
import {UserAvatarPlain, UserLine, UserPicker} from '@/components/user-picker'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {
	Dialog,
	DialogActions,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle} from '@/components/ui/empty'
import {Field, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Skeleton} from '@/components/ui/skeleton'
import {Textarea} from '@/components/ui/textarea'
import {displayName} from '@/lib/format'
import {queryClient, useCurrentUser} from '@/lib/queries'

type TeamWithPerm = Team & {max_permission?: number}

const teamKeys = {
	all: ['teams'] as const,
	list: ['teams', 'list'] as const,
	detail: (id: number) => ['teams', 'detail', id] as const,
}

function plain(html?: string) {
	if (!html) return ''
	return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
}

export default function Teams() {
	return (
		<Routes>
			<Route index element={<TeamList />} />
			<Route path=":teamId" element={<TeamDetail />} />
		</Routes>
	)
}

function TeamList() {
	const [creating, setCreating] = useState(false)
	const {data: teams, isLoading} = useQuery({
		queryKey: teamKeys.list,
		queryFn: async ({signal}) => (await teamsList({query: {per_page: 50}, signal})).data.items ?? [],
	})

	return (
		<div className="mx-auto w-full max-w-4xl p-4 md:p-6">
			<div className="mb-6 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
					<p className="text-sm text-muted-foreground">Share projects with a group of people at once.</p>
				</div>
				<Button tone="primary" onClick={() => setCreating(true)}>
					<PlusIcon />
					New team
				</Button>
			</div>

			{isLoading ? (
				<div className="grid gap-2">
					{Array.from({length: 3}, (_, i) => (
						<Skeleton key={i} className="h-16 rounded-xl" />
					))}
				</div>
			) : !teams?.length ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersIcon />
						</EmptyMedia>
						<EmptyTitle>No teams yet</EmptyTitle>
						<EmptyDescription>Create a team, add members, then share projects with the whole team.</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button tone="primary" onClick={() => setCreating(true)}>
							<PlusIcon />
							Create a team
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<div className="divide-y overflow-hidden rounded-xl border bg-card">
					{teams.map(t => {
						const members = t.members ?? []
						return (
							<Link
								key={t.id}
								to={`/teams/${t.id}`}
								className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
							>
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
									{(t.name ?? '?').slice(0, 1).toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate text-sm font-medium">{t.name}</span>
										{t.is_public && <Badge tone="neutral">Public</Badge>}
									</div>
									<p className="truncate text-xs text-muted-foreground">
										{plain(t.description) || `${members.length} member${members.length === 1 ? '' : 's'}`}
									</p>
								</div>
								<div className="hidden -space-x-2 sm:flex">
									{members.slice(0, 4).map(m => (
										<UserAvatarPlain key={m.id} user={m} size={24} className="border-2 border-background" />
									))}
								</div>
								<ChevronRightIcon className="size-4 text-muted-foreground" />
							</Link>
						)
					})}
				</div>
			)}

			<CreateTeamDialog open={creating} onOpenChange={setCreating} />
		</div>
	)
}

function CreateTeamDialog({open, onOpenChange}: {open: boolean; onOpenChange: (o: boolean) => void}) {
	const navigate = useNavigate()
	const [name, setName] = useState('')
	const [description, setDescription] = useState('')
	const create = useMutation({
		mutationFn: async () => (await teamsCreate({body: {name: name.trim(), description}})).data,
		onSuccess: t => {
			queryClient.invalidateQueries({queryKey: teamKeys.all})
			toast.success('Team created')
			onOpenChange(false)
			setName('')
			setDescription('')
			navigate(`/teams/${t.id}`)
		},
	})
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form
					className="grid gap-4"
					onSubmit={e => {
						e.preventDefault()
						if (name.trim()) create.mutate()
					}}
				>
					<DialogTitle>New team</DialogTitle>
					<DialogDescription>You become the team's first admin.</DialogDescription>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="team-name">Name</FieldLabel>
							<Input id="team-name" autoFocus value={name} onChange={e => setName(e.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor="team-desc">Description</FieldLabel>
							<Textarea
								id="team-desc"
								rows={3}
								placeholder="Optional"
								value={description}
								onChange={e => setDescription(e.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogActions>
						<Button onClick={() => onOpenChange(false)}>Cancel</Button>
						<Button type="submit" tone="primary" disabled={!name.trim() || create.isPending}>
							Create team
						</Button>
					</DialogActions>
				</form>
			</DialogContent>
		</Dialog>
	)
}

function TeamDetail() {
	const id = Number(useParams().teamId)
	const {data: team, isLoading, error} = useQuery({
		queryKey: teamKeys.detail(id),
		queryFn: async ({signal}) => (await teamsRead({path: {id}, signal})).data as TeamWithPerm,
		enabled: id > 0,
	})

	return (
		<div className="mx-auto w-full max-w-4xl p-4 md:p-6">
			<Button size="sm" className="-ml-2 mb-3 text-muted-foreground" render={<Link to="/teams" />}>
				<ArrowLeftIcon />
				Teams
			</Button>
			{isLoading ? (
				<div className="grid gap-4">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-40 rounded-xl" />
					<Skeleton className="h-64 rounded-xl" />
				</div>
			) : error || !team ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>Team not found</EmptyTitle>
						<EmptyDescription>{error?.message ?? 'It may have been deleted, or you are no longer a member.'}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<TeamDetailBody key={team.id} team={team} />
			)}
		</div>
	)
}

function TeamDetailBody({team}: {team: TeamWithPerm}) {
	const id = team.id!
	const navigate = useNavigate()
	const {data: me} = useCurrentUser()
	const isAdmin = team.max_permission === 2
	const fromExternal = !!team.external_id
	const [name, setName] = useState(team.name ?? '')
	const [description, setDescription] = useState(plain(team.description))
	const [deleting, setDeleting] = useState(false)
	const [leaving, setLeaving] = useState(false)
	const members = team.members ?? []
	const dirty = name !== (team.name ?? '') || description !== plain(team.description)

	const refresh = () => {
		queryClient.invalidateQueries({queryKey: teamKeys.all})
	}

	const update = useMutation({
		mutationFn: () => teamsUpdate({path: {id}, body: {name: name.trim(), description, is_public: team.is_public}}),
		onSuccess: () => {
			toast.success('Team saved')
			refresh()
		},
	})
	const remove = useMutation({
		mutationFn: () => teamsDelete({path: {id}}),
		onSuccess: () => {
			toast.success('Team deleted')
			queryClient.removeQueries({queryKey: teamKeys.detail(id)})
			refresh()
			navigate('/teams')
		},
	})
	const addMember = useMutation({
		mutationFn: (username: string) => teamsMembersAdd({path: {team: id}, body: {username}}),
		onSuccess: () => {
			toast.success('Member added')
			refresh()
		},
	})
	const removeMember = useMutation({
		mutationFn: (username: string) => teamsMembersRemove({path: {team: id, user: username}}),
		onSuccess: (_, username) => {
			if (username === me?.username) {
				toast.success(`You left ${team.name}`)
				queryClient.removeQueries({queryKey: teamKeys.detail(id)})
				refresh()
				navigate('/teams')
				return
			}
			toast.success('Member removed')
			refresh()
		},
	})
	const toggleAdmin = useMutation({
		mutationFn: (username: string) => teamsMembersToggleAdmin({path: {team: id, user: username}}),
		onSuccess: refresh,
	})

	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex size-11 items-center justify-center rounded-xl bg-muted text-lg font-semibold">
					{(team.name ?? '?').slice(0, 1).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="truncate text-2xl font-semibold tracking-tight">{team.name}</h1>
					<p className="text-sm text-muted-foreground">
						{members.length} member{members.length === 1 ? '' : 's'}
						{fromExternal && ' · managed by your identity provider'}
					</p>
				</div>
				{!isAdmin && !fromExternal && (
					<Button onClick={() => setLeaving(true)}>
						Leave team
					</Button>
				)}
			</div>

			{isAdmin && (
				<Card title="Details" description="Name and description are visible to everyone in the team.">
					<form
						className="grid gap-4"
						onSubmit={e => {
							e.preventDefault()
							if (name.trim() && dirty) update.mutate()
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="team-name">Name</FieldLabel>
								<Input
									id="team-name"
									value={name}
									disabled={fromExternal}
									onChange={e => setName(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="team-desc">Description</FieldLabel>
								<Textarea
									id="team-desc"
									rows={3}
									value={description}
									onChange={e => setDescription(e.target.value)}
								/>
							</Field>
						</FieldGroup>
						<div className="flex justify-end">
							<Button type="submit" tone="primary" disabled={!dirty || !name.trim() || update.isPending}>
								Save
							</Button>
						</div>
					</form>
				</Card>
			)}

			<Card
				title="Members"
				description="Admins can add and remove members and manage the team."
				action={
					isAdmin && !fromExternal ? (
						<UserPicker
							label="Add member"
							excludeIds={members.map(m => m.id ?? -1)}
							disabled={addMember.isPending}
							onSelect={u => u.username && addMember.mutate(u.username)}
						/>
					) : undefined
				}
			>
				<ul className="divide-y border-t">
					{members.map(m => {
						const self = m.id === me?.id
						return (
							<li key={m.id} className="flex items-center gap-3 py-3">
								<div className="min-w-0 flex-1">
									<UserLine
										user={m}
										extra={self && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
									/>
								</div>
								{m.admin ? (
									<Badge tone="neutral" className="gap-1">
										<ShieldCheckIcon className="size-3" />
										Admin
									</Badge>
								) : (
									<Badge tone="neutral" className="text-muted-foreground">
										Member
									</Badge>
								)}
								{isAdmin && !fromExternal && !self && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button round aria-label={`Manage ${displayName(m)}`}>
												<MoreHorizontalIcon />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => m.username && toggleAdmin.mutate(m.username)}>
												{m.admin ? <ShieldIcon /> : <ShieldCheckIcon />}
												{m.admin ? 'Remove admin' : 'Make admin'}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => m.username && removeMember.mutate(m.username)}
											>
												<UserMinusIcon />
												Remove from team
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</li>
						)
					})}
				</ul>
			</Card>

			{isAdmin && (
				<Card
					className="border-destructive/40"
					title="Delete team"
					description="Projects shared with this team lose that access. This cannot be undone."
					action={
						<Button tone="danger" onClick={() => setDeleting(true)}>
							<Trash2Icon />
							Delete team
						</Button>
					}
				/>
			)}

			<ConfirmDialog
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete ${team.name}?`}
				description="All members lose access to projects shared with this team."
				onConfirm={() => remove.mutateAsync()}
			/>
			<ConfirmDialog
				open={leaving}
				onOpenChange={setLeaving}
				title={`Leave ${team.name}?`}
				description="You lose access to projects shared with this team."
				confirmLabel="Leave"
				onConfirm={() => me?.username && removeMember.mutateAsync(me.username)}
			/>
		</div>
	)
}
