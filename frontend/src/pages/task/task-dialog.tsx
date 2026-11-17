import {Link, useLocation, useNavigate, useParams} from 'react-router'
import {Maximize2Icon, XIcon} from 'lucide-react'
import type {BackgroundState} from '@/App'
import {TaskDetail} from '@/components/task/task-detail'
import {Button} from '@/components/ui/button'
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog'
import {Tooltip} from '@/components/ui/tooltip'
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
		<Dialog
			open
			onOpenChange={(open, details) => {
				if (open) return
				// Let Escape cancel an in-progress edit instead of closing the dialog.
				if (details.reason === 'escape-key' && isEditable(document.activeElement)) {
					details.cancel()
					return
				}
				close()
			}}
		>
			<DialogContent size="lg">
				<DialogTitle className="sr-only">{task?.title ?? 'Task'}</DialogTitle>
				<DialogDescription className="sr-only">Task details</DialogDescription>
				<div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
					<TaskDetail
						key={id}
						taskId={Number.isFinite(id) ? id : 0}
						onClose={close}
						actions={
							<>
								<Tooltip
									label="Open full page"
									render={
										<Button
											round
											className="text-muted-foreground"
											render={<Link to={`/tasks/${id}`} replace state={null} />}
										/>
									}
								>
									<Maximize2Icon />
								</Tooltip>
								<Tooltip
									label="Close"
									render={<Button round className="text-muted-foreground" onClick={close} />}
								>
									<XIcon />
								</Tooltip>
							</>
						}
					/>
				</div>
			</DialogContent>
		</Dialog>
	)
}
