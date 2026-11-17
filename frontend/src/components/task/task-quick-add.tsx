import {useRef, useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {CornerDownLeftIcon, PlusIcon} from 'lucide-react'
import {taskLabelsCreate, tasksCreate, type Task} from '@/client/generated'
import {Spinner} from '@/components/ui/spinner'
import {cn} from '@/lib/utils'
import {invalidateTasks, useLabels} from '@/lib/queries'

/**
 * Minimal quick-add magic: `*label` attaches an existing label, `!1`–`!5` sets priority.
 */
export function parseQuickAdd(input: string, labelTitles: string[]) {
	let title = input
	let priority: number | undefined
	const labels: string[] = []
	title = title.replace(/(^|\s)!([1-5])(?=\s|$)/, (_m, pre: string, p: string) => {
		priority = Number(p)
		return pre
	})
	const lower = new Map(labelTitles.map(t => [t.toLowerCase(), t]))
	title = title.replace(/(^|\s)\*("[^"]+"|\S+)/g, (m, pre, raw: string) => {
		const name = raw.replace(/^"|"$/g, '')
		const match = lower.get(name.toLowerCase())
		if (!match) return m
		labels.push(match)
		return pre
	})
	return {title: title.replace(/\s+/g, ' ').trim(), priority, labels}
}

export function TaskQuickAdd({
	projectId,
	extra,
	onCreated,
	placeholder = 'Add a task…',
	className,
}: {
	projectId: number
	extra?: Partial<Task>
	onCreated?: (task: Task) => void
	placeholder?: string
	className?: string
}) {
	const [value, setValue] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)
	const {labels} = useLabels()

	const create = useMutation({
		mutationFn: async (raw: string) => {
			const parsed = parseQuickAdd(raw, labels.map(l => l.title ?? ''))
			const {data} = await tasksCreate({
				path: {project: projectId},
				body: {title: parsed.title || raw, priority: parsed.priority, ...extra},
			})
			for (const title of parsed.labels) {
				const label = labels.find(l => l.title === title)
				if (label?.id) await taskLabelsCreate({path: {task: data.id!}, body: {label_id: label.id}})
			}
			return data
		},
		onSuccess: task => {
			setValue('')
			onCreated?.(task)
			inputRef.current?.focus()
		},
		onSettled: () => invalidateTasks(),
	})

	return (
		<form
			onSubmit={e => {
				e.preventDefault()
				if (value.trim() && !create.isPending) create.mutate(value.trim())
			}}
			className={cn(
				'flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 transition-colors focus-within:border-solid focus-within:border-ring focus-within:bg-background hover:bg-muted/40',
				className,
			)}
		>
			{create.isPending ? <Spinner className="size-4 text-muted-foreground" /> : <PlusIcon className="size-4 text-muted-foreground" />}
			<input
				ref={inputRef}
				value={value}
				onChange={e => setValue(e.target.value)}
				placeholder={placeholder}
				className="h-6 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			/>
			{value && (
				<span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
					<kbd className="font-sans">*label !priority</kbd>
					<CornerDownLeftIcon className="size-3" />
				</span>
			)}
		</form>
	)
}
