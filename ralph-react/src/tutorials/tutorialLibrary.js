const SEATS = ['N', 'E', 'S', 'W']
const SUITS = ['S', 'H', 'D', 'C']
const RANKS = 'AKQJT98765432'.split('')
const HCP = { A: 4, K: 3, Q: 2, J: 1 }

const card = (suit, rank) => `${suit}${rank}`

function makeRng(seedText) {
	let seed = 2166136261
	for (const character of seedText) {
		seed ^= character.charCodeAt(0)
		seed = Math.imul(seed, 16777619)
	}
	return () => {
		seed += 0x6d2b79f5
		let value = seed
		value = Math.imul(value ^ (value >>> 15), value | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296
	}
}

function shuffled(values, seed) {
	const result = [...values]
	const random = makeRng(seed)
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1))
		;[result[index], result[swap]] = [result[swap], result[index]]
	}
	return result
}

function handHcp(keys) {
	return keys.reduce((total, key) => total + (HCP[key.slice(1)] || 0), 0)
}

function suitLength(keys, suit) {
	return keys.filter((key) => key[0] === suit).length
}

function matchesConstraint(keys, constraint = {}) {
	const points = handHcp(keys)
	if (constraint.hcp && (points < constraint.hcp[0] || points > constraint.hcp[1])) return false
	for (const [suit, range] of Object.entries(constraint.lengths || {})) {
		const length = suitLength(keys, suit)
		if (length < range[0] || length > range[1]) return false
	}
	if (constraint.balanced) {
		const lengths = SUITS.map((suit) => suitLength(keys, suit)).sort((a, b) => b - a)
		if (!['4,3,3,3', '4,4,3,2', '5,3,3,2'].includes(lengths.join(','))) return false
	}
	return true
}

function generateHands(definition) {
	const deck = SUITS.flatMap((suit) => RANKS.map((rank) => card(suit, rank)))
	const fixed = Object.fromEntries(SEATS.map((seat) => [
		seat,
		[...(definition.fixed?.[seat] || [])].map((key) => `${key[0]}${key.slice(1) === '10' ? 'T' : key.slice(1)}`),
	]))
	const fixedCards = Object.values(fixed).flat()
	if (new Set(fixedCards).size !== fixedCards.length) {
		throw new Error(`Duplicate fixed card in tutorial ${definition.id}`)
	}
	const available = deck.filter((key) => !fixedCards.includes(key))
	for (let attempt = 0; attempt < 12000; attempt += 1) {
		const remaining = shuffled(available, `${definition.id}:${attempt}`)
		const hands = Object.fromEntries(SEATS.map((seat) => [seat, [...fixed[seat]]]))
		for (const seat of SEATS) {
			while (hands[seat].length < 13) hands[seat].push(remaining.pop())
		}
		if (SEATS.every((seat) => matchesConstraint(hands[seat], definition.constraints?.[seat]))) {
			return hands
		}
	}
	throw new Error(`Could not construct tutorial deal ${definition.id}`)
}

function pbnHand(keys) {
	return SUITS.map((suit) =>
		RANKS.filter((rank) => keys.includes(card(suit, rank))).join('') || '-',
	).join('.')
}

function cardPlay(definition) {
	const strain = definition.strain || 'NT'
	const level = definition.level || (strain === 'NT' ? 3 : 4)
	const lead = definition.lead || 'C2'
	const auction = definition.auction ||
		(strain === 'NT'
			? ['1NT', 'P', `${level}NT`, 'P', 'P', 'P']
			: [`1${strain}`, 'P', `${level}${strain}`, 'P', 'P', 'P'])
	return {
		kind: 'play',
		dealer: 'S',
		vul: 'None',
		startMode: 'play',
		promptAt: 1,
		auction,
		lead,
		decisionTiming: 'plan-ahead',
		decisionCue: `First deal with the ${lead.slice(1) === 'T' ? '10' : lead.slice(1)}${{ S: '♠', H: '♥', D: '♦', C: '♣' }[lead[0]]} opening lead. The cyan cards show the holding to plan for after this trick, not cards you may play instead of following suit.`,
		...definition,
	}
}

function defence(definition) {
	return {
		kind: 'defence',
		dealer: 'E',
		vul: 'None',
		startMode: 'play',
		promptAt: 0,
		auction: ['1NT', 'P', '3NT', 'P', 'P', 'P'],
		...definition,
	}
}

function bidding(definition) {
	return {
		kind: 'bidding',
		category: 'ACOL bidding',
		startMode: 'auction',
		vul: 'None',
		...definition,
	}
}

const PLAY_LESSONS = [
	cardPlay({ id: 'count-winners', levelName: 'Beginner', category: 'Planning', title: 'Count winners before touching a card', trigger: 'A no-trump contract and dummy has just appeared.', prompt: 'What is the first job before choosing a card?', choices: ['Count certain winners in all four suits', 'Cash the longest suit immediately', 'Guess which opponent has each queen'], correctChoice: 0, explanation: 'Count top tricks suit by suit, then identify the suit that can supply the missing tricks. This prevents a tempting cash from destroying an entry.', principle: 'Plan first: target tricks minus certain winners equals the number you must develop.', fixed: { N: ['SA', 'SK', 'H4', 'D7', 'C6'], S: ['SQ', 'H6', 'DA', 'DK', 'C8'], W: ['C2'] }, focusCards: ['SA', 'SK', 'SQ', 'DA', 'DK'] }),
	cardPlay({ id: 'count-losers', levelName: 'Beginner', category: 'Planning', title: 'Count losers in a suit contract', strain: 'H', trigger: 'You are declarer in a trump contract.', prompt: 'Which viewpoint gives the clearest plan?', choices: ['Count losers from the long-trump hand', 'Count only aces and kings', 'Draw trumps without counting anything'], correctChoice: 0, explanation: 'Use the hand with the long trumps as the master hand. Count its unavoidable losers, then ask whether dummy can ruff or discard any of them.', principle: 'In suit contracts, losers—not raw points—usually reveal the plan.', fixed: { N: ['H8', 'H5', 'H2', 'CA', 'CK'], S: ['HA', 'HK', 'HQ', 'HJ', 'H7', 'S4', 'D6'], W: ['C2'] }, focusCards: ['S4', 'D6', 'CA', 'CK'] }),
	cardPlay({ id: 'promote-honours', levelName: 'Beginner', category: 'Establishing tricks', title: 'Promote touching honours', trigger: 'You hold several touching honours but lack the ace.', prompt: 'How do K-Q-J become tricks?', choices: ['Lead an honour and force out the ace', 'Wait until the opponents lead the suit three times', 'Ruff a card in the same hand'], correctChoice: 0, explanation: 'A high card is an investment: once the ace is driven out, the remaining touching honours are promoted. Preserve an entry to reach them later.', principle: 'Give up one trick now to establish several later.', fixed: { N: ['CK', 'CQ', 'CJ', 'C5'], S: ['C8', 'C4', 'C3'], W: ['C2', 'CA'] }, focusCards: ['CK', 'CQ', 'CJ', 'CA'] }),
	cardPlay({ id: 'establish-length', levelName: 'Beginner', category: 'Establishing tricks', title: 'Establish a long suit', trigger: 'One combined suit has eight or nine cards but few top honours.', prompt: 'What makes the small cards valuable later?', choices: ['Play the suit until opponents run out', 'Keep every small card as an entry', 'Always cash side-suit aces first'], correctChoice: 0, explanation: 'Once both opponents exhaust the suit, your remaining small cards are winners. Count the missing cards and protect the entry to the long hand.', principle: 'Length becomes strength after the missing cards are removed.', fixed: { N: ['D9', 'D8', 'D7', 'D6', 'D5'], S: ['DA', 'D4', 'D3', 'D2'], W: ['C2'] }, focusCards: ['DA', 'D9', 'D8', 'D7', 'D6', 'D5'] }),
	cardPlay({ id: 'preserve-entry', levelName: 'Intermediate', category: 'Entries', title: 'Preserve the entry to the long suit', trigger: 'Dummy has a suit that can be established but very few outside winners.', prompt: 'What must you check before developing dummy’s suit?', choices: ['How you will get back after it is established', 'Whether trumps split exactly 2–2', 'Whether to claim immediately'], correctChoice: 0, explanation: 'A long suit is useless when stranded. Keep a high card or carefully timed small-card entry so the established winners can be cashed.', principle: 'Developing tricks and reaching them are two parts of the same plan.', fixed: { N: ['CA', 'D9', 'D8', 'D7', 'D6', 'D5'], S: ['CK', 'C3', 'DA', 'D4'], W: ['C2'] }, focusCards: ['CA', 'D9', 'D8', 'D7', 'D6', 'D5', 'C3'] }),
	cardPlay({ id: 'unblock-suit', levelName: 'Intermediate', category: 'Entries', title: 'Unblock the short hand', trigger: 'Dummy has ♦A K Q 5 4 opposite South’s much shorter ♦J 3, and West has led ♦2.', prompt: 'If dummy wins this trick with ♦A, which diamond should South play underneath it?', choices: ['♦J — unblock it now', '♦3 — save the jack for later', 'A card from another suit'], correctChoice: 0, explanation: 'Play South’s ♦J under dummy’s ♦A on this trick. Dummy still wins and remains on lead, but the blocking honour has gone. Dummy can later cash ♦K-Q and continue with ♦5-4 once the missing diamonds are exhausted. If South keeps ♦J, it can obstruct access to dummy’s small winners when entries are scarce.', principle: 'When the short hand has an honour below winners in the long hand, play that honour underneath a winner before it blocks the suit.', fixed: { N: ['DA', 'DK', 'DQ', 'D5', 'D4'], S: ['DJ', 'D3'], W: ['D2'] }, constraints: { N: { lengths: { D: [5, 5] } }, S: { lengths: { D: [2, 2] } } }, lead: 'D2', decisionTiming: 'this-trick', decisionCue: 'This lesson starts on the opening trick: play dummy’s ♦A, then release South’s ♦J underneath it.', highlightExplanation: 'The outline joins dummy’s complete five-card diamond suit to South’s complete two-card holding. The ♦J is the potential blockage; the ♦3 is the small card South keeps.', recommendedCard: 'DA', focusCards: ['DA', 'DK', 'DQ', 'D5', 'D4', 'DJ', 'D3'] }),
	cardPlay({ id: 'duck-for-entry', levelName: 'Intermediate', category: 'Timing', title: 'Duck a club to preserve communication', trigger: 'Dummy has six clubs, ♣A Q 9 8 7 6, opposite South’s three clubs, ♣K 3 2; West leads the ♣5.', prompt: 'What is dummy’s planning play at trick one?', choices: ['Play ♣6 and be willing to lose this club trick', 'Play ♣A immediately', 'Play a card from another suit'], correctChoice: 0, explanation: 'Play dummy’s ♣6. East wins with ♣J and South follows with ♣2 rather than spending the king. You have deliberately lost one club trick while removing two defender clubs, and South still has ♣3 as a route back to dummy’s long clubs. After regaining the lead, lead ♣3 so dummy can win and continue the established suit.', principle: 'Duck once when losing now removes an opponent’s card while preserving the short hand’s final small card as an entry to the long hand.', fixed: { N: ['CA', 'CQ', 'C9', 'C8', 'C7', 'C6'], E: ['CJ'], S: ['CK', 'C3', 'C2'], W: ['C5'] }, constraints: { N: { lengths: { C: [6, 6] } }, S: { lengths: { C: [3, 3] } } }, lead: 'C5', scriptedCards: { 2: { seat: 'E', card: 'CJ' } }, decisionTiming: 'this-trick', decisionCue: 'The opening lead is ♣5, so the outlined club holding is the suit you must handle now. Start by playing dummy’s ♣6.', highlightExplanation: 'The outline shows all nine clubs in the two visible hands: six in dummy and three in South. The key cards are dummy’s ♣6 and South’s ♣2-3, which let you lose once without cutting the route back to dummy.', recommendedCard: 'C6', focusCards: ['CA', 'CQ', 'C9', 'C8', 'C7', 'C6', 'CK', 'C3', 'C2'] }),
	cardPlay({ id: 'hold-up', levelName: 'Intermediate', category: 'Timing', title: 'Hold up the ace', trigger: 'A defender leads a long suit against no-trumps.', prompt: 'What question decides whether to take the ace now?', choices: ['Can I break communication between the defenders?', 'Is the ace worth four high-card points?', 'Did partner bid the suit?'], correctChoice: 0, explanation: 'If you duck until one defender is out of the suit, the dangerous hand may have no entry when it regains the lead. Count the suit and identify the danger hand.', principle: 'The hold-up attacks communication, not the suit itself.', fixed: { N: ['H5', 'H3'], S: ['HA', 'H7'], W: ['HK', 'HQ', 'HJ', 'H10', 'H2'] }, lead: 'H2', decisionTiming: 'this-trick', decisionCue: 'The opening lead is ♥2 and the hold-up decision begins on this trick. Compare the four visible hearts before committing the ace.', focusCards: ['HA', 'H7', 'H5', 'H3'] }),
	cardPlay({ id: 'simple-finesse', levelName: 'Beginner', category: 'Finesses', title: 'Recognise a simple finesse', trigger: 'One hand has A-Q and the king is missing.', prompt: 'How can the queen win without meeting the king?', choices: ['Lead from the opposite hand toward A-Q', 'Cash the ace and then lead the queen', 'Lead the queen from A-Q'], correctChoice: 0, explanation: 'Lead a small card toward the queen. If the next hand plays low, try the queen; it wins when the king is onside.', principle: 'A finesse places a missing honour with one particular opponent.', fixed: { N: ['HA', 'HQ', 'H4'], E: ['HK'], S: ['H7', 'H6', 'H3'], W: ['C2'] }, focusCards: ['HA', 'HQ', 'HK', 'H7'] }),
	cardPlay({ id: 'repeat-finesse', levelName: 'Intermediate', category: 'Finesses', title: 'Repeat a finesse', trigger: 'Dummy has A-Q-J and the king is missing.', prompt: 'What resource is needed to take the finesse more than once?', choices: ['Repeated entries to the opposite hand', 'A second trump suit', 'An immediate cash of the ace'], correctChoice: 0, explanation: 'Cross to the other hand and lead toward A-Q-J repeatedly. One finesse may establish only one extra trick; entries let you repeat the winning position.', principle: 'Count entries before committing to a repeated finesse.', fixed: { N: ['DA', 'DQ', 'DJ', 'D5'], E: ['DK'], S: ['D7', 'D4', 'D2', 'CA', 'CK'], W: ['C2'] }, focusCards: ['DA', 'DQ', 'DJ', 'DK', 'CA', 'CK'] }),
	cardPlay({ id: 'two-way-finesse', levelName: 'Advanced', category: 'Finesses', title: 'Choose the direction of a two-way finesse', trigger: 'The combined hands hold A-K-J but the queen is missing.', prompt: 'What should influence the direction?', choices: ['Auction, opening lead and entries', 'Always finesse through West', 'Always cash ace and king'], correctChoice: 0, explanation: 'Both directions may be technically possible. Use the auction, lead and any revealed length to place the missing queen, while preserving entries for the chosen route.', principle: 'A two-way finesse is an inference problem, not a coin toss.', fixed: { N: ['CA', 'C5', 'C2'], S: ['CK', 'CJ', 'C4'], E: ['CQ'], W: ['D2'] }, lead: 'D2', focusCards: ['CA', 'CK', 'CJ', 'CQ'] }),
	cardPlay({ id: 'double-finesse', levelName: 'Advanced', category: 'Finesses', title: 'Take a double finesse', trigger: 'A suit contains A-Q-10 opposite small cards, missing K-J.', prompt: 'What is the normal first play toward the tenace?', choices: ['Lead low and finesse the ten first', 'Cash the ace immediately', 'Lead the ace from the top'], correctChoice: 0, explanation: 'The first low lead toward the ten can gain when one honour is onside; a later lead can finesse again. The play aims for two tricks when the missing honours are split.', principle: 'With two missing honours, plan both rounds before taking the first finesse.', fixed: { N: ['SA', 'SQ', 'S10'], E: ['SK'], W: ['SJ', 'C2'], S: ['S5', 'S4', 'S3'] }, focusCards: ['SA', 'SQ', 'S10', 'SK', 'SJ'] }),
	cardPlay({ id: 'eight-ever-nine-never', levelName: 'Intermediate', category: 'Suit combinations', title: 'Eight ever, nine never—then check the evidence', trigger: 'You are missing the queen in a trump suit.', prompt: 'What is the useful starting rule?', choices: ['With eight cards finesse; with nine cash top honours', 'Always finesse', 'Always play for a 2–2 break'], correctChoice: 0, explanation: 'The rhyme is a probability starting point, not a command. With nine cards, cashing ace and king often wins; with eight, a finesse is often better. Auction and play can override it.', principle: 'Use percentages as a baseline, then update with evidence.', strain: 'H', fixed: { N: ['HA', 'HJ', 'H7', 'H2'], S: ['HK', 'H9', 'H8', 'H5', 'H3'], E: ['HQ'], W: ['C2'] }, focusCards: ['HA', 'HJ', 'HK', 'H9', 'HQ'] }),
	cardPlay({ id: 'restricted-choice', levelName: 'Advanced', category: 'Suit combinations', title: 'Apply restricted choice', trigger: 'An opponent drops one of two touching honours on the first round.', prompt: 'What does that card make more likely?', choices: ['It may have been a singleton, so finesse the other opponent next', 'The same opponent certainly has the other honour', 'The suit must be divided evenly'], correctChoice: 0, explanation: 'When an opponent could have played either of two equals but plays one, the chance that it was forced from a singleton increases. Combine that inference with the known count.', principle: 'Unexpected honour cards change the odds of the remaining layout.', fixed: { N: ['CA', 'C10', 'C9'], S: ['CK', 'CJ', 'C8', 'C7'], W: ['CQ', 'D2'], E: ['C6'] }, lead: 'D2', focusCards: ['CA', 'CK', 'CJ', 'CQ', 'C10'] }),
	cardPlay({ id: 'safety-play', levelName: 'Advanced', category: 'Suit combinations', title: 'Protect against the dangerous split', trigger: 'The contract needs a fixed number of tricks from a long suit—not every possible trick.', prompt: 'What should guide the suit play?', choices: ['Guard against the one distribution that defeats the contract', 'Maximise the chance of every overtrick', 'Cash all top cards quickly'], correctChoice: 0, explanation: 'A safety play sacrifices an overtrick chance to insure the contract against a bad break. Decide how many tricks you need before selecting the line.', principle: 'Match the line of play to the contract target, not the maximum reward.', fixed: { N: ['DA', 'D10', 'D9', 'D4'], S: ['DK', 'D7', 'D6', 'D5', 'D3'], E: ['DQ', 'DJ'], W: ['C2'] }, focusCards: ['DA', 'DK', 'D10', 'D9', 'DQ', 'DJ'] }),
	cardPlay({ id: 'draw-trumps', levelName: 'Beginner', category: 'Trump management', title: 'Draw trumps before cashing winners', strain: 'S', trigger: 'You have enough winners, but opponents still hold trumps.', prompt: 'Why draw trumps now?', choices: ['To stop defenders ruffing your side-suit winners', 'To give defenders extra entries', 'Because trumps must always be played at trick one'], correctChoice: 0, explanation: 'If no useful ruff is needed in dummy, remove enemy trumps before exposing side-suit winners to a ruff.', principle: 'Draw trumps when their main remaining purpose would be to hurt you.', fixed: { N: ['S8', 'S7', 'S3', 'HA', 'HK'], S: ['SA', 'SK', 'SQ', 'SJ', 'S9', 'DA', 'DK'], W: ['C2'] }, focusCards: ['SA', 'SK', 'SQ', 'SJ', 'S9', 'HA', 'HK'] }),
	cardPlay({ id: 'delay-trumps', levelName: 'Intermediate', category: 'Trump management', title: 'Delay drawing trumps for a ruff', strain: 'H', trigger: 'Dummy can ruff a loser from the long-trump hand.', prompt: 'What danger comes from drawing all trumps immediately?', choices: ['Dummy may lose the trump needed for the ruff', 'The contract changes to no-trumps', 'The defenders gain high-card points'], correctChoice: 0, explanation: 'Cash or concede the side suit and use a dummy trump before removing every defensive trump. Then return to drawing trumps.', principle: 'Do the necessary short-hand ruff before exhausting dummy’s trumps.', fixed: { N: ['H8', 'H5', 'H2', 'C4'], S: ['HA', 'HK', 'HQ', 'HJ', 'H9', 'CA', 'C7', 'C6'], W: ['C2'] }, focusCards: ['H8', 'H5', 'H2', 'C4', 'C7', 'C6'] }),
	cardPlay({ id: 'ruff-losers', levelName: 'Beginner', category: 'Trump management', title: 'Ruff losers in the short hand', strain: 'S', trigger: 'Dummy has fewer trumps and is short in one side suit.', prompt: 'Which ruff normally creates an extra trick?', choices: ['Ruff a declarer loser in the short-trump hand', 'Ruff in the long-trump hand', 'Ruff a card that was already a winner'], correctChoice: 0, explanation: 'Declarer’s long trumps are already counted as tricks. A ruff in the short hand adds a trick that did not otherwise exist.', principle: 'Use the short trump holding to dispose of long-hand losers.', fixed: { N: ['S8', 'S5', 'S2', 'D4'], S: ['SA', 'SK', 'SQ', 'SJ', 'S9', 'D9', 'D8', 'D7'], W: ['C2'] }, focusCards: ['S8', 'S5', 'S2', 'D4', 'D9', 'D8', 'D7'] }),
	cardPlay({ id: 'crossruff', levelName: 'Advanced', category: 'Trump management', title: 'Plan a crossruff', strain: 'H', trigger: 'Both hands are short in different side suits and hold useful trumps.', prompt: 'What should often be cashed before crossruffing?', choices: ['Outside winners that could later be ruffed', 'Every trump honour', 'Only the lowest side-suit cards'], correctChoice: 0, explanation: 'Cash vulnerable side-suit winners first, then alternate ruffs. High trumps may be needed late when defenders begin overruffing.', principle: 'A crossruff turns separate shortages into a sequence of trump tricks.', fixed: { N: ['HA', 'H8', 'H6', 'H3', 'S4', 'S3'], S: ['HK', 'HQ', 'H9', 'H5', 'D4', 'D3'], W: ['C2'] }, focusCards: ['HA', 'H8', 'H6', 'H3', 'HK', 'HQ', 'H9', 'H5'] }),
	cardPlay({ id: 'loser-on-loser', levelName: 'Advanced', category: 'Trump management', title: 'Use a loser-on-loser play', strain: 'S', trigger: 'Dummy has a winner on which declarer can discard a different loser.', prompt: 'Why discard a loser instead of ruffing?', choices: ['To preserve trump control or create a later ruff', 'To surrender two tricks at once', 'To change the opening lead'], correctChoice: 0, explanation: 'Throw one loser on a card that will lose anyway, often keeping dummy’s trump for a more valuable ruff or breaking defender communication.', principle: 'Not every losing card should be ruffed; compare what the trump can achieve later.', fixed: { N: ['S7', 'S4', 'HA', 'HQ'], S: ['SA', 'SK', 'SQ', 'SJ', 'S9', 'H3', 'D4'], W: ['C2'] }, focusCards: ['HA', 'HQ', 'H3', 'D4', 'S7', 'S4'] }),
	cardPlay({ id: 'ruffing-finesse', levelName: 'Advanced', category: 'Trump management', title: 'Recognise a ruffing finesse', strain: 'S', trigger: 'Dummy has A-Q in a side suit and declarer can ruff.', prompt: 'How does a ruffing finesse gain?', choices: ['Lead the queen and discard if the king covers; ruff if it does not', 'Cash the ace and concede the rest', 'Ruff the ace immediately'], correctChoice: 0, explanation: 'The queen forces the king or wins. If the defender ducks, discard a loser; if the king covers, take the ace and later ruff toward the established card.', principle: 'A ruffing finesse combines an honour position with the power to ruff.', fixed: { N: ['DA', 'DQ', 'D8', 'D5'], E: ['DK'], S: ['SA', 'SK', 'SQ', 'SJ', 'S8', 'D3'], W: ['C2'] }, focusCards: ['DA', 'DQ', 'DK', 'D3'] }),
	cardPlay({ id: 'dummy-reversal', levelName: 'Expert', category: 'Trump management', title: 'Spot a dummy reversal', strain: 'H', trigger: 'The nominal dummy has longer trumps and declarer has useful short trumps.', prompt: 'What unusual plan may create extra tricks?', choices: ['Ruff repeatedly in declarer, then draw trumps from dummy', 'Draw dummy’s trumps immediately', 'Discard all side-suit winners'], correctChoice: 0, explanation: 'Use declarer’s shorter trump holding for several ruffs, with enough entries to dummy to continue. Dummy’s long trumps then become the master holding.', principle: 'A dummy reversal swaps the normal roles of the two hands.', fixed: { N: ['HA', 'HK', 'HQ', 'HJ', 'H9', 'H8', 'CA', 'DA'], S: ['H7', 'H6', 'H5', 'C4', 'D4'], W: ['C2'] }, focusCards: ['HA', 'HK', 'HQ', 'HJ', 'H9', 'H8', 'H7', 'H6', 'H5'] }),
	cardPlay({ id: 'avoidance', levelName: 'Advanced', category: 'Advanced planning', title: 'Keep the danger hand off lead', trigger: 'Only one defender can lead through an unprotected honour.', prompt: 'Toward which opponent should you direct the losing play?', choices: ['The safe hand that cannot attack the weak holding', 'The danger hand', 'Whichever defender played fastest'], correctChoice: 0, explanation: 'Shape the play so the safe defender wins the necessary loser. Entries, finesses and ducking can all be used as avoidance plays.', principle: 'The identity of the winner can matter more than the fact that a trick is lost.', fixed: { N: ['HA', 'H4', 'D5'], S: ['HK', 'H3', 'DQ', 'D2'], E: ['DA'], W: ['C2'] }, focusCards: ['DQ', 'D2', 'DA', 'HA', 'HK'] }),
	cardPlay({ id: 'strip-endplay', levelName: 'Expert', category: 'Advanced planning', title: 'Strip the hand and endplay a defender', strain: 'S', trigger: 'A defender may be forced to lead away from an honour or give a ruff-and-discard.', prompt: 'What must happen before throwing that defender in?', choices: ['Remove safe exit cards from both defender and declarer', 'Leave every side suit untouched', 'Cash no trumps'], correctChoice: 0, explanation: 'Draw trumps as needed and eliminate the side suits. Then concede the chosen trick; the defender’s return solves a suit or concedes a ruff-and-discard.', principle: 'An endplay removes every harmless answer before giving up the lead.', fixed: { N: ['SA', 'S8', 'S4', 'DK', 'D4'], S: ['SK', 'SQ', 'SJ', 'S9', 'DA', 'D3'], E: ['DQ'], W: ['C2'] }, focusCards: ['DA', 'DK', 'DQ', 'D4', 'D3'] }),
	cardPlay({ id: 'simple-squeeze', levelName: 'Expert', category: 'Advanced planning', title: 'Recognise a simple squeeze', trigger: 'One defender appears to guard two suits near the end.', prompt: 'What three ingredients should you look for?', choices: ['Two threats, entries, and a squeeze card', 'Four trumps and no entries', 'A finesse in every suit'], correctChoice: 0, explanation: 'Rectify the count by losing the tricks you must lose, preserve communication with both threats, then cash the squeeze card while watching the defender’s discard.', principle: 'A squeeze works because one defender cannot keep both guards.', fixed: { N: ['SA', 'H4', 'D5'], S: ['HA', 'DK', 'C3'], E: ['SK', 'HK'], W: ['C2'] }, focusCards: ['SA', 'HA', 'DK', 'SK', 'HK'] }),
	defence({ id: 'opening-lead-sequence', levelName: 'Beginner', category: 'Defence', title: 'Lead the top of a solid sequence', trigger: 'You are on opening lead against no-trumps.', prompt: 'Which card best tells partner about K-Q-J-10?', choices: ['The king, top of the sequence', 'The ten, bottom of the sequence', 'An unrelated singleton ace'], correctChoice: 0, explanation: 'Leading the top of touching honours is both attacking and descriptive. Partner can place the next honours and continue intelligently.', principle: 'Sequences are safer and clearer than unsupported honours.', fixed: { S: ['HK', 'HQ', 'HJ', 'H10', 'H4'] }, recommendedCard: 'HK', focusCards: ['HK', 'HQ', 'HJ', 'H10'] }),
	defence({ id: 'fourth-highest', levelName: 'Intermediate', category: 'Defence', title: 'Lead fourth highest from length', trigger: 'You have no honour sequence against no-trumps.', prompt: 'Which lead convention helps partner count the suit?', choices: ['Fourth highest from the longest promising suit', 'Always the lowest card in hand', 'The ace from every four-card suit'], correctChoice: 0, explanation: 'Fourth highest gives partner useful length information and starts establishing the suit. First check the auction and avoid leading into a suit strongly bid by dummy.', principle: 'A lead is both an attack and a message.', fixed: { S: ['SK', 'S9', 'S7', 'S4', 'S2'] }, recommendedCard: 'S7', focusCards: ['SK', 'S9', 'S7', 'S4', 'S2'] }),
	defence({ id: 'second-hand-low', levelName: 'Beginner', category: 'Defence', title: 'Second hand low', trigger: 'Declarer leads a small card and you play second.', prompt: 'Why is playing low often right?', choices: ['Partner may win more cheaply and your honour remains over dummy', 'Honours can never win in second seat', 'It proves you are void'], correctChoice: 0, explanation: 'Playing low preserves your honour to capture a later card. Reconsider when you can win a necessary trick, split touching honours, or prevent a singleton honour winning.', principle: 'Do not spend an honour until it performs a useful job.', fixed: { S: ['HQ', 'H7', 'H3'] }, focusCards: ['HQ', 'H7', 'H3'] }),
	defence({ id: 'third-hand-high', levelName: 'Beginner', category: 'Defence', title: 'Third hand high—but win cheaply', trigger: 'Partner has led and dummy plays low.', prompt: 'What is third hand trying to do?', choices: ['Win the trick as cheaply as possible', 'Always play the ace', 'Return a different suit immediately'], correctChoice: 0, explanation: 'Third hand normally plays high to help establish partner’s suit, but with touching cards chooses the lowest card that will do the job.', principle: 'Support partner’s lead without wasting a higher honour.', fixed: { S: ['HA', 'HK', 'H8'] }, focusCards: ['HA', 'HK', 'H8'] }),
	defence({ id: 'attitude-signal', levelName: 'Intermediate', category: 'Defence', title: 'Give an attitude signal', trigger: 'Partner leads an honour and dummy’s card leaves you free to signal.', prompt: 'What should the signal answer?', choices: ['Whether you want this suit continued', 'How many high-card points you began with', 'The final contract score'], correctChoice: 0, explanation: 'Using the agreed method, encourage with a useful supporting honour and discourage without one. The signal guides partner; it does not command blindly.', principle: 'Signal what helps partner solve the next decision.', fixed: { S: ['HJ', 'H8', 'H3'] }, focusCards: ['HJ', 'H8', 'H3'] }),
	defence({ id: 'count-signal', levelName: 'Advanced', category: 'Defence', title: 'Give count when attitude is known', trigger: 'Declarer attacks a long suit and partner needs to know its distribution.', prompt: 'What information is most useful now?', choices: ['Whether your original holding had an odd or even count', 'Your exact high-card points', 'Which trump you will play later'], correctChoice: 0, explanation: 'Count helps partner judge when to take an ace or whether declarer has another card in the suit. Use only the partnership’s agreed signal method.', principle: 'When continuation is not the question, distribution often is.', fixed: { S: ['D9', 'D6', 'D3', 'D2'] }, focusCards: ['D9', 'D6', 'D3', 'D2'] }),
	defence({ id: 'suit-preference', levelName: 'Advanced', category: 'Defence', title: 'Use suit preference', auction: ['1S', 'P', '4S', 'P', 'P', 'P'], trigger: 'A ruff is coming and the return suit matters.', prompt: 'What can the rank of the card led for the ruff suggest?', choices: ['A preference for the higher or lower remaining side suit', 'The number of trumps partner has', 'That partner wants no return'], correctChoice: 0, explanation: 'A conspicuously high card can ask for the higher-ranking relevant side suit; a low card can ask for the lower. Context and partnership agreement matter.', principle: 'Suit preference helps partner choose the return after a ruff.', fixed: { S: ['H9', 'H2', 'C4'] }, focusCards: ['H9', 'H2', 'C4'] }),
	defence({ id: 'defensive-unblock', levelName: 'Advanced', category: 'Defence', title: 'Unblock partner’s suit', trigger: 'Partner appears to have a long suit and your honour may block it.', prompt: 'When should you release the honour?', choices: ['While partner still has a higher card to continue the suit', 'Only on the final trick', 'Never under a partner’s honour'], correctChoice: 0, explanation: 'Play the blocking honour under partner’s higher card when keeping it would prevent the suit from running. Count the known cards before unblocking.', principle: 'Defensive communication can be destroyed by one retained honour.', fixed: { S: ['HQ', 'H3'] }, focusCards: ['HQ', 'H3'] }),
]

const BIDDING_LESSONS = [
	bidding({ id: 'acol-open-1nt', levelName: 'Beginner', title: 'Open a balanced 12–14 with 1NT', dealer: 'S', auction: ['1NT', 'P', '3NT', 'P', 'P', 'P'], promptCallIndex: 0, recommendedCall: '1NT', trigger: 'Balanced hand, 12–14 HCP, no five-card major.', prompt: 'What is South’s clearest opening description?', choices: ['1NT', '1 of the longest suit', 'Pass'], correctChoice: 0, explanation: 'In this ACOL course, 1NT shows a balanced 12–14. It gives partner an immediate range and shape picture.', principle: 'Prefer the bid that describes both strength and shape in one call.', constraints: { S: { hcp: [12, 14], balanced: true } } }),
	bidding({ id: 'acol-open-major', levelName: 'Beginner', title: 'Open one of a major', dealer: 'S', auction: ['1H', 'P', '3H', 'P', '4H', 'P', 'P', 'P'], promptCallIndex: 0, recommendedCall: '1H', trigger: 'Opening values and a five-card heart suit.', prompt: 'Which opening starts the natural description?', choices: ['1H', '1NT', '2H'], correctChoice: 0, explanation: 'Open the five-card major at the one level with a normal opening hand. The weak-two opening would misstate the hand.', principle: 'Show a five-card major naturally when the hand is outside the 1NT description.', fixed: { S: ['HA', 'HK', 'H10', 'H7', 'H4'] }, constraints: { S: { hcp: [12, 18], lengths: { H: [5, 7] } } } }),
	bidding({ id: 'acol-stayman', levelName: 'Beginner', title: 'Use Stayman over 1NT', dealer: 'N', auction: ['1NT', 'P', '2C', 'P', '2H', 'P', '4H', 'P', 'P', 'P'], promptCallIndex: 2, recommendedCall: '2C', trigger: 'Partner opens 1NT and South has game interest with a four-card major.', prompt: 'Which call asks opener about a four-card major?', choices: ['2C Stayman', '2D natural', '3NT immediately'], correctChoice: 0, explanation: '2C is the Stayman enquiry. It searches for a 4–4 major fit before deciding whether to play in a major or no-trumps.', principle: 'Look for the major fit before settling in no-trumps.', fixed: { S: ['HA', 'H10', 'H7', 'H4'] }, constraints: { N: { hcp: [12, 14], balanced: true }, S: { hcp: [10, 16], lengths: { H: [4, 4] } } } }),
	bidding({ id: 'acol-transfer', levelName: 'Beginner', title: 'Transfer to a five-card major', dealer: 'N', auction: ['1NT', 'P', '2D', 'P', '2H', 'P', '3NT', 'P', '4H', 'P', 'P', 'P'], promptCallIndex: 2, recommendedCall: '2D', trigger: 'Partner opens 1NT and South has five or more hearts.', prompt: 'How should South show the heart suit while keeping opener declarer?', choices: ['Bid 2D as a transfer', 'Bid 2H naturally', 'Pass'], correctChoice: 0, explanation: 'The 2D transfer asks opener to bid 2H. The stronger hidden hand becomes declarer and South can describe strength on the next round.', principle: 'Transfers show length while protecting the strong hand.', fixed: { S: ['HA', 'HJ', 'H9', 'H6', 'H3'] }, constraints: { N: { hcp: [12, 14], balanced: true }, S: { hcp: [6, 15], lengths: { H: [5, 7] } } } }),
	bidding({ id: 'acol-invite-2nt', levelName: 'Beginner', title: 'Invite with 2NT', dealer: 'N', auction: ['1NT', 'P', '2NT', 'P', '3NT', 'P', 'P', 'P'], promptCallIndex: 2, recommendedCall: '2NT', trigger: 'Partner opens 1NT and South has a balanced invitational hand.', prompt: 'What call lets a maximum opener accept game?', choices: ['2NT', '3NT', 'Pass'], correctChoice: 0, explanation: 'With roughly 11–12 balanced points opposite a 12–14 1NT, 2NT invites. Opener passes with a minimum and raises with a maximum.', principle: 'Invitation bids ask partner to decide using the top or bottom of a known range.', constraints: { N: { hcp: [12, 14], balanced: true }, S: { hcp: [11, 12], balanced: true } } }),
	bidding({ id: 'acol-raise-major', levelName: 'Beginner', title: 'Raise partner’s major', dealer: 'N', auction: ['1S', 'P', '3S', 'P', '4S', 'P', 'P', 'P'], promptCallIndex: 2, recommendedCall: '3S', trigger: 'Partner opens 1S and South has four-card support with invitational strength.', prompt: 'What is the most useful information to give immediately?', choices: ['Raise to 3S', 'Bid a new minor', 'Bid 2NT as no-trumps'], correctChoice: 0, explanation: 'Support and strength are the central facts. A limit raise lets opener judge game with a maximum or extra shape.', principle: 'When a major fit is found, describe support and strength promptly.', fixed: { S: ['SA', 'S9', 'S7', 'S4'] }, constraints: { N: { hcp: [12, 18], lengths: { S: [5, 7] } }, S: { hcp: [10, 12], lengths: { S: [4, 5] } } } }),
	bidding({ id: 'acol-weak-two', levelName: 'Intermediate', title: 'Open a disciplined weak two', dealer: 'S', auction: ['2S', 'P', '4S', 'P', 'P', 'P'], promptCallIndex: 0, recommendedCall: '2S', trigger: 'A good six-card spade suit and about 6–10 HCP.', prompt: 'Which opening describes both the long suit and limited strength?', choices: ['2S', '1S', 'Pass'], correctChoice: 0, explanation: 'A weak two consumes bidding space while giving partner a useful picture. Suit quality, seat and vulnerability still matter.', principle: 'Pre-empt with shape and playing potential, not merely because the hand is weak.', fixed: { S: ['SK', 'SQ', 'SJ', 'S9', 'S7', 'S4'] }, constraints: { S: { hcp: [6, 10], lengths: { S: [6, 7] } } } }),
	bidding({ id: 'acol-overcall', levelName: 'Intermediate', title: 'Make a natural overcall', dealer: 'W', auction: ['1D', 'P', 'P', '1H', 'P', '2H', 'P', 'P', 'P'], promptCallIndex: 3, recommendedCall: '1H', trigger: 'An opponent opens and South has a sound five-card heart suit.', prompt: 'Which call competes and suggests a lead?', choices: ['1H', 'Double', '1NT'], correctChoice: 0, explanation: 'A natural overcall shows a useful suit and enough playing strength for the level. It competes for the contract and guides partner’s lead.', principle: 'An overcall should advertise a suit partner can safely support or lead.', fixed: { S: ['HA', 'HQ', 'H10', 'H7', 'H4'] }, constraints: { S: { hcp: [8, 16], lengths: { H: [5, 7] } } } }),
	bidding({ id: 'acol-takeout-double', levelName: 'Intermediate', title: 'Use a take-out double', dealer: 'W', auction: ['1H', 'P', '2H', 'X', 'P', '3D', 'P', 'P', 'P'], promptCallIndex: 3, recommendedCall: 'X', trigger: 'Opponents bid hearts and South has opening strength, short hearts and support for the other suits.', prompt: 'Which call asks partner to choose an unbid suit?', choices: ['Double', '2NT', '3C'], correctChoice: 0, explanation: 'The take-out double shows values and tolerance for the unbid suits. Partner is expected to bid, so distribution matters as much as points.', principle: 'Double for take-out when one call can describe support for several alternatives.', fixed: { S: ['SA', 'S8', 'S4', 'H3', 'DA', 'D9', 'D6', 'CK', 'C8', 'C5'] }, constraints: { S: { hcp: [12, 18], lengths: { H: [0, 2], S: [3, 5], D: [3, 5], C: [3, 5] } } } }),
	bidding({ id: 'acol-negative-double', levelName: 'Advanced', title: 'Use a negative double', dealer: 'N', auction: ['1D', '1S', 'X', 'P', '2H', 'P', '4H', 'P', 'P', 'P'], promptCallIndex: 2, recommendedCall: 'X', trigger: 'Partner opens a minor, the opponent overcalls spades, and South has hearts but cannot bid them comfortably at the two level.', prompt: 'Which call shows the unbid major without overstating the hand?', choices: ['Double', '2H', '2NT'], correctChoice: 0, explanation: 'The negative double lets responder show four hearts and useful values while keeping more strains available to opener.', principle: 'Use a conventional double when interference removes the natural descriptive bid.', fixed: { S: ['HA', 'H9', 'H6', 'H3'] }, constraints: { S: { hcp: [7, 12], lengths: { H: [4, 4], S: [0, 2] } } } }),
	bidding({ id: 'acol-strong-two-clubs', levelName: 'Advanced', title: 'Open a game-forcing hand with 2C', dealer: 'S', auction: ['2C', 'P', '2D', 'P', '2NT', 'P', '3NT', 'P', 'P', 'P'], promptCallIndex: 0, recommendedCall: '2C', trigger: 'A very strong balanced hand or a hand with overwhelming playing strength.', prompt: 'Which opening keeps the auction forcing?', choices: ['2C', '2NT', '1C'], correctChoice: 0, explanation: 'The strong artificial 2C opening prevents partner from passing below game and creates room to describe the hand later.', principle: 'With exceptional strength, first keep the auction alive; describe shape next.', fixed: { S: ['SA', 'SK', 'SQ', 'HA', 'HK', 'DA', 'DK', 'CA'] }, constraints: { S: { hcp: [23, 30] } } }),
	bidding({ id: 'acol-game-or-partscore', levelName: 'Intermediate', title: 'Add the partnership ranges', dealer: 'N', auction: ['1NT', 'P', '3NT', 'P', 'P', 'P'], promptCallIndex: 2, recommendedCall: '3NT', trigger: 'Partner opens 12–14 and South has a balanced 13 HCP.', prompt: 'What does the combined minimum tell you?', choices: ['The partnership belongs in game', 'Invite with 2NT', 'Stop in 1NT'], correctChoice: 0, explanation: 'Twelve plus thirteen reaches the usual 25-point game threshold. With no major-suit enquiry needed, bid 3NT directly.', principle: 'Known ranges turn judgement into arithmetic: add the minimums first.', constraints: { N: { hcp: [12, 14], balanced: true }, S: { hcp: [13, 14], balanced: true } } }),
]

const DEFINITIONS = [...PLAY_LESSONS, ...BIDDING_LESSONS]

function makeLesson(definition, index) {
	const hands = generateHands(definition)
	const board = String(index + 1)
	const deal = `N:${SEATS.map((seat) => pbnHand(hands[seat])).join(' ')}`
	const auctionText = definition.auction.join(' ')
	const pbn = [
		`[Event "Bridge Play School — ${definition.title}"]`,
		'[Site "Original Ralph teaching deal"]',
		`[Board "${board}"]`,
		`[Dealer "${definition.dealer}"]`,
		`[Vulnerable "${definition.vul}"]`,
		`[Deal "${deal}"]`,
		`[Auction "${definition.dealer}"]`,
		auctionText,
	].join('\n')
	const leadKey = definition.lead
	const scriptedCards = {
		...(leadKey ? { 0: { seat: 'W', card: leadKey } } : {}),
		...(definition.scriptedCards || {}),
	}
	return {
		...definition,
		board,
		deal,
		pbn,
		scriptedCards,
	}
}

export const tutorialLessons = DEFINITIONS.map(makeLesson)

export const tutorialPbn = tutorialLessons.map((lesson) => lesson.pbn).join('\n\n')

export const tutorialCurriculum = [
	{ id: 'planning', label: 'Planning & entries', categories: ['Planning', 'Establishing tricks', 'Entries', 'Timing'] },
	{ id: 'finesses', label: 'Finesses & combinations', categories: ['Finesses', 'Suit combinations'] },
	{ id: 'trumps', label: 'Trump management', categories: ['Trump management'] },
	{ id: 'advanced', label: 'Advanced declarer play', categories: ['Advanced planning'] },
	{ id: 'defence', label: 'Defence', categories: ['Defence'] },
	{ id: 'bidding', label: 'ACOL bidding', categories: ['ACOL bidding'] },
]

export function tutorialContent() {
	return {
		kind: 'tutorial',
		courseId: 'bridge-play-school-v1',
		title: 'Bridge Play School',
		lessons: tutorialLessons.map((source) => {
			const lesson = { ...source }
			delete lesson.pbn
			delete lesson.deal
			delete lesson.fixed
			delete lesson.constraints
			return lesson
		}),
	}
}

export function tutorialLessonFor(content, board) {
	if (content?.kind !== 'tutorial') return null
	return (content.lessons || []).find((lesson) => String(lesson.board) === String(board)) || null
}

export function tutorialCardKey(cardValue) {
	if (!cardValue) return ''
	if (typeof cardValue === 'string') {
		const suit = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }[cardValue[0]]
		const rank = cardValue.slice(1) === 'T' ? '10' : cardValue.slice(1)
		return suit && rank ? `${suit}:${rank}` : ''
	}
	return `${cardValue.suit}:${cardValue.rank}`
}

export function validateTutorialLibrary() {
	return tutorialLessons.map((lesson) => {
		const allCards = Object.values(generateHands(lesson)).flat()
		return {
			id: lesson.id,
			cards: allCards.length,
			uniqueCards: new Set(allCards).size,
			valid: allCards.length === 52 && new Set(allCards).size === 52,
		}
	})
}
