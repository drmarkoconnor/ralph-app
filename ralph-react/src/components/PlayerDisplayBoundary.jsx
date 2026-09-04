import { Component } from 'react'

const LAST_PLAYER_ERROR_KEY = 'ralph-player-last-display-error-v1'

export default class PlayerDisplayBoundary extends Component {
	state = { failed: false }

	reloadPlayer = async () => {
		try {
			if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
				await document.exitFullscreen()
			}
		} catch {
			// Reload even if the browser will not release fullscreen programmatically.
		} finally {
			window.location.reload()
		}
	}

	static getDerivedStateFromError() {
		return { failed: true }
	}

	componentDidCatch(error, details) {
		console.error('Bridge Player display error', error, details)
		try {
			window.sessionStorage.setItem(
				LAST_PLAYER_ERROR_KEY,
				JSON.stringify({
					at: new Date().toISOString(),
					message: String(error?.message || error || 'Unknown display error').slice(0, 500),
					componentStack: String(details?.componentStack || '').slice(0, 2000),
				}),
			)
		} catch {
			// The visible recovery screen remains available if storage is blocked.
		}
	}

	render() {
		if (!this.state.failed) return this.props.children

		return (
			<main className="flex min-h-screen items-center justify-center bg-emerald-950 p-8 text-white">
				<section
					role="alert"
					className="max-w-xl rounded-3xl border-4 border-amber-300 bg-slate-950 p-8 text-center shadow-2xl">
					<p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">
						Display protection
					</p>
					<h1 className="mt-3 text-3xl font-black">The bridge table stopped drawing</h1>
					<p className="mt-4 text-lg text-slate-200">
						Reload the Player to restore the table. Your original PBN file has not been changed.
					</p>
					<button
						type="button"
						onClick={this.reloadPlayer}
						className="mt-6 min-h-12 rounded-xl bg-amber-300 px-6 py-3 text-lg font-black text-slate-950">
						Restore and reload Player
					</button>
				</section>
			</main>
		)
	}
}
