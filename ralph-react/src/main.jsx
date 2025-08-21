import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Instructions from './pages/Instructions.jsx'
import Sources from './pages/Sources.jsx'

const router = createBrowserRouter([
	{ path: '/', element: <App /> },
	{ path: '/instructions', element: <Instructions /> },
	{ path: '/sources', element: <Sources /> },
])

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>
)

