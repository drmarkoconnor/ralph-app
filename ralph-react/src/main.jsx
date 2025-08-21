import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Instructions from './pages/Instructions.jsx'
import Sources from './pages/Sources.jsx'
import Home from './pages/Home.jsx'
import Player from './pages/Player.jsx'

const router = createBrowserRouter([
	{ path: '/', element: <Home /> },
	{ path: '/picker', element: <App /> },
	{ path: '/player', element: <Player /> },
	{ path: '/instructions', element: <Instructions /> },
	{ path: '/sources', element: <Sources /> },
])

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>
)

