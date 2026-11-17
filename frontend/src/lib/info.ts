import {useQuery} from '@tanstack/react-query'
import {info} from '@/client/generated'

/** Instance feature flags (/info); they only change on a server restart. */
export function useServerInfo() {
	return useQuery({
		queryKey: ['info'],
		queryFn: async ({signal}) => (await info({signal})).data,
		staleTime: 30 * 60_000,
	})
}
