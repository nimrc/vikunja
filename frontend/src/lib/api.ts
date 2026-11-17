import {client} from '@/client/generated/client.gen'
import {createClient, createConfig} from '@/client/generated/client'
import {authRefreshToken} from '@/client/generated/sdk.gen'

declare global {
	interface Window {
		API_URL?: string
	}
}

const apiRoot = (window.API_URL ?? '').replace(/\/+$/, '').replace(/\/api\/v[12]$/, '')
export const API_BASE = `${apiRoot}/api/v2`

const TOKEN_KEY = 'token'
// Refresh this long before expiry so a request never leaves with a dead token.
const REFRESH_MARGIN_SECONDS = 60

export class ApiError extends Error {
	status: number
	code?: number
	constructor(status: number, body: unknown) {
		const b = (body ?? {}) as {detail?: string; title?: string; message?: string; code?: number}
		super(b.detail || b.message || b.title || `Request failed (${status})`)
		this.status = status
		this.code = typeof b.code === 'number' ? b.code : undefined
	}
}

export function getToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY)
	} catch {
		return null
	}
}

export function setToken(token: string | null) {
	try {
		if (token) localStorage.setItem(TOKEN_KEY, token)
		else localStorage.removeItem(TOKEN_KEY)
	} catch {
		// storage blocked: the session just won't survive a reload
	}
}

type TokenPayload = {exp?: number; id?: number; type?: number; username?: string}

export function tokenPayload(token: string | null): TokenPayload | null {
	if (!token) return null
	try {
		return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
	} catch {
		return null
	}
}

function expiresSoon(token: string) {
	const exp = tokenPayload(token)?.exp
	return typeof exp !== 'number' || exp - REFRESH_MARGIN_SECONDS <= Date.now() / 1000
}

// Skips the auth interceptors: the refresh token travels as an HttpOnly cookie.
const publicClient = createClient(createConfig({baseUrl: API_BASE, credentials: 'include'}))

let inFlight: Promise<string | null> | null = null

export function refreshToken(): Promise<string | null> {
	inFlight ??= (async () => {
		try {
			const res = await authRefreshToken({client: publicClient, throwOnError: false})
			const token = res.response?.ok ? res.data?.token ?? null : null
			setToken(token)
			return token
		} catch {
			return null
		} finally {
			inFlight = null
		}
	})()
	return inFlight
}

const unauthorizedListeners = new Set<() => void>()
export function onUnauthorized(fn: () => void) {
	unauthorizedListeners.add(fn)
	return () => {
		unauthorizedListeners.delete(fn)
	}
}

const originals = new WeakMap<Request, Request>()

client.setConfig({baseUrl: API_BASE, credentials: 'include', throwOnError: true})

client.interceptors.request.use(async request => {
	if (request.headers.has('Authorization')) return request
	let token = getToken()
	if (token && expiresSoon(token) && tokenPayload(token)?.type === 1) {
		token = (await refreshToken()) ?? token
	}
	if (!token) return request
	const headers = new Headers(request.headers)
	headers.set('Authorization', `Bearer ${token}`)
	const authed = new Request(request, {headers})
	originals.set(authed, authed.clone())
	return authed
})

client.interceptors.response.use(async (response, request) => {
	if (response.status !== 401) return response
	const original = originals.get(request)
	if (!original) return response
	const token = await refreshToken()
	if (!token) {
		unauthorizedListeners.forEach(fn => fn())
		return response
	}
	const headers = new Headers(original.headers)
	headers.set('Authorization', `Bearer ${token}`)
	// Sent with plain fetch, so a second 401 is returned as is instead of looping.
	return fetch(new Request(original, {headers}))
})

client.interceptors.error.use((error, response) => {
	if (error instanceof Error) return error
	return new ApiError(response?.status ?? 0, error)
})

export function errorMessage(e: unknown): string {
	if (e instanceof Error) return e.message
	return String(e)
}
