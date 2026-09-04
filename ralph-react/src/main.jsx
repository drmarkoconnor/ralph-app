import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Instructions from './pages/Instructions.jsx'
import Sources from './pages/Sources.jsx'
import Home from './pages/Home.jsx'
import PlayerV2 from './pages/PlayerV2.jsx'
import PlayerHelp from './pages/PlayerHelp.jsx'
import GeneratorV2 from './pages/GeneratorV2.jsx'
import HomeConcepts from './pages/HomeConcepts.jsx'
import PlayerDisplayBoundary from './components/PlayerDisplayBoundary.jsx'

const COACH_AUTH_HASH_PATTERN =
	/^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/

if (
	COACH_AUTH_HASH_PATTERN.test(window.location.hash) &&
	!['/player', '/player-v2'].includes(window.location.pathname)
) {
	window.history.replaceState(
		window.history.state,
		'',
		`/player${window.location.search}${window.location.hash}`,
	)
}

const router = createBrowserRouter([
	{ path: '/', element: <Home /> },
	{ path: '/home-concepts', element: <HomeConcepts /> },
	{ path: '/home-concepts/:id', element: <HomeConcepts /> },
	{ path: '/generator-v2', element: <GeneratorV2 /> },
	{ path: '/generator2', element: <GeneratorV2 /> },
	{ path: '/picker', element: <GeneratorV2 /> },
	{
		path: '/player',
		element: (
			<PlayerDisplayBoundary>
				<PlayerV2 />
			</PlayerDisplayBoundary>
		),
	},
	{
		path: '/player-v2',
		element: (
			<PlayerDisplayBoundary>
				<PlayerV2 />
			</PlayerDisplayBoundary>
		),
	},
	{ path: '/player/help', element: <PlayerHelp /> },
	{ path: '/instructions', element: <Instructions /> },
	{ path: '/sources', element: <Sources /> },
])

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>
)
