import {useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {toast} from 'sonner'
import {userChangePassword} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardFooter} from '@/components/ui/card'
import {Field, FieldError, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {SettingsHeader} from './common'

export default function Password() {
	const [old, setOld] = useState('')
	const [next, setNext] = useState('')
	const [confirm, setConfirm] = useState('')
	const mismatch = confirm.length > 0 && next !== confirm
	const save = useMutation({
		mutationFn: () => userChangePassword({body: {old_password: old, new_password: next}}),
		onSuccess: () => {
			toast.success('Password changed')
			setOld('')
			setNext('')
			setConfirm('')
		},
	})
	return (
		<>
			<SettingsHeader title="Password" description="Use a long password you don't use anywhere else." />
			<Card>
				<form
					onSubmit={e => {
						e.preventDefault()
						if (old && next && !mismatch) save.mutate()
					}}
					className="grid gap-4"
				>
					<CardContent>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="old-password">Current password</FieldLabel>
								<Input id="old-password" type="password" autoComplete="current-password" value={old} onChange={e => setOld(e.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor="new-password">New password</FieldLabel>
								<Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={next} onChange={e => setNext(e.target.value)} />
							</Field>
							<Field data-invalid={mismatch || undefined}>
								<FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
								<Input
									id="confirm-password"
									type="password"
									autoComplete="new-password"
									aria-invalid={mismatch || undefined}
									value={confirm}
									onChange={e => setConfirm(e.target.value)}
								/>
								{mismatch && <FieldError>The passwords don't match.</FieldError>}
							</Field>
						</FieldGroup>
					</CardContent>
					<CardFooter className="justify-end border-t">
						<Button type="submit" disabled={!old || !next || next !== confirm || save.isPending}>
							Update password
						</Button>
					</CardFooter>
				</form>
			</Card>
		</>
	)
}
