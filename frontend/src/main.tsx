import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClientProvider} from '@tanstack/react-query'
import {ThemeProvider} from '@/lib/theme'
import {BrowserRouter} from 'react-router'
import '@/lib/api'
import './index.css'
import {App} from '@/App'
import {Toaster} from '@/components/ui/sonner'
import {TooltipProvider} from '@/components/ui/tooltip'
import {AuthProvider} from '@/lib/auth'
import {queryClient} from '@/lib/queries'

createRoot(document.getElementById('app')!).render(
	<StrictMode>
		<ThemeProvider>
			<QueryClientProvider client={queryClient}>
				<AuthProvider>
					<BrowserRouter>
						<TooltipProvider delayDuration={300}>
							<App />
						</TooltipProvider>
					</BrowserRouter>
				</AuthProvider>
				<Toaster richColors position="bottom-right" />
			</QueryClientProvider>
		</ThemeProvider>
	</StrictMode>,
)
