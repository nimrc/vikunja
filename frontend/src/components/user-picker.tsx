import {useEffect, useState, type ReactNode} from 'react'
import {useQuery} from '@tanstack/react-query'
import {UserPlusIcon} from 'lucide-react'
import {usersSearch, type User} from '@/client/generated'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Button} from '@/components/ui/button'
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Spinner} from '@/components/ui/spinner'
import {useAvatarSrc} from '@/lib/avatar'
import {displayName, initials} from '@/lib/format'
import {cn} from '@/lib/utils'

/** Avatar without the hover tooltip, for rows that already print the name. */
export function UserAvatarPlain({user, size = 32, className}: {user?: User | null; size?: number; className?: string}) {
	const src = useAvatarSrc(user, size * 2)
	return (
		<Avatar className={cn('shrink-0', className)} style={{width: size, height: size}}>
			<AvatarImage src={src} alt="" />
			<AvatarFallback className="text-[10px]">{initials(user)}</AvatarFallback>
		</Avatar>
	)
}

export function UserLine({user, extra}: {user?: User | null; extra?: ReactNode}) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<UserAvatarPlain user={user} />
			<div className="grid min-w-0 text-sm leading-tight">
				<span className="truncate font-medium">
					{displayName(user)}
					{extra}
				</span>
				<span className="truncate text-xs text-muted-foreground">@{user?.username}</span>
			</div>
		</div>
	)
}

function useDebounced<T>(value: T, ms: number) {
	const [v, setV] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setV(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return v
}

/** Searches users the backend lets us discover (exact username, or opted-in name/email). */
export function UserPicker({
	onSelect,
	excludeIds = [],
	label = 'Add user',
	disabled,
}: {
	onSelect: (user: User) => void
	excludeIds?: number[]
	label?: string
	disabled?: boolean
}) {
	const [open, setOpen] = useState(false)
	const [q, setQ] = useState('')
	const query = useDebounced(q.trim(), 250)
	const {data, isFetching} = useQuery({
		queryKey: ['users', 'search', query],
		queryFn: async ({signal}) => (await usersSearch({query: {q: query}, signal})).data.items ?? [],
		enabled: open && query.length > 0,
		staleTime: 60_000,
	})
	const results = (data ?? []).filter(u => !excludeIds.includes(u.id ?? -1))

	return (
		<Popover
			open={open}
			onOpenChange={o => {
				setOpen(o)
				if (!o) setQ('')
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="outline" disabled={disabled}>
					<UserPlusIcon />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="end">
				<Command shouldFilter={false}>
					<CommandInput placeholder="Search by username…" value={q} onValueChange={setQ} />
					<CommandList>
						{query.length === 0 ? (
							<div className="px-3 py-6 text-center text-xs text-muted-foreground">
								Type a username, or a name/email of a user who allows being found.
							</div>
						) : isFetching && !data ? (
							<div className="flex justify-center py-6">
								<Spinner />
							</div>
						) : (
							<>
								<CommandEmpty>No users found.</CommandEmpty>
								<CommandGroup>
									{results.map(u => (
										<CommandItem
											key={u.id}
											value={String(u.id)}
											onSelect={() => {
												onSelect(u)
												setOpen(false)
												setQ('')
											}}
										>
											<UserLine user={u} />
										</CommandItem>
									))}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
