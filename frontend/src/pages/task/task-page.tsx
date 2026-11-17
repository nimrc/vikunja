import {useNavigate, useParams} from 'react-router'
import {projectHref} from '@/components/app-sidebar'
import {TaskDetail} from '@/components/task/task-detail'
import {useProjects} from '@/lib/queries'

export default function TaskPage() {
	const {taskId} = useParams()
	const navigate = useNavigate()
	const {projects} = useProjects()
	const id = Number(taskId)

	return (
		<div className="mx-auto w-full max-w-6xl p-4 md:p-6">
			<TaskDetail
				key={id}
				taskId={Number.isFinite(id) ? id : 0}
				onDeleted={task => {
					const project = projects.find(p => p.id === task.project_id)
					navigate(project ? projectHref(project) : '/', {replace: true})
				}}
			/>
		</div>
	)
}
