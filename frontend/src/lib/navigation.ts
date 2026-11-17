import {useCallback} from 'react'
import {useLocation, useNavigate} from 'react-router'
import type {BackgroundState} from '@/App'

/** Opens a task as a dialog over the current page; a reload lands on the full task page. */
export function useOpenTask() {
	const navigate = useNavigate()
	const location = useLocation()
	return useCallback(
		(id: number) => {
			const background = (location.state as BackgroundState | null)?.background ?? location
			navigate(`/tasks/${id}`, {state: {background}})
		},
		[navigate, location],
	)
}
