import {useState} from 'react'
import {CheckIcon, PlusIcon} from 'lucide-react'
import {toast} from 'sonner'
import {labelsCreate, taskLabelsCreate, taskLabelsDelete, type Label, type Task} from '@/client/generated'
import {ColorDot} from '@/components/color-picker'
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {LabelBadge} from '@/components/task/task-bits'
import {errorMessage} from '@/lib/api'
import {invalidateTasks, keys, queryClient, useLabels} from '@/lib/queries'
import {Placeholder, valueButton} from './shared'

const SWATCHES = ['ef4444', 'f97316', 'f59e0b', '22c55e', '14b8a6', '3b82f6', '6366f1', '8b5cf6', 'ec4899']

/** Optimistically swaps a field on the cached task detail. */
export function patchDetail(taskId: number, changes: Partial<Task>) {
	queryClient.setQueryData<Task>(keys.task(taskId), old => (old ? {...old, ...changes} : old))
}

export function LabelsValue({task, disabled}: {task: Task; disabled?: boolean}) {
	const {labels: all} = useLabels()
	const [search, setSearch] = useState('')
	const current = task.labels ?? []
	const has = (id?: number) => current.some(l => l.id === id)
	const taskId = task.id!

	const toggle = async (label: Label) => {
		const on = has(label.id)
		patchDetail(taskId, {labels: on ? current.filter(l => l.id !== label.id) : [...current, label]} as Partial<Task>)
		try {
			if (on) await taskLabelsDelete({path: {task: taskId, label: label.id!}})
			else await taskLabelsCreate({path: {task: taskId}, body: {label_id: label.id}})
		} catch (e) {
			toast.error(errorMessage(e))
		} finally {
			void invalidateTasks()
		}
	}

	const create = async () => {
		const title = search.trim()
		if (!title) return
		try {
			const {data: label} = await labelsCreate({
				body: {title, hex_color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)]},
			})
			setSearch('')
			void queryClient.invalidateQueries({queryKey: keys.labels})
			await toggle(label)
		} catch (e) {
			toast.error(errorMessage(e))
		}
	}

	const exact = all.some(l => l.title?.toLowerCase() === search.trim().toLowerCase())

	return (
		<Popover onOpenChange={o => !o && setSearch('')}>
			<PopoverTrigger disabled={disabled} render={<button type="button" className={valueButton} />}>
				{current.length ? (
					<span className="flex flex-wrap gap-1">
						{current.map(l => (
							<LabelBadge key={l.id} label={l} />
						))}
					</span>
				) : (
					<Placeholder>Add labels</Placeholder>
				)}
			</PopoverTrigger>
			<PopoverContent className="w-64 p-0" align="end">
				<Command>
					<CommandInput placeholder="Search or create…" value={search} onValueChange={setSearch} />
					<CommandList>
						<CommandEmpty className="py-3 text-center text-xs text-muted-foreground">No labels.</CommandEmpty>
						<CommandGroup>
							{all.map(l => (
								<CommandItem key={l.id} value={`${l.title} ${l.id}`} onSelect={() => void toggle(l)}>
									<ColorDot color={l.hex_color} />
									<span className="truncate">{l.title}</span>
									{has(l.id) && <CheckIcon className="ml-auto" />}
								</CommandItem>
							))}
						</CommandGroup>
						{search.trim() && !exact && (
							<CommandGroup forceMount>
								<CommandItem forceMount value={`__create ${search}`} onSelect={() => void create()}>
									<PlusIcon />
									<span className="truncate">
										Create “<span className="font-medium">{search.trim()}</span>”
									</span>
								</CommandItem>
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
