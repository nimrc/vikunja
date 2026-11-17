import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react'
import {authLogin, authLogout} from '@/client/generated'
import {getToken, onUnauthorized, refreshToken, setToken, tokenPayload} from '@/lib/api'
import {queryClient} from '@/lib/queries'

type AuthState = {
	authenticated: boolean
	ready: boolean
	login: (input: {username: string; password: string; totp?: string; remember: boolean}) => Promise<void>
	adoptToken: (token: string) => void
	logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({children}: {children: ReactNode}) {
	const [authenticated, setAuthenticated] = useState(() => !!getToken())
	const [ready, setReady] = useState(false)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			const token = getToken()
			const exp = tokenPayload(token)?.exp
			// An expired session token can still be renewed through the refresh cookie.
			if (token && typeof exp === 'number' && exp * 1000 < Date.now()) {
				const renewed = await refreshToken()
				if (!cancelled) setAuthenticated(!!renewed)
			}
			if (!cancelled) setReady(true)
		})()
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(
		() =>
			onUnauthorized(() => {
				setToken(null)
				setAuthenticated(false)
				queryClient.clear()
			}),
		[],
	)

	const login = useCallback<AuthState['login']>(async ({username, password, totp, remember}) => {
		const {data} = await authLogin({
			body: {username, password, totp_passcode: totp || undefined, long_token: remember},
		})
		if (!data.token) throw new Error('Login response has no token')
		queryClient.clear()
		setToken(data.token)
		setAuthenticated(true)
	}, [])

	const adoptToken = useCallback((token: string) => {
		queryClient.clear()
		setToken(token)
		setAuthenticated(true)
	}, [])

	const logout = useCallback(async () => {
		try {
			await authLogout()
		} catch {
			// the session expires on its own
		}
		setToken(null)
		queryClient.clear()
		setAuthenticated(false)
	}, [])

	const value = useMemo(() => ({authenticated, ready, login, adoptToken, logout}), [authenticated, ready, login, adoptToken, logout])
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth outside AuthProvider')
	return ctx
}
