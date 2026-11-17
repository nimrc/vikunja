import {Link, useLocation, useNavigate, useParams} from 'react-router'
import {Maximize2Icon, XIcon} from 'lucide-react'
import type {BackgroundState} from '@/App'
import {TaskDetail} from '@/components/task/task-detail'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {useTask} from '@/lib/queries'

function isEditable(el: Element | null) {
	return !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable)
}

export default function TaskDialog() {
	const {taskId} = useParams()
	const id = Number(taskId)
	const location = useLocation()
	const navigate = useNavigate()
	const background = (location.state as BackgroundState | null)?.background
	const {data: task} = useTask(id)

	const close = () => {
		if (background) navigate(background, {replace: true, state: background.state})
		else navigate('/', {replace: true})
	}

	return (
		<Dialog open onOpenChange={open => !open && close()}>
			<DialogContent
				showCloseButton={false}
				aria-describedby={undefined}
				className="flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[min(92vh,60rem)] sm:max-w-[calc(100%-4rem)] sm:rounded-xl lg:max-w-5xl"
				// Let Escape cancel an in-progress edit instead of closing the dialog.
				onEscapeKeyDown={e => {
					if (isEditable(document.activeElement)) e.preventDefault()
				}}
			>
				<DialogTitle className="sr-only">{task?.title ?? 'Task'}</DialogTitle>
				<DialogDescription className="sr-only">Task details</DialogDescription>
				<div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
					<TaskDetail
						key={id}
						taskId={Number.isFinite(id) ? id : 0}
						onClose={close}
						actions={
							<>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="icon-sm" className="text-muted-foreground" asChild>
											<Link to={`/tasks/${id}`} replace state={null} aria-label="Open full page">
												<Maximize2Icon />
											</Link>
										</Button>
									</TooltipTrigger>
									<TooltipContent>Open full page</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={close} aria-label="Close">
											<XIcon />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Close</TooltipContent>
								</Tooltip>
							</>
						}
					/>
				</div>
			</DialogContent>
		</Dialog>
	)
}
