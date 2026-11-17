import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {CheckIcon} from 'lucide-react'
import {toast} from 'sonner'
import {projectsUsersSearch, taskAssigneesCreate, taskAssigneesDelete, type Task, type User} from '@/client/generated'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Spinner} from '@/components/ui/spinner'
import {errorMessage} from '@/lib/api'
import {useAvatarSrc} from '@/lib/avatar'
import {displayName, initials} from '@/lib/format'
import {invalidateTasks} from '@/lib/queries'
import {cn} from '@/lib/utils'
import {patchDetail} from './labels'
import {Placeholder, useDebounced, valueButton} from './shared'

export function UserChip({user, className}: {user: User; className?: string}) {
	return (
		<Avatar className={cn('size-5', className)}>
			<AvatarImage src={useAvatarSrc(user, 40)} alt="" />
			<AvatarFallback className="text-[9px]">{initials(user)}</AvatarFallback>
		</Avatar>
	)
}


export function AssigneesValue({task, disabled}: {task: Task; disabled?: boolean}) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const q = useDebounced(search.trim())
	const current = task.assignees ?? []
	const taskId = task.id!
	const projectId = task.project_id!

	const users = useQuery({
		queryKey: ['project-users', projectId, q],
		queryFn: async ({signal}) => (await projectsUsersSearch({path: {project: projectId}, query: {q}, signal})).data.items ?? [],
		enabled: open,
		staleTime: 60_000,
	})

	const has = (id?: number) => current.some(u => u.id === id)

	const toggle = async (user: User) => {
		const on = has(user.id)
		patchDetail(taskId, {assignees: on ? current.filter(u => u.id !== user.id) : [...current, user]} as Partial<Task>)
		try {
			if (on) await taskAssigneesDelete({path: {task: taskId, user: user.id!}})
			else await taskAssigneesCreate({path: {task: taskId}, body: {user_id: user.id}})
		} catch (e) {
			toast.error(errorMessage(e))
		} finally {
			void invalidateTasks()
		}
	}

	// Current assignees first, then search hits that aren't assigned.
	const results = (users.data ?? []).filter(u => !has(u.id))
	const matches = (u: User) => !q || displayName(u).toLowerCase().includes(q.toLowerCase()) || u.username?.includes(q)

	return (
		<Popover
			open={open}
			onOpenChange={o => {
				setOpen(o)
				if (!o) setSearch('')
			}}
		>
			<PopoverTrigger asChild disabled={disabled}>
				<button type="button" className={valueButton}>
					{current.length ? (
						<span className="flex flex-col gap-1">
							{current.map(u => (
								<span key={u.id} className="flex items-center gap-2">
									<UserChip user={u} />
									<span className="truncate">{displayName(u)}</span>
								</span>
							))}
						</span>
					) : (
						<Placeholder>Assign</Placeholder>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-0" align="end">
				<Command shouldFilter={false}>
					<CommandInput placeholder="Search people…" value={search} onValueChange={setSearch} />
					<CommandList>
						{users.isFetching && !users.data ? (
							<div className="flex justify-center py-4">
								<Spinner />
							</div>
						) : (
							<CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No one found.</CommandEmpty>
						)}
						{current.filter(matches).length > 0 && (
							<CommandGroup heading="Assigned">
								{current.filter(matches).map(u => (
									<CommandItem key={u.id} value={`a${u.id}`} onSelect={() => void toggle(u)}>
										<UserChip user={u} />
										<span className="truncate">{displayName(u)}</span>
										<CheckIcon className="ml-auto" />
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{results.length > 0 && (
							<CommandGroup heading="People">
								{results.map(u => (
									<CommandItem key={u.id} value={`u${u.id}`} onSelect={() => void toggle(u)}>
										<UserChip user={u} />
										<span className="truncate">{displayName(u)}</span>
										{u.name && <span className="truncate text-xs text-muted-foreground">@{u.username}</span>}
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
