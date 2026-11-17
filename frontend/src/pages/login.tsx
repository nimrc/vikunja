import {useState} from 'react'
import {Navigate, useSearchParams} from 'react-router'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Checkbox} from '@/components/ui/checkbox'
import {Field, FieldError, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Spinner} from '@/components/ui/spinner'
import {ApiError, errorMessage} from '@/lib/api'
import {useAuth} from '@/lib/auth'

// Vikunja error code for "TOTP passcode required".
const TOTP_REQUIRED = 1017

export default function Login() {
	const {authenticated, login} = useAuth()
	const [params] = useSearchParams()
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [totp, setTotp] = useState('')
	const [needsTotp, setNeedsTotp] = useState(false)
	const [remember, setRemember] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)

	const redirect = params.get('redirect')
	if (authenticated) return <Navigate to={redirect?.startsWith('/') ? redirect : '/'} replace />

	async function submit(e: React.FormEvent) {
		e.preventDefault()
		setPending(true)
		setError(null)
		try {
			await login({username, password, totp, remember})
		} catch (err) {
			if (err instanceof ApiError && err.code === TOTP_REQUIRED) {
				setNeedsTotp(true)
			} else {
				setError(errorMessage(err))
			}
		} finally {
			setPending(false)
		}
	}

	return (
		<div className="relative flex min-h-svh items-center justify-center bg-muted/40 p-6">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/0.08,transparent_60%)]"
			/>
			<div className="relative flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center font-semibold">
					<div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
							<path d="M4 12.5 9 17.5 20 6.5" />
						</svg>
					</div>
					Vikunja
				</div>
				<Card title="Welcome back" description="Sign in to your account">
					<form onSubmit={submit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="username">Username or email</FieldLabel>
								<Input
									id="username"
									autoComplete="username"
									autoFocus
									required
									value={username}
									onChange={e => setUsername(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input
									id="password"
									type="password"
									autoComplete="current-password"
									required
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
							</Field>
							{needsTotp && (
								<Field>
									<FieldLabel htmlFor="totp">Two-factor code</FieldLabel>
									<Input
										id="totp"
										inputMode="numeric"
										autoComplete="one-time-code"
										autoFocus
										value={totp}
										onChange={e => setTotp(e.target.value)}
									/>
								</Field>
							)}
							<Checkbox
								label="Keep me signed in"
								checked={remember}
								onCheckedChange={setRemember}
							/>
							{error && <FieldError>{error}</FieldError>}
							<Button type="submit" tone="primary" className="w-full" disabled={pending}>
								{pending && <Spinner />}
								Sign in
							</Button>
						</FieldGroup>
					</form>
				</Card>
			</div>
		</div>
	)
}
