import {lazy, Suspense, useEffect, useRef, type ReactNode} from 'react'
import {Navigate, NavLink, Route, Routes} from 'react-router'
import {
	CalendarSyncIcon,
	DownloadIcon,
	KeyRoundIcon,
	LockIcon,
	MailIcon,
	MonitorSmartphoneIcon,
	ShieldCheckIcon,
	SlidersHorizontalIcon,
	UserRoundIcon,
	UserXIcon,
	type LucideIcon,
} from 'lucide-react'
import {PageSpinner} from '@/components/page-spinner'
import {useServerInfo} from '@/lib/info'
import {useCurrentUser} from '@/lib/queries'
import {cn} from '@/lib/utils'

const General = lazy(() => import('./general'))
const Password = lazy(() => import('./password'))
const Email = lazy(() => import('./email'))
const Avatar = lazy(() => import('./avatar'))
const TwoFactor = lazy(() => import('./two-factor'))
const ApiTokens = lazy(() => import('./api-tokens'))
const Caldav = lazy(() => import('./caldav'))
const Sessions = lazy(() => import('./sessions'))
const DataExport = lazy(() => import('./data-export'))
const DeleteAccount = lazy(() => import('./delete-account'))

type Item = {path: string; label: string; icon: LucideIcon; element: ReactNode; show?: boolean}

export default function Settings() {
	const {data: user} = useCurrentUser()
	const {data: info} = useServerInfo()
	const local = user?.is_local_user !== false

	const items: Item[] = [
		{path: 'general', label: 'General', icon: SlidersHorizontalIcon, element: <General />},
		{path: 'avatar', label: 'Avatar', icon: UserRoundIcon, element: <Avatar />},
		{path: 'password', label: 'Password', icon: LockIcon, element: <Password />, show: local},
		{path: 'email', label: 'Email', icon: MailIcon, element: <Email />, show: local},
		{
			path: 'two-factor',
			label: 'Two-factor auth',
			icon: ShieldCheckIcon,
			element: <TwoFactor />,
			show: local && info?.totp_enabled !== false,
		},
		{path: 'api-tokens', label: 'API tokens', icon: KeyRoundIcon, element: <ApiTokens />},
		{path: 'caldav', label: 'CalDAV', icon: CalendarSyncIcon, element: <Caldav />, show: info?.caldav_enabled !== false},
		{path: 'sessions', label: 'Sessions', icon: MonitorSmartphoneIcon, element: <Sessions />},
		{path: 'data-export', label: 'Data export', icon: DownloadIcon, element: <DataExport />},
		{
			path: 'deletion',
			label: 'Delete account',
			icon: UserXIcon,
			element: <DeleteAccount />,
			show: info?.user_deletion_enabled !== false,
		},
	].filter(i => i.show !== false)

	return (
		<div className="mx-auto w-full max-w-6xl p-4 md:p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<p className="text-sm text-muted-foreground">Manage your account, security and integrations.</p>
			</div>
			<div className="flex flex-col gap-6 md:flex-row md:gap-10">
				<SettingsNav items={items} />
				<div className="min-w-0 flex-1 md:max-w-3xl">
					<Suspense fallback={<PageSpinner />}>
						<Routes>
							<Route index element={<Navigate to="/settings/general" replace />} />
							{items.map(i => (
								<Route key={i.path} path={i.path} element={i.element} />
							))}
							<Route path="*" element={<Navigate to="/settings/general" replace />} />
						</Routes>
					</Suspense>
				</div>
			</div>
		</div>
	)
}

function SettingsNav({items}: {items: Item[]}) {
	const ref = useRef<HTMLElement>(null)
	// On phones the nav scrolls sideways; keep the active tab visible.
	useEffect(() => {
		ref.current?.querySelector('[aria-current=page]')?.scrollIntoView({block: 'nearest', inline: 'center'})
	})
	return (
		<nav
			ref={ref}
			className="-mx-4 flex shrink-0 gap-1 overflow-x-auto border-b px-4 pb-2 [scrollbar-width:none] md:sticky md:top-20 md:mx-0 md:w-52 md:flex-col md:self-start md:overflow-visible md:border-0 md:px-0 md:pb-0"
		>
			{items.map(i => (
				<NavLink
					key={i.path}
					to={`/settings/${i.path}`}
					className={({isActive}) =>
						cn(
							'flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
							isActive && 'bg-muted font-medium text-foreground',
							i.path === 'deletion' && 'md:mt-4',
						)
					}
				>
					<i.icon className="size-4" />
					{i.label}
				</NavLink>
			))}
		</nav>
	)
}
