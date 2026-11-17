import {useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {MailWarningIcon} from 'lucide-react'
import {toast} from 'sonner'
import {userCancelEmailUpdate, userResendEmailConfirmation, userUpdateEmail} from '@/client/generated'
import {Alert, AlertAction, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardFooter} from '@/components/ui/card'
import {Field, FieldDescription, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {keys, queryClient, useCurrentUser} from '@/lib/queries'
import {SettingsHeader} from './common'

export default function Email() {
	const {data: user} = useCurrentUser()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const refresh = () => queryClient.invalidateQueries({queryKey: keys.user})

	const save = useMutation({
		mutationFn: () => userUpdateEmail({body: {new_email: email.trim(), password}}),
		onSuccess: () => {
			toast.success('Check your inbox to confirm the new address')
			setEmail('')
			setPassword('')
			refresh()
		},
	})
	const cancel = useMutation({mutationFn: () => userCancelEmailUpdate(), onSuccess: refresh})
	const resend = useMutation({
		mutationFn: () => userResendEmailConfirmation(),
		onSuccess: () => toast.success('Confirmation email sent'),
	})

	return (
		<>
			<SettingsHeader
				title="Email"
				description={
					user?.email ? (
						<>
							Your account email is <span className="font-medium text-foreground">{user.email}</span>.
						</>
					) : (
						'Used for reminders and password resets.'
					)
				}
			/>
			{user?.pending_email && (
				<Alert className="mb-4">
					<MailWarningIcon />
					<AlertTitle>Waiting for confirmation</AlertTitle>
					<AlertDescription>
						We sent a link to {user.pending_email}. Your address changes once you click it.
					</AlertDescription>
					<AlertAction className="flex gap-1">
						<Button size="sm" variant="ghost" disabled={resend.isPending} onClick={() => resend.mutate()}>
							Resend
						</Button>
						<Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
							Cancel change
						</Button>
					</AlertAction>
				</Alert>
			)}
			<Card>
				<form
					className="grid gap-4"
					onSubmit={e => {
						e.preventDefault()
						if (email.trim() && password) save.mutate()
					}}
				>
					<CardContent>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="new-email">New email</FieldLabel>
								<Input id="new-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
								<FieldDescription>We'll send a confirmation link to this address.</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor="email-password">Current password</FieldLabel>
								<Input id="email-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
							</Field>
						</FieldGroup>
					</CardContent>
					<CardFooter className="justify-end border-t">
						<Button type="submit" disabled={!email.trim() || !password || save.isPending}>
							Change email
						</Button>
					</CardFooter>
				</form>
			</Card>
		</>
	)
}
