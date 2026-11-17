import {useDeferredValue, useEffect, useState} from 'react'
import {useNavigate} from 'react-router'
import {CalendarClockIcon, CheckCircle2Icon, CircleIcon, FolderKanbanIcon, HomeIcon, SettingsIcon, TagIcon, UsersIcon} from 'lucide-react'
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from '@/components/ui/command'
import {ColorDot} from '@/components/color-picker'
import {projectHref} from '@/components/app-sidebar'
import {useOpenTask} from '@/lib/navigation'
import {useAllTasks, useProjects} from '@/lib/queries'

export function useCommandPalette() {
	const [open, setOpen] = useState(false)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setOpen(o => !o)
			}
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [])
	return {open, setOpen}
}

const PAGES = [
	{to: '/', label: 'Overview', icon: HomeIcon},
	{to: '/tasks/upcoming', label: 'Upcoming', icon: CalendarClockIcon},
	{to: '/projects', label: 'Projects', icon: FolderKanbanIcon},
	{to: '/labels', label: 'Labels', icon: TagIcon},
	{to: '/teams', label: 'Teams', icon: UsersIcon},
	{to: '/settings', label: 'Settings', icon: SettingsIcon},
]

export function CommandPalette({open, onOpenChange}: {open: boolean; onOpenChange: (o: boolean) => void}) {
	const [search, setSearch] = useState('')
	const q = useDeferredValue(search.trim())
	const navigate = useNavigate()
	const openTask = useOpenTask()
	const {projects} = useProjects()
	const tasks = useAllTasks({q, per_page: 8}, open && q.length > 1)

	const go = (fn: () => void) => {
		onOpenChange(false)
		setSearch('')
		fn()
	}

	const matchingProjects = projects
		.filter(p => !p.is_archived && (p.id ?? 0) !== -1)
		.filter(p => !q || p.title?.toLowerCase().includes(q.toLowerCase()))
		.slice(0, 8)

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Search tasks, projects and pages">
			<CommandInput placeholder="Type to search…" value={search} onValueChange={setSearch} />
			<CommandList>
				<CommandEmpty>{tasks.isFetching ? 'Searching…' : 'No results.'}</CommandEmpty>
				{q.length > 1 && (tasks.data?.items?.length ?? 0) > 0 && (
					<CommandGroup heading="Tasks">
						{tasks.data?.items?.map(t => (
							<CommandItem key={t.id} value={`task-${t.id} ${t.title}`} onSelect={() => go(() => openTask(t.id!))}>
								{t.done ? <CheckCircle2Icon className="text-emerald-500" /> : <CircleIcon />}
								<span className="truncate">{t.title}</span>
								<span className="ml-auto text-xs text-muted-foreground">{t.identifier}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}
				{matchingProjects.length > 0 && (
					<CommandGroup heading="Projects">
						{matchingProjects.map(p => (
							<CommandItem key={p.id} value={`project-${p.id} ${p.title}`} onSelect={() => go(() => navigate(projectHref(p)))}>
								<ColorDot color={p.hex_color} />
								<span className="truncate">{p.title}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}
				<CommandSeparator />
				<CommandGroup heading="Go to">
					{PAGES.map(p => (
						<CommandItem key={p.to} value={`page ${p.label}`} onSelect={() => go(() => navigate(p.to))}>
							<p.icon />
							{p.label}
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	)
}
