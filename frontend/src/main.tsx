import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClientProvider} from '@tanstack/react-query'
import {ThemeProvider} from '@/lib/theme'
import {BrowserRouter} from 'react-router'
import '@/lib/api'
import './index.css'
import {App} from '@/App'
import {Toaster} from '@/components/ui/sonner'
import {Hardware} from '@/components/ui/hardware'
import {AuthProvider} from '@/lib/auth'
import {queryClient} from '@/lib/queries'

createRoot(document.getElementById('app')!).render(
	<StrictMode>
		<Hardware>
		<ThemeProvider>
			<QueryClientProvider client={queryClient}>
				<AuthProvider>
					<BrowserRouter>
						<App />
					</BrowserRouter>
				</AuthProvider>
				<Toaster richColors position="bottom-right" />
			</QueryClientProvider>
		</ThemeProvider>
		</Hardware>
	</StrictMode>,
)
