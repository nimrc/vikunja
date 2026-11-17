import {useMemo, useState} from 'react'
import {CheckIcon, ChevronsUpDownIcon} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {ColorDot} from '@/components/color-picker'
import {cn} from '@/lib/utils'
import {projectTree, type ProjectNode} from '@/lib/format'
import {useProjects} from '@/lib/queries'

type Option = {id: number; title: string; path: string; color?: string; depth: number}

export function useProjectOptions(excludeId?: number): Option[] {
	const {projects} = useProjects()
	return useMemo(() => {
		const out: Option[] = []
		const walk = (nodes: ProjectNode[], prefix: string, depth: number) => {
			for (const n of nodes) {
				if (n.id <= 0 || n.id === excludeId) continue
				const path = prefix ? `${prefix} / ${n.title}` : n.title ?? ''
				out.push({id: n.id, title: n.title ?? '', path, color: n.hex_color, depth})
				walk(n.children, path, depth + 1)
			}
		}
		walk(projectTree(projects), '', 0)
		return out
	}, [projects, excludeId])
}

export function ProjectSelect({
	value,
	onChange,
	allowNone,
	noneLabel = 'None',
	excludeId,
	className,
}: {
	value: number | null
	onChange: (id: number | null) => void
	allowNone?: boolean
	noneLabel?: string
	excludeId?: number
	className?: string
}) {
	const [open, setOpen] = useState(false)
	const options = useProjectOptions(excludeId)
	const selected = options.find(o => o.id === value)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" role="combobox" className={cn('w-full justify-between font-normal', className)}>
					<span className="flex min-w-0 items-center gap-2">
						{selected && <ColorDot color={selected.color} />}
						<span className={cn('truncate', !selected && 'text-muted-foreground')}>
							{selected?.path ?? noneLabel}
						</span>
					</span>
					<ChevronsUpDownIcon className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search projects…" />
					<CommandList>
						<CommandEmpty>No project found.</CommandEmpty>
						<CommandGroup>
							{allowNone && (
								<CommandItem
									value={`__none ${noneLabel}`}
									onSelect={() => {
										onChange(null)
										setOpen(false)
									}}
								>
									<span className="text-muted-foreground">{noneLabel}</span>
									{value === null && <CheckIcon className="ml-auto" />}
								</CommandItem>
							)}
							{options.map(o => (
								<CommandItem
									key={o.id}
									value={`${o.path} ${o.id}`}
									onSelect={() => {
										onChange(o.id)
										setOpen(false)
									}}
								>
									<span style={{paddingLeft: o.depth * 12}} className="flex min-w-0 items-center gap-2">
										<ColorDot color={o.color} />
										<span className="truncate">{o.title}</span>
									</span>
									{value === o.id && <CheckIcon className="ml-auto" />}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
