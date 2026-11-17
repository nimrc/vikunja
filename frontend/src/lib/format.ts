import {format, formatDistanceToNowStrict, isPast, isToday, isTomorrow, isYesterday, isThisYear} from 'date-fns'
import type {Project, User} from '@/client/generated'
import {API_BASE} from '@/lib/api'

/** Vikunja sends the zero time for "unset". */
export function parseDate(value?: string | null): Date | null {
	if (!value || value.startsWith('0001-01-01')) return null
	const d = new Date(value)
	return Number.isNaN(d.getTime()) ? null : d
}

/** The API wants the zero time to clear a date. */
export const NULL_DATE = '0001-01-01T00:00:00Z'

export function toApiDate(d: Date | null): string {
	return d ? d.toISOString() : NULL_DATE
}

export function hasTime(d: Date) {
	return d.getHours() !== 0 || d.getMinutes() !== 0
}

export function formatDue(d: Date): string {
	const time = hasTime(d) ? ` ${format(d, 'HH:mm')}` : ''
	if (isToday(d)) return `Today${time}`
	if (isTomorrow(d)) return `Tomorrow${time}`
	if (isYesterday(d)) return `Yesterday${time}`
	return format(d, isThisYear(d) ? 'MMM d' : 'MMM d, yyyy') + time
}

export function formatDateTime(d: Date): string {
	return format(d, isThisYear(d) ? 'MMM d, HH:mm' : 'MMM d yyyy, HH:mm')
}

export function relative(d: Date): string {
	return formatDistanceToNowStrict(d, {addSuffix: true})
}

export function isOverdue(d: Date | null, done?: boolean) {
	return !!d && !done && isPast(d)
}

export const PRIORITIES = [
	{value: 0, label: 'None'},
	{value: 1, label: 'Low'},
	{value: 2, label: 'Medium'},
	{value: 3, label: 'High'},
	{value: 4, label: 'Urgent'},
	{value: 5, label: 'DO NOW'},
] as const

export function priorityLabel(p?: number) {
	return PRIORITIES.find(x => x.value === p)?.label ?? 'None'
}

/** Vikunja stores colors as hex without the leading '#'. */
export function cssColor(hex?: string | null): string | undefined {
	if (!hex) return undefined
	return hex.startsWith('#') ? hex : `#${hex}`
}

export function apiColor(css: string): string {
	return css.replace(/^#/, '')
}

/** Readable text color on top of a hex background. */
export function contrastText(hex?: string | null): string {
	const c = cssColor(hex)
	if (!c || c.length < 7) return 'inherit'
	const r = parseInt(c.slice(1, 3), 16)
	const g = parseInt(c.slice(3, 5), 16)
	const b = parseInt(c.slice(5, 7), 16)
	return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0a0a0a' : '#fafafa'
}

export function displayName(u?: User | null): string {
	if (!u) return ''
	return u.name || u.username || ''
}

export function avatarUrl(u?: User | null, size = 64): string | undefined {
	if (!u?.username) return undefined
	return `${API_BASE}/avatar/${encodeURIComponent(u.username)}?size=${size}`
}

export function initials(u?: User | null): string {
	const n = displayName(u)
	return n
		.split(/\s+/)
		.map(p => p[0])
		.join('')
		.slice(0, 2)
		.toUpperCase()
}

export type ProjectNode = Project & {id: number; children: ProjectNode[]}

/** Builds the sidebar tree. Saved filters (id < -1) and Favorites (-1) stay top level. */
export function projectTree(projects: Project[], includeArchived = false): ProjectNode[] {
	const nodes = new Map<number, ProjectNode>()
	for (const p of projects) {
		if (typeof p.id !== 'number') continue
		if (!includeArchived && p.is_archived) continue
		nodes.set(p.id, {...p, id: p.id, children: []})
	}
	const roots: ProjectNode[] = []
	for (const n of nodes.values()) {
		const parent = n.parent_project_id ? nodes.get(n.parent_project_id) : undefined
		if (parent) parent.children.push(n)
		else roots.push(n)
	}
	const sort = (list: ProjectNode[]) => {
		list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
		list.forEach(n => sort(n.children))
	}
	sort(roots)
	return roots
}

export function isSavedFilter(p: {id?: number}) {
	return (p.id ?? 0) < -1
}

export function isFavoritesPseudo(p: {id?: number}) {
	return p.id === -1
}

/** The first view the user lands on when opening a project. */
export function defaultViewId(p?: Project | null): number | undefined {
	const views = [...(p?.views ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
	return views[0]?.id
}
