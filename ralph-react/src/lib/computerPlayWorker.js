import DdsWorker from '../workers/ddsWorker?worker&inline'
import { selectHumanFallbackCard } from '../player-v2/humanComputerPlay.js'

let worker = null
let sequence = 1
const pending = new Map()
const cache = new Map()

function getWorker() {
	if (worker) return worker
	try {
		worker = new DdsWorker()
	} catch {
		return null
	}
	worker.onmessage = (event) => {
		const { id, ok, decision, error } = event.data || {}
		const resolve = pending.get(id)
		if (!resolve) return
		pending.delete(id)
		resolve(ok ? decision : { error: error || 'worker_error' })
	}
	worker.onerror = () => {
		for (const resolve of pending.values()) resolve({ error: 'worker_error' })
		pending.clear()
		worker?.terminate()
		worker = null
	}
	return worker
}

export async function requestComputerPlayDecision(knowledge, { timeoutMs = 3000 } = {}) {
	const cached = cache.get(knowledge.fingerprint)
	if (cached) return { ...cached, fromCache: true }
	const fallback = (reason) => ({
		engine: 'fallback',
		card: selectHumanFallbackCard(knowledge),
		samples: 0,
		reason,
		solverFailed: true,
	})
	const activeWorker = getWorker()
	if (!activeWorker) return fallback('worker_unavailable')
	const id = sequence++
	const response = new Promise((resolve) => pending.set(id, resolve))
	try {
		activeWorker.postMessage({ id, action: 'play-decision', knowledge })
	} catch {
		pending.delete(id)
		return fallback('post_message_failed')
	}
	const result = await Promise.race([
		response,
		new Promise((resolve) => setTimeout(() => resolve({ error: 'timeout' }), timeoutMs)),
	])
	if (result?.error) {
		pending.delete(id)
		return fallback(result.error)
	}
	if (result.engine !== 'fallback') cache.set(knowledge.fingerprint, result)
	return result
}

export function clearComputerPlayCache() {
	cache.clear()
	if (worker) worker.postMessage({ action: 'clear-play-cache' })
}
