import assert from 'node:assert/strict'
import test from 'node:test'

import { parsePBN, sanitizePBN } from './pbn.js'

const DEAL_ONE =
	'N:AKQJ.T98.765.432 T987.765.432.AKQ 6543.AKQ.JT9.765 2.J432.AKQ8.JT98'
const DEAL_TWO =
	'E:A987.KQJ.T98.765 KQJ6.A98.765.432 T543.765.432.AKQ 2.T432.AKQJ.JT98'

test('blank lines and removed comments do not split one PBN board', () => {
	const source = `% PBN 2.1
[Event "Teaching final"]
[Board "1"]
[Dealer "N"]
[Vulnerable "None"]
[Deal "${DEAL_ONE}"]

{A multi-line teaching comment
that leaves whitespace after sanitation.}

[Room "Open"]
[Contract "1NT"]
[Declarer "N"]
`

	const deals = parsePBN(sanitizePBN(source))

	assert.equal(deals.length, 1)
	assert.equal(deals[0].board, '1')
	assert.equal(deals[0].deal, DEAL_ONE)
	assert.equal(deals[0].contract, '1NT')
	assert.equal(deals[0].declarer, 'N')
	assert.equal(deals[0].ext.Event, 'Teaching final')
	assert.equal(deals[0].ext.Room, 'Open')
})

test('Play starts a new section instead of being consumed as auction text', () => {
	const source = `[Board "7"]
[Dealer "S"]
[Vulnerable "NS"]
[Deal "${DEAL_ONE}"]
[Auction "S"]
1NT Pass

{The auction continues after this comment.}
Pass Pass

[Play "W"]
SA S2 S3 S4

{The play section also continues after a comment.}
HK H2 H3 H4
`

	const [deal] = parsePBN(sanitizePBN(source))

	assert.deepEqual(deal.auction, ['1NT', 'P', 'P', 'P'])
	assert.equal(deal.auctionDealer, 'S')
	assert.deepEqual(deal.play, ['SA S2 S3 S4', 'HK H2 H3 H4'])
	assert.equal(deal.playLeader, 'W')
})

test('new Event and Board tags delimit consecutive PBN records', () => {
	const source = `[Event "Final"]
[Board "1"]
[Dealer "N"]
[Vulnerable "None"]
[Deal "${DEAL_ONE}"]
[Auction "N"]
Pass Pass Pass Pass
[Play "E"]
C2 C3 C4 C5

[Event "Final"]
[Board "2"]
[Dealer "E"]
[Vulnerable "EW"]
[Deal "${DEAL_TWO}"]
[Auction "E"]
1C Pass Pass Pass
[Play "S"]
D2 D3 D4 D5
`

	const deals = parsePBN(source)

	assert.equal(deals.length, 2)
	assert.deepEqual(
		deals.map((deal) => deal.board),
		['1', '2'],
	)
	assert.deepEqual(deals[0].auction, ['P', 'P', 'P', 'P'])
	assert.deepEqual(deals[0].play, ['C2 C3 C4 C5'])
	assert.deepEqual(deals[1].auction, ['1C', 'P', 'P', 'P'])
	assert.deepEqual(deals[1].play, ['D2 D3 D4 D5'])
})

test('a repeated Board tag also delimits records when Event tags are omitted', () => {
	const source = `[Board "1"]
[Dealer "N"]
[Deal "${DEAL_ONE}"]

[Board "2"]
[Dealer "E"]
[Deal "${DEAL_TWO}"]
`

	const deals = parsePBN(source)

	assert.equal(deals.length, 2)
	assert.equal(deals[0].deal, DEAL_ONE)
	assert.equal(deals[1].deal, DEAL_TWO)
})
