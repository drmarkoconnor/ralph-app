import { parsePBN, sanitizePBN } from '../src/lib/pbn.js'
import pack2026 from '../public/competitions/usbf-2026-open-final-segment-1.pbn'
import pack2019 from '../public/competitions/usbf-2019-open-quarterfinal-segment-4.pbn'
import {
	parseTrump,
	partnerOf,
	rightOf,
} from '../src/lib/bridgeCore.js'
import {
	selectSimpleDefenderCard,
	stableDealToHands,
} from '../src/player-v2/bridgeV2.js'
import {
	analyseHumanComputerPlay,
	buildComputerKnowledge,
	computerCardKey,
	legalComputerCards,
	sampleToDdsDeal,
} from '../src/player-v2/humanComputerPlay.js'
import { solveBoardPosition } from '../src/lib/ddsWasm.js'

const packs = [pack2026, pack2019]
const suits = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

function scoreForCard(result, card) {
	const suitIndex = suits.indexOf(card.suit)
	const rankNumber = ranks.indexOf(card.rank) + 2
	for (let index = 0; index < result.cards; index++) {
		if (result.suit[index] !== suitIndex) continue
		if (result.rank[index] === rankNumber) return result.score[index]
		if ((Number(result.equals[index] || 0) & (1 << rankNumber)) !== 0) return result.score[index]
	}
	return null
}

async function competitionBoards() {
	const boards = []
	for (const pbn of packs) {
		const records = parsePBN(sanitizePBN(pbn))
		const seen = new Set()
		for (const record of records) {
			if (!record.deal || !record.contract || !record.declarer || seen.has(record.board)) continue
			seen.add(record.board)
			boards.push(record)
		}
	}
	return boards
}

let simpleLoss = 0
let humanLoss = 0
let evaluated = 0
const details = []

for (const board of await competitionBoards()) {
	const hands = stableDealToHands(board.deal)
	const declarer = board.declarer
	const dummy = partnerOf(declarer)
	const leader = rightOf(declarer)
	const trump = parseTrump(board.contract)
	const knowledge = buildComputerKnowledge({
		seat: leader,
		remaining: hands,
		history: [],
		trick: [],
		declarer,
		dummy,
		trump,
		vulnerability: board.vul,
		auctionDealer: board.auctionDealer || board.dealer,
		auctionCalls: board.auction || [],
		// Imported competition auctions are public but not assumed to be ACOL.
		auctionSources: (board.auction || []).map(() => 'imported'),
	})
	const legal = legalComputerCards(knowledge)
	if (legal.length < 2) continue
	const truth = await solveBoardPosition(sampleToDdsDeal(knowledge, hands))
	const best = Math.max(...legal.map((card) => scoreForCard(truth, card)).filter(Number.isFinite))
	const simple = selectSimpleDefenderCard(hands, [], leader, trump)
	const human = await analyseHumanComputerPlay(knowledge, solveBoardPosition)
	const simpleScore = scoreForCard(truth, simple)
	const humanScore = scoreForCard(truth, human.card)
	if (![best, simpleScore, humanScore].every(Number.isFinite)) continue
	const simpleBoardLoss = best - simpleScore
	const humanBoardLoss = best - humanScore
	simpleLoss += simpleBoardLoss
	humanLoss += humanBoardLoss
	evaluated += 1
	details.push({
		board: `${board.ext?.CompetitionPack || 'pack'}:${board.board}`,
		contract: `${board.contract} by ${declarer}`,
		simple: computerCardKey(simple),
		human: computerCardKey(human.card),
		simpleLoss: simpleBoardLoss,
		humanLoss: humanBoardLoss,
		samples: human.samples,
	})
}

const reduction = simpleLoss > 0 ? (simpleLoss - humanLoss) / simpleLoss : 0
console.table(details)
console.log(JSON.stringify({ evaluated, simpleLoss, humanLoss, reduction }, null, 2))
if (evaluated !== 30) throw new Error(`Expected 30 competition deals, evaluated ${evaluated}`)
if (reduction < 0.4) {
	throw new Error(`Avoidable opening-lead loss reduction ${(reduction * 100).toFixed(1)}% is below 40%`)
}
console.log(
	`PASS — the human-style engine did better: ${(reduction * 100).toFixed(1)}% fewer avoidable opening-lead trick losses (${humanLoss} rather than ${simpleLoss}) across ${evaluated} competition deals.`,
)
