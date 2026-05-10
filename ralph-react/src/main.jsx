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

const router = createBrowserRouter([
	{ path: '/', element: <Home /> },
	{ path: '/home-concepts', element: <HomeConcepts /> },
	{ path: '/home-concepts/:id', element: <HomeConcepts /> },
	{ path: '/generator-v2', element: <GeneratorV2 /> },
	{ path: '/generator2', element: <GeneratorV2 /> },
	{ path: '/picker', element: <GeneratorV2 /> },
	{ path: '/player', element: <PlayerV2 /> },
	{ path: '/player-v2', element: <PlayerV2 /> },
	{ path: '/player/help', element: <PlayerHelp /> },
	{ path: '/instructions', element: <Instructions /> },
	{ path: '/sources', element: <Sources /> },
])

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>
)
