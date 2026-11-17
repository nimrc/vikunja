import {useState, type ReactNode} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'
import {CheckIcon, ChevronsUpDownIcon} from 'lucide-react'
import {toast} from 'sonner'
import {userSettingsRead, userTimezones, userUpdateSettings, type UserGeneralSettings} from '@/client/generated'
import {ProjectSelect} from '@/components/project-select'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command'
import {Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSeparator} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Skeleton} from '@/components/ui/skeleton'
import {Switch} from '@/components/ui/switch'
import {invalidateAvatars} from '@/lib/avatar'
import {keys, queryClient} from '@/lib/queries'
import {cn} from '@/lib/utils'
import {SettingsHeader} from './common'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const settingsKey = ['user-settings'] as const

/** The API stores "9:00"; <input type=time> wants "09:00". */
function padTime(t?: string) {
	const [h = '9', m = '00'] = (t ?? '').split(':')
	return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

export default function General() {
	const {data, isLoading} = useQuery({
		queryKey: settingsKey,
		queryFn: async ({signal}) => (await userSettingsRead({signal})).data,
	})
	return (
		<>
			<SettingsHeader title="General" description="Your profile and how Vikunja behaves for you." />
			{isLoading || !data ? (
				<div className="grid gap-4">
					<Skeleton className="h-56 rounded-xl" />
					<Skeleton className="h-48 rounded-xl" />
				</div>
			) : (
				<GeneralForm initial={data} />
			)}
		</>
	)
}

function GeneralForm({initial}: {initial: UserGeneralSettings}) {
	const [s, setS] = useState<UserGeneralSettings>({...initial, overdue_tasks_reminders_time: padTime(initial.overdue_tasks_reminders_time)})
	const set = <K extends keyof UserGeneralSettings>(k: K, v: UserGeneralSettings[K]) => setS(prev => ({...prev, [k]: v}))

	const save = useMutation({
		mutationFn: () => {
			// PUT replaces every setting, so send back what we read (language, frontend settings…).
			const {$schema: _schema, extra_settings_links: _links, ...body} = s
			return userUpdateSettings({body})
		},
		onSuccess: () => {
			toast.success('Settings saved')
			queryClient.invalidateQueries({queryKey: settingsKey})
			queryClient.invalidateQueries({queryKey: keys.user})
			// Initials avatars are drawn from the display name.
			invalidateAvatars()
		},
	})

	return (
		<form
			className="grid gap-6"
			onSubmit={e => {
				e.preventDefault()
				save.mutate()
			}}
		>
			<Card>
				<CardHeader>
					<CardTitle>Profile</CardTitle>
					<CardDescription>How you appear to others and in time-based features.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="name">Display name</FieldLabel>
							<Input id="name" value={s.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel>Time zone</FieldLabel>
								<TimezoneSelect value={s.timezone ?? ''} onChange={v => set('timezone', v)} />
							</Field>
							<Field>
								<FieldLabel>Week starts on</FieldLabel>
								<Select value={String(s.week_start ?? 0)} onValueChange={v => set('week_start', Number(v))}>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{WEEKDAYS.map((d, i) => (
											<SelectItem key={d} value={String(i)}>
												{d}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>
						<Field>
							<FieldLabel>Default project</FieldLabel>
							<ProjectSelect
								value={s.default_project_id || null}
								onChange={id => set('default_project_id', id ?? 0)}
								allowNone
								noneLabel="No default project"
							/>
							<FieldDescription>New tasks without a project end up here.</FieldDescription>
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Notifications & privacy</CardTitle>
					<CardDescription>Emails Vikunja sends you, and who can find you.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<ToggleField
							id="email-reminders"
							label="Email reminders"
							description="Send task reminders by email as well as in the app."
							checked={!!s.email_reminders_enabled}
							onChange={v => set('email_reminders_enabled', v)}
						/>
						<ToggleField
							id="overdue"
							label="Daily overdue summary"
							description="An email listing your undone overdue tasks."
							checked={!!s.overdue_tasks_reminders_enabled}
							onChange={v => set('overdue_tasks_reminders_enabled', v)}
						>
							{s.overdue_tasks_reminders_enabled && (
								<Input
									type="time"
									aria-label="Send at"
									className="w-32"
									value={s.overdue_tasks_reminders_time}
									onChange={e => set('overdue_tasks_reminders_time', e.target.value)}
								/>
							)}
						</ToggleField>
						<FieldSeparator />
						<ToggleField
							id="disc-name"
							label="Discoverable by name"
							description="Others can find you by searching for parts of your name."
							checked={!!s.discoverable_by_name}
							onChange={v => set('discoverable_by_name', v)}
						/>
						<ToggleField
							id="disc-email"
							label="Discoverable by email"
							description="Others can find you by searching for your exact email address."
							checked={!!s.discoverable_by_email}
							onChange={v => set('discoverable_by_email', v)}
						/>
					</FieldGroup>
				</CardContent>
			</Card>
			<div className="flex justify-end">
				<Button type="submit" disabled={save.isPending}>
					Save changes
				</Button>
			</div>
		</form>
	)
}

function ToggleField({
	id,
	label,
	description,
	checked,
	onChange,
	children,
}: {
	id: string
	label: string
	description: string
	checked: boolean
	onChange: (v: boolean) => void
	children?: ReactNode
}) {
	return (
		<Field orientation="horizontal">
			<FieldContent>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				<FieldDescription>{description}</FieldDescription>
				{children}
			</FieldContent>
			<Switch id={id} checked={checked} onCheckedChange={onChange} />
		</Field>
	)
}

function TimezoneSelect({value, onChange}: {value: string; onChange: (v: string) => void}) {
	const [open, setOpen] = useState(false)
	const {data: zones} = useQuery({
		queryKey: ['timezones'],
		queryFn: async ({signal}) => (await userTimezones({signal})).data ?? [],
		staleTime: Infinity,
	})
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" role="combobox" className="w-full justify-between font-normal">
					<span className={cn('truncate', !value && 'text-muted-foreground')}>{value || 'Select a time zone'}</span>
					<ChevronsUpDownIcon className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
				<Command>
					<CommandInput placeholder="Search time zones…" />
					<CommandList>
						<CommandEmpty>No time zone found.</CommandEmpty>
						<CommandGroup>
							{(zones ?? []).map(z => (
								<CommandItem
									key={z}
									value={z}
									onSelect={() => {
										onChange(z)
										setOpen(false)
									}}
								>
									<span className="truncate">{z.replaceAll('_', ' ')}</span>
									{z === value && <CheckIcon className="ml-auto" />}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
