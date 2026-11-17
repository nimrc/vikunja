import {useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {useNavigate} from 'react-router'
import {toast} from 'sonner'
import {filtersCreate} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Spinner} from '@/components/ui/spinner'
import {FilterFields} from '@/pages/project/project-settings'
import {invalidateProjects} from '@/lib/queries'

export default function FilterNew() {
	const navigate = useNavigate()
	const [value, setValue] = useState({title: '', description: '', filter: 'done = false', includeNulls: false})
	const create = useMutation({
		mutationFn: async () =>
			(
				await filtersCreate({
					body: {
						title: value.title.trim(),
						description: value.description,
						filters: {filter: value.filter, filter_include_nulls: value.includeNulls},
					},
				})
			).data,
		onSuccess: async f => {
			await invalidateProjects()
			toast.success('Filter created')
			// Saved filters surface as pseudo projects with id -(filterId + 1).
			navigate(`/projects/${-(f.id ?? 0) - 1}`)
		},
	})
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
			<h1 className="text-2xl font-semibold tracking-tight">New saved filter</h1>
			<Card
				title="Filter"
				description="Shows matching tasks from all your projects in the sidebar."
				footer={
					<div className="flex justify-end">
						<Button tone="primary" onClick={() => create.mutate()} disabled={!value.title.trim() || create.isPending}>
							{create.isPending && <Spinner />}
							Create filter
						</Button>
					</div>
				}
			>
				<FilterFields value={value} onChange={setValue} />
			</Card>
		</div>
	)
}
