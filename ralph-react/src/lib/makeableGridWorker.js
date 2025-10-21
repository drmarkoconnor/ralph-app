import { settings } from './settings'
import { ownerStringFromHands, computeDealHashV1 } from '../pbn/hash'
import DdsWorker from '../workers/ddsWorker?worker&inline'

// Orchestrator for a dedicated DDS worker (inline to avoid format issues)
let _worker = null
let _seq = 1
const _pending = new Map()

function getWorker() {
	if (_worker) return _worker
	try {
		_worker = new DdsWorker()
	} catch (e) {
		_worker = null
		return null
	}
	_worker.onmessage = (ev) => {
		const { id, ok, table, error } = ev.data || {}
		const resolver = _pending.get(id)
		if (resolver) {
			_pending.delete(id)
			resolver(ok ? { ok: true, table } : { ok: false, error })
		}
	}
	_worker.onerror = (e) => {
		// Fail all pending requests on worker error
		for (const [id, resolver] of _pending.entries()) {
			resolver({ ok: false, error: 'worker_error' })
			_pending.delete(id)
		}
	}
	return _worker
}

const cache = new Map() // key -> { table, computed_at, engine_version }

export async function computeDealKeyFromEditor(current, dealer, vul) {
	// current: { buckets: { N: Card[], E:..., S:..., W:... } }
	const toRanks = (arr, suit) =>
		arr
			.filter((c) => c.suit === suit)
			.map((c) => (c.rank === '10' ? 'T' : String(c.rank).toUpperCase()))
	const hands = {
		N: {
			S: toRanks(current.buckets.N, 'Spades'),
			H: toRanks(current.buckets.N, 'Hearts'),
			D: toRanks(current.buckets.N, 'Diamonds'),
			C: toRanks(current.buckets.N, 'Clubs'),
		},
		E: {
			S: toRanks(current.buckets.E, 'Spades'),
			H: toRanks(current.buckets.E, 'Hearts'),
			D: toRanks(current.buckets.E, 'Diamonds'),
			C: toRanks(current.buckets.E, 'Clubs'),
		},
		S: {
			S: toRanks(current.buckets.S, 'Spades'),
			H: toRanks(current.buckets.S, 'Hearts'),
			D: toRanks(current.buckets.S, 'Diamonds'),
			C: toRanks(current.buckets.S, 'Clubs'),
		},
		W: {
			S: toRanks(current.buckets.W, 'Spades'),
			H: toRanks(current.buckets.W, 'Hearts'),
			D: toRanks(current.buckets.W, 'Diamonds'),
			C: toRanks(current.buckets.W, 'Clubs'),
		},
	}
	const owner52 = ownerStringFromHands(hands)
	// Hash only the canonical 52-char owner string, then incorporate dealer/vul in the final key
	const ownerHash = await computeDealHashV1(owner52)
	const key = `${ownerHash}|${dealer}|${vul || 'None'}`
	return { hash: key, hands }
}

export async function computeMakeableGrid(deal, dealKey) {
	// deal: { dealer, hands: { N: Card[], ... } }
	const key = dealKey
	if (cache.has(key)) {
		return { deal_key: key, table: cache.get(key), fromCache: true }
	}
	const w = getWorker()
	const id = _seq++
	const timeoutMs = 10000
	const p = new Promise((resolve) => {
		_pending.set(id, (res) => {
			if (res.ok) {
				const snap = {
					table: res.table,
					computed_at: new Date().toISOString(),
					engine_version: settings.engineVersion,
				}
				cache.set(key, snap)
				resolve({ deal_key: key, table: snap, fromCache: false })
			} else {
				resolve({ deal_key: key, error: res.error || 'unknown' })
			}
		})
	})
	if (w) {
		try {
			w.postMessage({ id, action: 'compute', deal })
		} catch (e) {
			_pending.delete(id)
			return { deal_key: key, error: 'post_message_failed' }
		}
	} else {
		// Fallback: compute on main thread if worker unavailable
		try {
			const dds = await import('../lib/ddsWasm.js')
			const table = await dds.getDDTable(deal)
			if (!table) return { deal_key: key, error: 'unavailable' }
			const snap = {
				table,
				computed_at: new Date().toISOString(),
				engine_version: settings.engineVersion,
			}
			cache.set(key, snap)
			return { deal_key: key, table: snap, fromCache: false }
		} catch (e) {
			return { deal_key: key, error: 'fallback_failed' }
		}
	}
	let result = await Promise.race([
		p,
		new Promise((resolve) =>
			setTimeout(() => resolve({ deal_key: key, error: 'timeout' }), timeoutMs)
		),
	])
	// If timeout fired, clear pending to avoid leak
	if (result && result.error === 'timeout') {
		_pending.delete(id)
	}
	// If worker failed or timed out, attempt a main-thread fallback once
	if (result && result.error) {
		try {
			const dds = await import('../lib/ddsWasm.js')
			const table = await dds.getDDTable(deal)
			if (table) {
				const snap = {
					table,
					computed_at: new Date().toISOString(),
					engine_version: settings.engineVersion,
				}
				cache.set(key, snap)
				return { deal_key: key, table: snap, fromCache: false }
			}
		} catch {
			// ignore, will fall through to error return
		}
	}
	return result
}

export function getCachedGrid(key) {
	return cache.get(key)
}

