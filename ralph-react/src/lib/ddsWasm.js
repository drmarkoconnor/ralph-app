// Lightweight facade for a future DDS WASM integration.
// For now, provides a synchronous stub that returns null so PDF can skip gracefully.
// Later, replace with actual WASM loader and DDTable computation.

// Expected API: getDDTable(dealObj) => {
//   S: { N: number, E: number, S: number, W: number },
//   H: { N: number, E: number, S: number, W: number },
//   D: { N: number, E: number, S: number, W: number },
//   C: { N: number, E: number, S: number, W: number },
//   NT: { N: number, E: number, S: number, W: number }
// } | null

// We rely on the bridge-dds WASM wrapper. It exposes loadDds() -> module and a Dds class.
// We'll lazily load it on first call to avoid impacting initial app load.
let _ddsModulePromise = null
let _ddsInstance = null

async function ensureDds() {
	if (_ddsInstance) return _ddsInstance
	if (!_ddsModulePromise) {
		// Dynamic import so this code only loads when needed
		const ddsLib = await import('bridge-dds')
		_ddsModulePromise = ddsLib.loadDds()
		const mod = await _ddsModulePromise
		_ddsInstance = new ddsLib.Dds(mod)
	}
	return _ddsInstance
}

// Convert our deal object to PBN remainCards string for CalcDDTablePBN
function toDdTableDealPbn(deal) {
	// remainCards PBN format expects like: "N:SPADES.HEARTS.DIAMONDS.CLUBS E:... S:... W:..."
	const suitOrder = ['S', 'H', 'D', 'C']
	const ranksMap = { 10: 'T' }
	const segFor = (seat) => {
		const hand = deal?.hands?.[seat] || []
		const bySuit = { S: [], H: [], D: [], C: [] }
		hand.forEach((c) => {
			const k = c.suit && c.suit[0] ? c.suit[0].toUpperCase() : null
			if (!k || !bySuit[k]) return
			const r = String(c.rank).toUpperCase()
			bySuit[k].push(ranksMap[r] || r)
		})
		const segs = suitOrder.map((s) =>
			bySuit[s].length ? bySuit[s].join('') : '-'
		)
		return segs.join('.')
	}
	const start = deal.dealer || 'N'
	const order = ['N', 'E', 'S', 'W']
	const startIdx = order.indexOf(start)
	const rotated = [
		order[startIdx],
		order[(startIdx + 1) % 4],
		order[(startIdx + 2) % 4],
		order[(startIdx + 3) % 4],
	]
	// However, for ddTable we only need a cards string like DealPBN.remainCards with start seat and four segments
	const pbn = `${rotated[0]}:${segFor(rotated[0])} ${segFor(
		rotated[1]
	)} ${segFor(rotated[2])} ${segFor(rotated[3])}`
	return { cards: pbn }
}

// Public: compute makeable table as object keyed by strain -> seat -> tricks
export async function getDDTable(deal) {
	try {
		const dds = await ensureDds()
		const ddDeal = toDdTableDealPbn(deal)
		const results = dds.CalcDDTablePBN(ddDeal)
		// results.resTable is [strainIndex][seatIndex] with seat order [N,E,S,W] and strain 0..4 = S,H,D,C,NT
		const strains = ['S', 'H', 'D', 'C', 'NT']
		const seats = ['N', 'E', 'S', 'W']
		const table = {}
		for (let si = 0; si < strains.length; si++) {
			const row = results.resTable[si] || []
			const st = strains[si]
			table[st] = {}
			for (let hi = 0; hi < seats.length; hi++) {
				table[st][seats[hi]] = row[hi] ?? ''
			}
		}
		return table
	} catch (e) {
		console.warn('[DDS] getDDTable failed', e)
		return null
	}
}

