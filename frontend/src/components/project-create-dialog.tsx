import {cloneElement, useState, type ReactElement, type ReactNode} from 'react'
import {useMutation} from '@tanstack/react-query'
import {useNavigate} from 'react-router'
import {mergeProps} from '@ui-sdk/react/primitive'
import {toast} from 'sonner'
import {projectsCreate} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {
	Dialog,
	DialogActions,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import {Field, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {ColorPicker} from '@/components/color-picker'
import {ProjectSelect} from '@/components/project-select'
import {Spinner} from '@/components/ui/spinner'
import {defaultViewId} from '@/lib/format'
import {invalidateProjects} from '@/lib/queries'

export function ProjectCreateDialog({children, parentId}: {children: ReactNode; parentId?: number}) {
	const [open, setOpen] = useState(false)
	const [title, setTitle] = useState('')
	const [parent, setParent] = useState<number | null>(parentId ?? null)
	const [color, setColor] = useState('')
	const navigate = useNavigate()

	const create = useMutation({
		mutationFn: async () =>
			(await projectsCreate({body: {title: title.trim(), parent_project_id: parent ?? 0, hex_color: color}})).data,
		onSuccess: async project => {
			await invalidateProjects()
			toast.success(`Created “${project.title}”`)
			setOpen(false)
			setTitle('')
			setColor('')
			const view = defaultViewId(project)
			navigate(view ? `/projects/${project.id}/${view}` : `/projects/${project.id}`)
		},
	})

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{/* The child brings its own look (menu item, sidebar action, button), so drop the trigger's key styling. */}
			<DialogTrigger
				render={({'data-kit': _kit, 'data-tone': _tone, ...props}) => {
					const child = children as ReactElement<Record<string, unknown>>
					return cloneElement(child, mergeProps(props, child.props))
				}}
			/>
			<DialogContent>
				<form
					onSubmit={e => {
						e.preventDefault()
						if (title.trim()) create.mutate()
					}}
				>
					<DialogTitle>New project</DialogTitle>
					<DialogDescription>Projects hold tasks and their list, table and board views.</DialogDescription>
					<FieldGroup className="py-6">
						<Field>
							<FieldLabel htmlFor="project-title">Title</FieldLabel>
							<Input
								id="project-title"
								autoFocus
								value={title}
								onChange={e => setTitle(e.target.value)}
								placeholder="e.g. Home renovation"
							/>
						</Field>
						<Field>
							<FieldLabel>Parent project</FieldLabel>
							<ProjectSelect value={parent} onChange={setParent} allowNone noneLabel="None (top level)" />
						</Field>
						<Field>
							<FieldLabel>Color</FieldLabel>
							<ColorPicker value={color} onChange={setColor} />
						</Field>
					</FieldGroup>
					<DialogActions>
						<Button type="button" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" tone="primary" disabled={!title.trim() || create.isPending}>
							{create.isPending && <Spinner />}
							Create project
						</Button>
					</DialogActions>
				</form>
			</DialogContent>
		</Dialog>
	)
}
