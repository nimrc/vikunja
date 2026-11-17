import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react'

type Theme = 'light' | 'dark' | 'system'
type ThemeState = {theme: Theme; resolvedTheme: 'light' | 'dark'; setTheme: (t: string) => void}

const KEY = 'theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readTheme(): Theme {
	try {
		const t = localStorage.getItem(KEY)
		return t === 'light' || t === 'dark' ? t : 'system'
	} catch {
		return 'system'
	}
}

const ThemeContext = createContext<ThemeState | null>(null)

// index.html applies the stored theme before first paint; this keeps it in sync afterwards.
export function ThemeProvider({children}: {children: ReactNode}) {
	const [theme, setThemeState] = useState<Theme>(readTheme)
	const [systemDark, setSystemDark] = useState(() => media().matches)
	const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

	useEffect(() => {
		const m = media()
		const onChange = () => setSystemDark(m.matches)
		m.addEventListener('change', onChange)
		return () => m.removeEventListener('change', onChange)
	}, [])

	useEffect(() => {
		const root = document.documentElement
		root.classList.toggle('dark', resolvedTheme === 'dark')
		root.style.colorScheme = resolvedTheme
	}, [resolvedTheme])

	const setTheme = useCallback((t: string) => {
		const next: Theme = t === 'light' || t === 'dark' ? t : 'system'
		setThemeState(next)
		try {
			if (next === 'system') localStorage.removeItem(KEY)
			else localStorage.setItem(KEY, next)
		} catch {
			// per-browser convenience only
		}
	}, [])

	return <ThemeContext.Provider value={{theme, resolvedTheme, setTheme}}>{children}</ThemeContext.Provider>
}

export function useTheme() {
	const ctx = useContext(ThemeContext)
	if (!ctx) throw new Error('useTheme outside ThemeProvider')
	return ctx
}
