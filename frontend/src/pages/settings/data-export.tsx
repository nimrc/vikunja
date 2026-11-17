import {useState} from 'react'
import {useMutation, useQuery} from '@tanstack/react-query'
import {DownloadIcon, FileArchiveIcon} from 'lucide-react'
import {toast} from 'sonner'
import {userExportDownload, userExportRequest, userExportStatus} from '@/client/generated'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card'
import {Field, FieldDescription, FieldLabel} from '@/components/ui/field'
import {Input} from '@/components/ui/input'
import {Skeleton} from '@/components/ui/skeleton'
import {formatDateTime, parseDate, relative} from '@/lib/format'
import {queryClient, useCurrentUser} from '@/lib/queries'
import {SettingsHeader} from './common'

const exportKey = ['user-export'] as const

function size(bytes = 0) {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

export default function DataExport() {
	const {data: user} = useCurrentUser()
	const local = user?.is_local_user !== false
	const [password, setPassword] = useState('')
	const {data: status, isLoading} = useQuery({
		queryKey: exportKey,
		queryFn: async ({signal}) => (await userExportStatus({signal})).data ?? null,
	})
	const ready = status?.id ? status : null
	const created = parseDate(ready?.created)
	const expires = parseDate(ready?.expires)

	const request = useMutation({
		mutationFn: () => userExportRequest({body: {password}}),
		onSuccess: () => {
			toast.success("Export requested. We'll email you when it's ready.")
			setPassword('')
			queryClient.invalidateQueries({queryKey: exportKey})
		},
	})
	const download = useMutation({
		mutationFn: async () => (await userExportDownload({body: {password}, parseAs: 'blob'})).data as Blob,
		onSuccess: blob => {
			const url = URL.createObjectURL(blob)
			const a = Object.assign(document.createElement('a'), {href: url, download: 'vikunja-export.zip'})
			a.click()
			setTimeout(() => URL.revokeObjectURL(url), 1000)
			setPassword('')
		},
	})
	const needsPassword = local && !password

	return (
		<>
			<SettingsHeader title="Data export" description="Download a zip of all your projects, tasks, comments and attachments." />
			{isLoading ? (
				<Skeleton className="h-48 rounded-xl" />
			) : (
				<Card>
					<CardHeader>
						<CardTitle>{ready ? 'Your export is ready' : 'Request an export'}</CardTitle>
						<CardDescription>
							{ready
								? 'Download it before it expires, or request a fresh one.'
								: "Preparing the export runs in the background. You'll get an email when it's done."}
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4">
						{ready && (
							<div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
								<FileArchiveIcon className="size-5 text-muted-foreground" />
								<div className="grid flex-1 text-sm">
									<span className="font-medium">vikunja-export.zip · {size(ready.size)}</span>
									<span className="text-xs text-muted-foreground">
										{created && <span title={formatDateTime(created)}>Created {relative(created)}</span>}
										{expires && <span title={formatDateTime(expires)}> · expires {relative(expires)}</span>}
									</span>
								</div>
							</div>
						)}
						{local && (
							<Field>
								<FieldLabel htmlFor="export-password">Current password</FieldLabel>
								<Input
									id="export-password"
									type="password"
									autoComplete="current-password"
									value={password}
									onChange={e => setPassword(e.target.value)}
								/>
								<FieldDescription>Required to request or download your data.</FieldDescription>
							</Field>
						)}
					</CardContent>
					<CardFooter className="justify-end gap-2 border-t">
						<Button
							variant={ready ? 'outline' : 'default'}
							disabled={needsPassword || request.isPending}
							onClick={() => request.mutate()}
						>
							{ready ? 'Request new export' : 'Request export'}
						</Button>
						{ready && (
							<Button disabled={needsPassword || download.isPending} onClick={() => download.mutate()}>
								<DownloadIcon />
								Download
							</Button>
						)}
					</CardFooter>
				</Card>
			)}
		</>
	)
}
