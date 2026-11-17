import {useRef, useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'
import {UploadIcon} from 'lucide-react'
import {toast} from 'sonner'
import {userAvatarUpload, userGetAvatarProvider, userSetAvatarProvider} from '@/client/generated'
import {UserAvatarPlain} from '@/components/user-picker'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {RadioGroup} from '@/components/ui/radio-group'
import {Skeleton} from '@/components/ui/skeleton'
import {invalidateAvatars} from '@/lib/avatar'
import {displayName} from '@/lib/format'
import {queryClient, useCurrentUser} from '@/lib/queries'
import {SettingsHeader} from './common'

const PROVIDERS = [
	{id: 'default', label: 'Default', hint: 'A generic placeholder'},
	{id: 'initials', label: 'Initials', hint: 'Your initials on a colored background'},
	{id: 'gravatar', label: 'Gravatar', hint: 'The image linked to your email at gravatar.com'},
	{id: 'marble', label: 'Marble', hint: 'A generated abstract pattern'},
	{id: 'upload', label: 'Upload', hint: 'An image of your choice'},
] as const

const providerKey = ['avatar-provider'] as const

/** Center-crops to a square so faces don't get squashed by the server-side resize. */
async function squarePng(file: File, size = 512): Promise<Blob> {
	const bitmap = await createImageBitmap(file)
	const side = Math.min(bitmap.width, bitmap.height)
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = Math.min(size, side)
	const ctx = canvas.getContext('2d')!
	ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
	bitmap.close()
	return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not read image'))), 'image/png'))
}

export default function AvatarSettings() {
	const {data: user} = useCurrentUser()
	const fileRef = useRef<HTMLInputElement>(null)
	const [picked, setPicked] = useState<string>()
	const {data, isLoading} = useQuery({
		queryKey: providerKey,
		queryFn: async ({signal}) => (await userGetAvatarProvider({signal})).data,
	})
	const current = picked ?? data?.avatar_provider ?? 'default'

	const done = async (msg: string) => {
		toast.success(msg)
		await queryClient.invalidateQueries({queryKey: providerKey})
		setPicked(undefined)
		invalidateAvatars()
	}
	const setProvider = useMutation({
		mutationFn: (provider: string) => userSetAvatarProvider({body: {avatar_provider: provider}}),
		onSuccess: () => done('Avatar updated'),
		onError: e => {
			setPicked(undefined)
			toast.error(e.message)
		},
	})
	const upload = useMutation({
		mutationFn: async (file: File) => userAvatarUpload({body: {avatar: await squarePng(file)}}),
		onSuccess: () => done('Avatar uploaded'),
	})

	return (
		<>
			<SettingsHeader title="Avatar" description="Shown next to your comments, assignments and in shared projects." />
			<Card>
				<div className="grid gap-6 sm:grid-cols-[auto_1fr]">
					<div className="flex flex-col items-center gap-3 sm:w-40">
						<UserAvatarPlain user={user} size={96} className="text-2xl" />
						<div className="text-center text-sm">
							<p className="font-medium">{displayName(user)}</p>
							<p className="text-xs text-muted-foreground">@{user?.username}</p>
						</div>
					</div>
					{isLoading ? (
						<Skeleton className="h-60" />
					) : (
						<div className="grid gap-3">
							<RadioGroup
								label="Avatar provider"
								options={PROVIDERS.map(p => ({
									value: p.id,
									label: `${p.label} — ${p.hint}`,
								}))}
								value={current}
								onValueChange={v => {
									// Upload only takes effect once a file is chosen.
									if (v === 'upload') {
										fileRef.current?.click()
										return
									}
									setPicked(v)
									setProvider.mutate(v)
								}}
							/>
							<div>
								<Button
									size="sm"
									disabled={upload.isPending}
									onClick={() => fileRef.current?.click()}
								>
									<UploadIcon />
									{upload.isPending ? 'Uploading…' : 'Choose image'}
								</Button>
							</div>
						</div>
					)}
					<input
						ref={fileRef}
						type="file"
						accept="image/png,image/jpeg,image/gif,image/bmp"
						className="hidden"
						onChange={e => {
							const f = e.target.files?.[0]
							e.target.value = ''
							if (f) upload.mutate(f)
						}}
					/>
				</div>
			</Card>
		</>
	)
}
