import {useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {toast} from 'sonner'
import {userCancelEmailUpdate, userResendEmailConfirmation, userUpdateEmail} from '@/client/generated'
import {Alert} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
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
				<div className="mb-4">
					<Alert
						title="Waiting for confirmation"
						action={
							<div className="flex gap-1">
								<Button size="sm" disabled={resend.isPending} onClick={() => resend.mutate()}>
									Resend
								</Button>
								<Button size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
									Cancel change
								</Button>
							</div>
						}
					>
						We sent a link to {user.pending_email}. Your address changes once you click it.
					</Alert>
				</div>
			)}
			<Card
				footer={
					<div className="flex justify-end">
						<Button
							type="submit"
							form="email-form"
							tone="primary"
							disabled={!email.trim() || !password || save.isPending}
						>
							Change email
						</Button>
					</div>
				}
			>
				<form
					id="email-form"
					className="grid gap-4"
					onSubmit={e => {
						e.preventDefault()
						if (email.trim() && password) save.mutate()
					}}
				>
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
				</form>
			</Card>
		</>
	)
}
