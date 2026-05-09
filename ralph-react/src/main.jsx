import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Instructions from './pages/Instructions.jsx'
import Sources from './pages/Sources.jsx'
import Home from './pages/Home.jsx'
import PlayerClassic from './pages/Player.jsx'
import PlayerV2 from './pages/PlayerV2.jsx'
import PlayerHelp from './pages/PlayerHelp.jsx'

const router = createBrowserRouter([
	{ path: '/', element: <Home /> },
	{ path: '/picker', element: <App /> },
	{ path: '/player', element: <PlayerV2 /> },
	{ path: '/player-v2', element: <PlayerV2 /> },
	{ path: '/player-classic', element: <PlayerClassic /> },
	{ path: '/player/help', element: <PlayerHelp /> },
	{ path: '/instructions', element: <Instructions /> },
	{ path: '/sources', element: <Sources /> },
])

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>
)
