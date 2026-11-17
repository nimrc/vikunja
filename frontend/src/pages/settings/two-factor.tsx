import {useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'
import {ShieldCheckIcon, ShieldOffIcon} from 'lucide-react'
import {toast} from 'sonner'
import {totpDisable, totpEnable, totpEnroll, totpGet, totpQrcode, type Totp} from '@/client/generated'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Field, FieldDescription, FieldGroup, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Skeleton} from '@/components/ui/skeleton'
import {ApiError} from '@/lib/api'
import {objectUrl} from '@/lib/avatar'
import {useAuth} from '@/lib/auth'
import {queryClient} from '@/lib/queries'
import {SecretBox, SettingsHeader} from './common'

const totpKey = ['totp'] as const
// "TOTP is not enabled for this user": the normal state before enrolling.
const TOTP_NOT_ENABLED = 1016

export default function TwoFactor() {
	const {data: totp, isLoading} = useQuery({
		queryKey: totpKey,
		queryFn: async ({signal}): Promise<Totp> => {
			try {
				return (await totpGet({signal})).data
			} catch (e) {
				if (e instanceof ApiError && e.code === TOTP_NOT_ENABLED) return {}
				throw e
			}
		},
	})

	return (
		<>
			<SettingsHeader
				title="Two-factor authentication"
				description="Require a code from an authenticator app in addition to your password."
				action={
					totp?.enabled ? (
						<Badge className="gap-1">
							<ShieldCheckIcon className="size-3" /> Enabled
						</Badge>
					) : undefined
				}
			/>
			{isLoading ? (
				<Skeleton className="h-48 rounded-xl" />
			) : totp?.enabled ? (
				<DisableCard />
			) : totp?.secret ? (
				<ConfirmCard secret={totp.secret} />
			) : (
				<EnrollCard />
			)}
		</>
	)
}

function EnrollCard() {
	const [password, setPassword] = useState('')
	const enroll = useMutation({
		mutationFn: () => totpEnroll({body: {password}}),
		onSuccess: () => queryClient.invalidateQueries({queryKey: totpKey}),
	})
	return (
		<Card
			title="Set up an authenticator"
			description="Works with any TOTP app, e.g. 1Password, Bitwarden, Google Authenticator or Aegis."
			footer={
				<div className="flex justify-end">
					<Button type="submit" form="totp-enroll-form" tone="primary" disabled={!password || enroll.isPending}>
						Start setup
					</Button>
				</div>
			}
		>
			<form
				id="totp-enroll-form"
				className="grid gap-4"
				onSubmit={e => {
					e.preventDefault()
					enroll.mutate()
				}}
			>
				<Field>
					<FieldLabel htmlFor="totp-enroll-password">Current password</FieldLabel>
					<Input
						id="totp-enroll-password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={e => setPassword(e.target.value)}
					/>
				</Field>
			</form>
		</Card>
	)
}

function useQrSrc() {
	const {data} = useQuery({
		queryKey: [...totpKey, 'qr'],
		queryFn: async ({signal}) => (await totpQrcode({parseAs: 'blob', signal})).data as Blob,
		staleTime: Infinity,
	})
	return objectUrl(data)
}

function ConfirmCard({secret}: {secret: string}) {
	const {logout} = useAuth()
	const qr = useQrSrc()
	const [passcode, setPasscode] = useState('')
	const [password, setPassword] = useState('')
	const enable = useMutation({
		mutationFn: () => totpEnable({body: {passcode: passcode.replace(/\s/g, ''), password}}),
		onSuccess: async () => {
			toast.success('Two-factor authentication enabled. Sign in again with a code.')
			queryClient.removeQueries({queryKey: totpKey})
			// Enabling revokes the other sessions; start clean with the new factor.
			await logout()
		},
	})
	return (
		<Card
			title="Scan the QR code"
			description="Then enter the 6-digit code your app shows to finish."
			footer={
				<div className="flex justify-end">
					<Button
						type="submit"
						form="totp-confirm-form"
						tone="primary"
						disabled={passcode.replace(/\s/g, '').length < 6 || !password || enable.isPending}
					>
						Enable two-factor
					</Button>
				</div>
			}
		>
			<form
				id="totp-confirm-form"
				className="grid gap-6 sm:grid-cols-[auto_1fr]"
				onSubmit={e => {
					e.preventDefault()
					enable.mutate()
				}}
			>
				<div className="flex size-44 items-center justify-center self-start justify-self-center overflow-hidden rounded-lg border bg-white p-2">
					{qr ? <img src={qr} alt="TOTP QR code" className="size-full" /> : <Skeleton className="size-full" />}
				</div>
				<FieldGroup>
					<Field>
						<FieldLabel>Can't scan? Enter this key</FieldLabel>
						<SecretBox value={secret} />
					</Field>
					<Field>
						<FieldLabel htmlFor="totp-code">Code</FieldLabel>
						<Input
							id="totp-code"
							inputMode="numeric"
							autoComplete="one-time-code"
							placeholder="123 456"
							className="max-w-40 font-mono tracking-widest"
							value={passcode}
							onChange={e => setPasscode(e.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="totp-confirm-password">Current password</FieldLabel>
						<Input
							id="totp-confirm-password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={e => setPassword(e.target.value)}
						/>
						<FieldDescription>You'll be signed out and asked for a code next time.</FieldDescription>
					</Field>
				</FieldGroup>
			</form>
		</Card>
	)
}

function DisableCard() {
	const [open, setOpen] = useState(false)
	const [password, setPassword] = useState('')
	const [passcode, setPasscode] = useState('')
	const disable = useMutation({
		mutationFn: () => totpDisable({body: {password, totp_passcode: passcode.replace(/\s/g, '')}}),
		onSuccess: () => {
			toast.success('Two-factor authentication disabled')
			setOpen(false)
			queryClient.invalidateQueries({queryKey: totpKey})
		},
	})
	return (
		<Card
			title="Your account is protected"
			description="Signing in requires your password and a code from your authenticator app."
			footer={
				open ? (
					<div className="flex justify-end gap-2">
						<Button onClick={() => setOpen(false)}>Cancel</Button>
						<Button
							type="submit"
							form="totp-disable-form"
							tone="danger"
							disabled={!password || !passcode || disable.isPending}
						>
							Disable two-factor
						</Button>
					</div>
				) : (
					<div className="flex justify-end">
						<Button onClick={() => setOpen(true)}>
							<ShieldOffIcon />
							Disable
						</Button>
					</div>
				)
			}
		>
			{open && (
				<form
					id="totp-disable-form"
					className="grid gap-4"
					onSubmit={e => {
						e.preventDefault()
						disable.mutate()
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="totp-disable-password">Current password</FieldLabel>
							<Input
								id="totp-disable-password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={e => setPassword(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="totp-disable-code">Current code</FieldLabel>
							<Input
								id="totp-disable-code"
								inputMode="numeric"
								autoComplete="one-time-code"
								className="max-w-40 font-mono tracking-widest"
								value={passcode}
								onChange={e => setPasscode(e.target.value)}
							/>
						</Field>
					</FieldGroup>
				</form>
			)}
		</Card>
	)
}
