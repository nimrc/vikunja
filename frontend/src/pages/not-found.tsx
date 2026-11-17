import {Link} from 'react-router'
import {Button} from '@/components/ui/button'
import {Empty, EmptyDescription, EmptyHeader, EmptyTitle} from '@/components/ui/empty'

export default function NotFound() {
	return (
		<Empty className="m-6">
			<EmptyHeader>
				<EmptyTitle className="text-4xl font-semibold tracking-tight">404</EmptyTitle>
				<EmptyDescription>This page doesn't exist.</EmptyDescription>
			</EmptyHeader>
			<Button render={<Link to="/" />}>Back to overview</Button>
		</Empty>
	)
}
