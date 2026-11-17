import {Outlet} from 'react-router'
import {SearchIcon} from 'lucide-react'
import {AppSidebar} from '@/components/app-sidebar'
import {CommandPalette, useCommandPalette} from '@/components/command-palette'
import {NotificationsButton} from '@/components/notifications-button'
import {Button} from '@/components/ui/button'
import {Kbd} from '@/components/ui/kbd'
import {Separator} from '@/components/ui/separator'
import {SidebarInset, SidebarProvider, SidebarTrigger} from '@/components/ui/sidebar'

export function AppLayout() {
	const palette = useCommandPalette()
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="min-w-0">
				<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-1 self-center data-[orientation=vertical]:h-4" />
					<Button
						variant="outline"
						size="sm"
						className="min-w-0 max-w-sm flex-1 justify-start gap-2 font-normal text-muted-foreground"
						onClick={() => palette.setOpen(true)}
					>
						<SearchIcon />
						<span className="truncate">Search tasks & projects…</span>
						<Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
					</Button>
					<div className="ml-auto flex items-center gap-1">
						<NotificationsButton />
					</div>
				</header>
				<div className="flex min-h-0 flex-1 flex-col">
					<Outlet />
				</div>
			</SidebarInset>
			<CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
		</SidebarProvider>
	)
}
