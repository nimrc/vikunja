import {lazy, Suspense, type ReactNode} from 'react'
import {Navigate, Route, Routes, useLocation, type Location} from 'react-router'
import {AppLayout} from '@/components/app-layout'
import {PageSpinner} from '@/components/page-spinner'
import {useAuth} from '@/lib/auth'

const Login = lazy(() => import('@/pages/login'))
const LinkShareAuth = lazy(() => import('@/pages/link-share-auth'))
const Home = lazy(() => import('@/pages/home'))
const Upcoming = lazy(() => import('@/pages/upcoming'))
const Projects = lazy(() => import('@/pages/projects'))
const ProjectPage = lazy(() => import('@/pages/project/project-page'))
const ProjectSettings = lazy(() => import('@/pages/project/project-settings'))
const TaskPage = lazy(() => import('@/pages/task/task-page'))
const TaskDialog = lazy(() => import('@/pages/task/task-dialog'))
const Labels = lazy(() => import('@/pages/labels'))
const Teams = lazy(() => import('@/pages/teams'))
const Settings = lazy(() => import('@/pages/settings/settings'))
const Search = lazy(() => import('@/pages/search'))
const FilterNew = lazy(() => import('@/pages/filter-new'))
const NotFound = lazy(() => import('@/pages/not-found'))

function RequireAuth({children}: {children: ReactNode}) {
	const {authenticated, ready} = useAuth()
	const location = useLocation()
	if (!ready) return <PageSpinner />
	if (!authenticated) {
		const redirect = location.pathname + location.search
		return <Navigate to={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} replace />
	}
	return children
}

export type BackgroundState = {background?: Location}

export function App() {
	const location = useLocation()
	const background = (location.state as BackgroundState | null)?.background

	return (
		<Suspense fallback={<PageSpinner />}>
			<Routes location={background ?? location}>
				<Route path="/login" element={<Login />} />
				<Route path="/share/:share/auth" element={<LinkShareAuth />} />
				<Route
					element={
						<RequireAuth>
							<AppLayout />
						</RequireAuth>
					}
				>
					<Route index element={<Home />} />
					<Route path="tasks/upcoming" element={<Upcoming />} />
					<Route path="tasks/by/upcoming" element={<Navigate to="/tasks/upcoming" replace />} />
					<Route path="tasks/:taskId" element={<TaskPage />} />
					<Route path="projects" element={<Projects />} />
					<Route path="projects/:projectId" element={<ProjectPage />} />
					<Route path="projects/:projectId/settings/*" element={<ProjectSettings />} />
					<Route path="projects/:projectId/:viewId" element={<ProjectPage />} />
					<Route path="labels" element={<Labels />} />
					<Route path="teams/*" element={<Teams />} />
					<Route path="search" element={<Search />} />
					<Route path="filters/new" element={<FilterNew />} />
					<Route path="user/settings/*" element={<Navigate to="/settings" replace />} />
					<Route path="settings/*" element={<Settings />} />
					<Route path="*" element={<NotFound />} />
				</Route>
			</Routes>
			{background && (
				<Routes>
					<Route
						path="/tasks/:taskId"
						element={
							<RequireAuth>
								<TaskDialog />
							</RequireAuth>
						}
					/>
				</Routes>
			)}
		</Suspense>
	)
}
