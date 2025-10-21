import type { Seat } from '../schemas/board'

export async function computeDealHashV1(
	ownerString52: string
): Promise<string> {
	if (ownerString52.length !== 52 || /[^NESW]/.test(ownerString52)) {
		throw new Error('ownerString52 must be 52 chars of N/E/S/W')
	}
	const enc = new TextEncoder().encode(ownerString52)
	const cryptoObj: Crypto | undefined = (globalThis as any).crypto
	if (cryptoObj?.subtle) {
		const buf = await cryptoObj.subtle.digest('SHA-256', enc)
		const hex = Array.from(new Uint8Array(buf))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('')
		return 'v1:sha256:' + hex
	}
	// Fallback: FNV-1a 32-bit for environments without Web Crypto (e.g., older/some mobile browsers).
	// This is only used to key a cache; cryptographic strength is not required.
	let hash = 0x811c9dc5 >>> 0
	for (let i = 0; i < enc.length; i++) {
		hash ^= enc[i]
		// hash *= 16777619 (use shifts to stay in 32-bit space)
		hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
	}
	const hex = (hash >>> 0).toString(16).padStart(8, '0')
	return 'v1:fnv1a32:' + hex
}

export const SUITS = ['S', 'H', 'D', 'C'] as const
export const RANKS = [
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'T',
	'J',
	'Q',
	'K',
	'A',
] as const

export function ownerStringFromHands(
	hands: Record<Seat, { S: string[]; H: string[]; D: string[]; C: string[] }>
): string {
	const has = (seat: Seat, suit: string, rank: string) => {
		const arr = (hands as any)[seat][suit] as string[]
		return arr.includes(rank)
	}
	const ownerFor = (suit: string, rank: string): Seat => {
		const seats: Seat[] = ['N', 'E', 'S', 'W']
		for (const s of seats) if (has(s, suit, rank)) return s
		throw new Error(`Missing owner for ${suit}${rank}`)
	}
	let out = ''
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			out += ownerFor(suit, rank as string)
		}
	}
	return out
}

