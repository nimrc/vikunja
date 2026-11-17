import {useQuery} from '@tanstack/react-query'
import {avatarGet, type User} from '@/client/generated'
import {queryClient} from '@/lib/queries'

const AVATAR_KEY = 'avatar'

/**
 * The avatar endpoint needs the bearer token, so a plain <img src> would 401:
 * fetch the image through the authenticated client and hand out an object URL.
 */
export function useAvatarSrc(user: Pick<User, 'username'> | null | undefined, size = 64): string | undefined {
	const username = user?.username
	const {data} = useQuery({
		queryKey: [AVATAR_KEY, username, size],
		queryFn: async ({signal}) =>
			(await avatarGet({path: {username: username!}, query: {size}, parseAs: 'blob', signal})).data as Blob,
		enabled: !!username,
		staleTime: 60 * 60_000,
		gcTime: 60 * 60_000,
		retry: false,
		refetchOnWindowFocus: false,
	})

	return objectUrl(data)
}

// One URL per blob, shared by every component showing it. Only blobs replaced by a refetch leak, which is rare and tiny.
const urls = new WeakMap<Blob, string>()
export function objectUrl(blob: Blob | undefined): string | undefined {
	if (!blob) return undefined
	let url = urls.get(blob)
	if (!url) {
		url = URL.createObjectURL(blob)
		urls.set(blob, url)
	}
	return url
}

export function invalidateAvatars() {
	return queryClient.invalidateQueries({queryKey: [AVATAR_KEY]})
}
