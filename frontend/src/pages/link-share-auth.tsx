import {useEffect, useRef, useState} from 'react'
import {useNavigate, useParams} from 'react-router'
import {authLinkShare} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Field, FieldError, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Spinner} from '@/components/ui/spinner'
import {ApiError, errorMessage} from '@/lib/api'
import {useAuth} from '@/lib/auth'

// Vikunja error codes for a password-protected share.
const PASSWORD_REQUIRED = 13001
const PASSWORD_INVALID = 13002

export default function LinkShareAuth() {
	const {share = ''} = useParams()
	const {adoptToken} = useAuth()
	const navigate = useNavigate()
	const [needsPassword, setNeedsPassword] = useState(false)
	const [password, setPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [pending, setPending] = useState(false)
	const started = useRef(false)

	async function authenticate(pw?: string) {
		setPending(true)
		setError(null)
		try {
			const {data} = await authLinkShare({path: {share}, body: pw ? {password: pw} : {}})
			if (!data.token) throw new Error('Share response has no token')
			adoptToken(data.token)
			navigate(`/projects/${data.project_id}`, {replace: true})
		} catch (e) {
			if (e instanceof ApiError && (e.code === PASSWORD_REQUIRED || e.code === PASSWORD_INVALID)) {
				setNeedsPassword(true)
				if (pw) setError('Wrong password.')
			} else {
				setError(errorMessage(e))
			}
		} finally {
			setPending(false)
		}
	}

	useEffect(() => {
		if (started.current) return
		started.current = true
		void authenticate()
	}, [])

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Shared project</CardTitle>
					<CardDescription>{needsPassword ? 'This link is password protected.' : 'Opening the shared project…'}</CardDescription>
				</CardHeader>
				<CardContent>
					{needsPassword ? (
						<form
							onSubmit={e => {
								e.preventDefault()
								void authenticate(password)
							}}
						>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="share-pw">Password</FieldLabel>
									<Input id="share-pw" type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} />
								</Field>
								{error && <FieldError>{error}</FieldError>}
								<Button type="submit" disabled={pending || !password}>
									{pending && <Spinner />}
									Open
								</Button>
							</FieldGroup>
						</form>
					) : error ? (
						<FieldError>{error}</FieldError>
					) : (
						<div className="flex justify-center py-4">
							<Spinner className="size-6 text-muted-foreground" />
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
