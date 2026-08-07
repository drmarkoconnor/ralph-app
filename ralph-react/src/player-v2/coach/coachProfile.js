export const SOUTH_LEARNER_SEAT = 'S'

export function createCoachProfile(learnerSeat = SOUTH_LEARNER_SEAT) {
	const seat = learnerSeat === 'N' ? 'N' : SOUTH_LEARNER_SEAT
	return Object.freeze({
		id: seat === 'S' ? 'south-acol-12-14-safe-v1' : 'learner-acol-12-14-safe-v2',
		learnerSeat: seat,
		hintMode: 'safer',
		biddingSystem: Object.freeze({
			name: 'ACOL',
			oneNoTrump: Object.freeze({
				hcpMinimum: 12,
				hcpMaximum: 14,
				shape: 'balanced',
			}),
			stayman: Object.freeze({
				call: '2C',
				asksForFourCardMajor: true,
			}),
		}),
		disclosure: Object.freeze({
			hiddenCardLocations: false,
			futureAuctionCalls: false,
			doubleDummyAnalysis: false,
		}),
	})
}

export const SOUTH_COACH_PROFILE = createCoachProfile(SOUTH_LEARNER_SEAT)
