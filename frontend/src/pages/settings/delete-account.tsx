import {useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {AlertTriangleIcon, ClockIcon} from 'lucide-react'
import {toast} from 'sonner'
import {userDeletionCancel, userDeletionRequest} from '@/client/generated'
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card'
import {Field, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {formatDateTime, parseDate, relative} from '@/lib/format'
import {keys, queryClient, useCurrentUser} from '@/lib/queries'
import {SettingsHeader} from './common'

export default function DeleteAccount() {
	const {data: user} = useCurrentUser()
	const local = user?.is_local_user !== false
	const scheduled = parseDate(user?.deletion_scheduled_at)
	const [password, setPassword] = useState('')
	const refresh = () => queryClient.invalidateQueries({queryKey: keys.user})

	const request = useMutation({
		mutationFn: () => userDeletionRequest({body: {password}}),
		onSuccess: () => {
			toast.success('Check your email to confirm the deletion')
			setPassword('')
			refresh()
		},
	})
	const cancel = useMutation({
		mutationFn: () => userDeletionCancel({body: {password}}),
		onSuccess: () => {
			toast.success('Account deletion cancelled')
			setPassword('')
			refresh()
		},
	})
	const passwordField = local && (
		<Field>
			<FieldLabel htmlFor="deletion-password">Current password</FieldLabel>
			<Input
				id="deletion-password"
				type="password"
				autoComplete="current-password"
				value={password}
				onChange={e => setPassword(e.target.value)}
			/>
		</Field>
	)

	return (
		<>
			<SettingsHeader title="Delete account" description="Permanently remove your account and everything you own." />
			{scheduled ? (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ClockIcon className="size-4" />
							Deletion scheduled
						</CardTitle>
						<CardDescription>
							Your account will be deleted{' '}
							<span className="font-medium text-foreground" title={formatDateTime(scheduled)}>
								{relative(scheduled)}
							</span>
							. Changed your mind? Cancel it below.
						</CardDescription>
					</CardHeader>
					{local && <CardContent>{passwordField}</CardContent>}
					<CardFooter className="justify-end border-t">
						<Button disabled={(local && !password) || cancel.isPending} onClick={() => cancel.mutate()}>
							Cancel deletion
						</Button>
					</CardFooter>
				</Card>
			) : (
				<Card className="ring-destructive/30">
					<CardHeader>
						<CardTitle>Delete my account</CardTitle>
						<CardDescription>We'll email you a confirmation link. After confirming, deletion happens in 3 days.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						<Alert variant="destructive">
							<AlertTriangleIcon />
							<AlertTitle>This cannot be undone</AlertTitle>
							<AlertDescription>
								All projects you own, their tasks, comments and attachments are deleted. Projects shared with you stay
								with their owners.
							</AlertDescription>
						</Alert>
						{passwordField}
					</CardContent>
					<CardFooter className="justify-end border-t">
						<Button
							variant="destructive"
							disabled={(local && !password) || request.isPending}
							onClick={() => request.mutate()}
						>
							Request deletion
						</Button>
					</CardFooter>
				</Card>
			)}
		</>
	)
}
