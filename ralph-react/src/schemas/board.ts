import { z } from 'zod'

export const RankZ = z.enum([
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
])
export const SuitZ = z.enum(['S', 'H', 'D', 'C'])
export const SeatZ = z.enum(['N', 'E', 'S', 'W'])

export const HandZ = z.object({
	S: z.array(RankZ),
	H: z.array(RankZ),
	D: z.array(RankZ),
	C: z.array(RankZ),
})

export const ContractZ = z.object({
	level: z.number().min(1).max(7),
	strain: z.enum(['S', 'H', 'D', 'C', 'NT']),
	dbl: z.enum(['', 'X', 'XX']).default(''),
})

export const BoardZ = z.object({
	event: z.string().min(1),
	site: z.string().min(1),
	date: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
	board: z.number().int().positive(),
	dealer: SeatZ,
	vul: z.enum(['None', 'NS', 'EW', 'All']),
	dealPrefix: SeatZ,
	hands: z.record(SeatZ, HandZ),
	contract: ContractZ.optional(),
	declarer: SeatZ.optional(),
	auctionStart: SeatZ.optional(),
	auction: z
		.array(
			z.union([
				z.literal('Pass'),
				z.literal('P'), // allow short form
				z.literal('X'),
				z.literal('XX'),
				z.string().regex(/^[1-7](C|D|H|S|NT)$/),
			])
		)
		.optional(),
	notes: z.array(z.string()).max(10).optional(),
	ext: z
		.object({
			system: z.string().optional(),
			theme: z.string().optional(),
			interf: z.string().optional(),
			lead: z.string().optional(),
			ddpar: z.string().optional(),
			diagram: z.string().optional(),
			playscript: z.string().optional(),
			scoring: z.enum(['MPs', 'IMPs']).optional(),
			dealHash: z.string().optional(),
		})
		.default({}),
})

export type Rank = z.infer<typeof RankZ>
export type Suit = z.infer<typeof SuitZ>
export type Seat = z.infer<typeof SeatZ>
export type Hand = z.infer<typeof HandZ>
export type Contract = z.infer<typeof ContractZ>
export type Board = z.infer<typeof BoardZ>

