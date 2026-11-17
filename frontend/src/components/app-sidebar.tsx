import {useMemo, useState} from 'react'
import {Link, useLocation, useNavigate} from 'react-router'
import {useTheme} from '@/lib/theme'
import {
	CalendarClockIcon,
	ChevronRightIcon,
	ChevronsUpDownIcon,
	FilterIcon,
	FolderKanbanIcon,
	HomeIcon,
	LogOutIcon,
	MonitorIcon,
	MoonIcon,
	PlusIcon,
	SettingsIcon,
	StarIcon,
	SunIcon,
	TagIcon,
	UsersIcon,
} from 'lucide-react'
import {Avatar} from '@/components/ui/avatar'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarRail,
	useSidebar,
} from '@/components/ui/sidebar'
import {ColorDot} from '@/components/color-picker'
import {ProjectCreateDialog} from '@/components/project-create-dialog'
import {useAuth} from '@/lib/auth'
import {defaultViewId, displayName, isSavedFilter, projectTree, type ProjectNode} from '@/lib/format'
import {useAvatarSrc} from '@/lib/avatar'
import {useCurrentUser, useProjects} from '@/lib/queries'
import {cn} from '@/lib/utils'

export function projectHref(p: {id?: number; views?: {id?: number; position?: number}[] | null}) {
	const view = defaultViewId(p)
	return view ? `/projects/${p.id}/${view}` : `/projects/${p.id}`
}

function useActiveProjectId() {
	const {pathname} = useLocation()
	const m = pathname.match(/^\/projects\/(-?\d+)/)
	return m ? Number(m[1]) : null
}

function ProjectItem({node, activeId}: {node: ProjectNode; activeId: number | null}) {
	const contains = (n: ProjectNode): boolean => n.id === activeId || n.children.some(contains)
	const [open, setOpen] = useState(() => node.children.some(contains))
	const {setOpenMobile} = useSidebar()

	const button = (
		<SidebarMenuButton asChild isActive={node.id === activeId} tooltip={node.title}>
			<Link to={projectHref(node)} onClick={() => setOpenMobile(false)}>
				<ColorDot color={node.hex_color} className="ml-0.5" />
				<span>{node.title}</span>
			</Link>
		</SidebarMenuButton>
	)

	if (!node.children.length) return <SidebarMenuItem>{button}</SidebarMenuItem>

	return (
		<SidebarMenuItem>
			{button}
			<SidebarMenuAction
				aria-expanded={open}
				onClick={() => setOpen(o => !o)}
				className={cn('transition-transform', open && 'rotate-90')}
			>
				<ChevronRightIcon />
				<span className="sr-only">Toggle</span>
			</SidebarMenuAction>
			{open && (
				<SidebarMenuSub className="mr-0 pr-0">
					{node.children.map(c => (
						<ProjectItem key={c.id} node={c} activeId={activeId} />
					))}
				</SidebarMenuSub>
			)}
		</SidebarMenuItem>
	)
}

const NAV = [
	{to: '/', label: 'Overview', icon: HomeIcon},
	{to: '/tasks/upcoming', label: 'Upcoming', icon: CalendarClockIcon},
	{to: '/projects', label: 'Projects', icon: FolderKanbanIcon},
	{to: '/labels', label: 'Labels', icon: TagIcon},
	{to: '/teams', label: 'Teams', icon: UsersIcon},
]

export function AppSidebar() {
	const {pathname} = useLocation()
	const {projects, isPending} = useProjects()
	const activeId = useActiveProjectId()
	const {setOpenMobile} = useSidebar()

	const {tree, favorites, filters} = useMemo(() => {
		const real = projects.filter(p => (p.id ?? 0) > 0)
		return {
			tree: projectTree(real),
			favorites: real.filter(p => p.is_favorite && !p.is_archived),
			filters: projects.filter(isSavedFilter),
		}
	}, [projects])

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
									<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
										<path d="M4 12.5 9 17.5 20 6.5" />
									</svg>
								</div>
								<div className="grid flex-1 text-left leading-tight">
									<span className="truncate font-semibold">Vikunja</span>
									<span className="truncate text-xs text-muted-foreground">Tasks & projects</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV.map(item => (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton
										asChild
										tooltip={item.label}
										isActive={item.to === '/' || item.to === '/projects' ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')}
									>
										<Link to={item.to} onClick={() => setOpenMobile(false)}>
											<item.icon />
											<span>{item.label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{favorites.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel>Favorites</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{favorites.map(p => (
									<SidebarMenuItem key={p.id}>
										<SidebarMenuButton asChild isActive={p.id === activeId} tooltip={p.title}>
											<Link to={projectHref(p)} onClick={() => setOpenMobile(false)}>
												<StarIcon className="fill-amber-400 text-amber-400" />
												<span>{p.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				{filters.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel>Saved filters</SidebarGroupLabel>
						<SidebarGroupAction asChild title="New saved filter">
							<Link to="/filters/new">
								<PlusIcon />
								<span className="sr-only">New saved filter</span>
							</Link>
						</SidebarGroupAction>
						<SidebarGroupContent>
							<SidebarMenu>
								{filters.map(p => (
									<SidebarMenuItem key={p.id}>
										<SidebarMenuButton asChild isActive={p.id === activeId} tooltip={p.title}>
											<Link to={projectHref(p)} onClick={() => setOpenMobile(false)}>
												<FilterIcon />
												<span>{p.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				<SidebarGroup>
					<SidebarGroupLabel>Projects</SidebarGroupLabel>
					<ProjectCreateDialog>
						<SidebarGroupAction title="New project">
							<PlusIcon />
							<span className="sr-only">New project</span>
						</SidebarGroupAction>
					</ProjectCreateDialog>
					<SidebarGroupContent>
						<SidebarMenu>
							{isPending
								? Array.from({length: 4}, (_, i) => (
										<SidebarMenuItem key={i}>
											<SidebarMenuSkeleton showIcon />
										</SidebarMenuItem>
									))
								: tree.map(n => <ProjectItem key={n.id} node={n} activeId={activeId} />)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<UserMenu />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	)
}

function UserMenu() {
	const {data: user} = useCurrentUser()
	const {logout} = useAuth()
	const {theme, setTheme} = useTheme()
	const {isMobile} = useSidebar()
	const navigate = useNavigate()
	const avatarSrc = useAvatarSrc(user)

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
							<Avatar name={displayName(user)} src={avatarSrc} />
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{displayName(user)}</span>
								<span className="truncate text-xs text-muted-foreground">{user?.email || `@${user?.username ?? ''}`}</span>
							</div>
							<ChevronsUpDownIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
						side={isMobile ? 'bottom' : 'right'}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="font-normal">
							<div className="grid text-sm leading-tight">
								<span className="truncate font-medium">{displayName(user)}</span>
								<span className="truncate text-xs text-muted-foreground">@{user?.username}</span>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem onSelect={() => navigate('/settings')}>
								<SettingsIcon />
								Settings
							</DropdownMenuItem>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<SunIcon />
									Theme
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									<DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
										<DropdownMenuRadioItem value="light">
											<SunIcon /> Light
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="dark">
											<MoonIcon /> Dark
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="system">
											<MonitorIcon /> System
										</DropdownMenuRadioItem>
									</DropdownMenuRadioGroup>
								</DropdownMenuSubContent>
							</DropdownMenuSub>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => logout()}>
							<LogOutIcon />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
