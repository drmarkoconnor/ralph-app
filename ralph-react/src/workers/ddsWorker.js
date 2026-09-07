import { getDDTable, solveBoardPosition } from '../lib/ddsWasm.js'
import { analyseHumanComputerPlay } from '../player-v2/humanComputerPlay.js'

const playCache = new Map()

// Worker: computes makeable contracts via DDS
self.onmessage = async (ev) => {
	const { id, action, deal } = ev.data || {}
	if (action === 'clear-play-cache') {
		playCache.clear()
		return
	}
	if (action === 'play-decision') {
		const knowledge = ev.data?.knowledge
		if (!knowledge?.fingerprint) {
			self.postMessage({ id, ok: false, error: 'bad_play_request' })
			return
		}
		try {
			const cached = playCache.get(knowledge.fingerprint)
			const decision = cached || await analyseHumanComputerPlay(
				knowledge,
				(dealPbn) => solveBoardPosition(dealPbn),
			)
			if (!cached && decision.engine !== 'fallback') {
				playCache.set(knowledge.fingerprint, decision)
			}
			self.postMessage({ id, ok: true, decision: { ...decision, fromCache: !!cached } })
		} catch (error) {
			self.postMessage({ id, ok: false, error: String(error?.message || error) })
		}
		return
	}
	if (action !== 'compute' || !deal) {
		self.postMessage({ id, ok: false, error: 'bad_request' })
		return
	}
	try {
		const table = await getDDTable(deal)
		if (!table) {
			self.postMessage({ id, ok: false, error: 'unavailable' })
			return
		}
		self.postMessage({ id, ok: true, table })
	} catch (e) {
		self.postMessage({ id, ok: false, error: String((e && e.message) || e) })
	}
}
