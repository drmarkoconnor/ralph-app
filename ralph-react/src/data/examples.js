// Built-in illustrative examples for openings and conventions (ACOL style)
// Each entry contains a label and a minimal deal object the Player understands.
// Deals use PBN Deal format: "<Dealer>:<N> <E> <S> <W>" with suit order S.H.D.C per seat.

export const EXAMPLE_LIBRARY = [
	{
		group: 'Openings',
		items: [
			{
				label: '1NT',
				deals: [
					{
						board: 1,
						dealer: 'S',
						vul: 'None',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// South balanced 12–14 HCP (Acol 1NT)
						deal: 'S:AJ983.J53.K2.QT2 T542.A62.A4.KJ87 K7.K87.QJ53.A964 Q6.QT94.T9876.53',
						auctionDealer: 'S',
						auction: ['1NT', 'P', 'P', 'P'],
						notes: ['Acol 1NT opening: 12-14 HCP, balanced.'],
					},
				],
			},
			{
				label: 'Gambling 3NT',
				deals: [
					{
						board: 13,
						dealer: 'S',
						vul: 'EW',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// South: solid clubs (AKQJ+), 7+ cards, no outside A/K
						deal: 'S:864.AT95.Q7.7653 AQ75.Q6.AKJ9843.- 93.J43.2.AKQJ842 KJT2.K872.T65.T9',
						auctionDealer: 'S',
						auction: ['3NT', 'P', 'P', 'P'],
						notes: ['Acol Gambling 3NT: solid 7+ card minor, no outside A/K.'],
					},
				],
			},
			{
				label: '1 of a Suit',
				deals: [
					{
						board: 2,
						dealer: 'W',
						vul: 'NS',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// West: opening 1♥ with 5+ hearts, ~12–19 HCP
						deal: 'W:T9852.J5.J8.AJ43 J43.K8.653.KT952 A76.QT3.QT9742.7 KQ.A97642.AK.Q86',
						auctionDealer: 'W',
						auction: ['1H', 'P', '2H', 'P', 'P', 'P'],
						notes: [
							'Acol 1♥ opening (4+ hearts; here 6 for clarity), 12-19 HCP.',
						],
					},
				],
			},
			{
				label: '2NT',
				deals: [
					{
						board: 3,
						dealer: 'N',
						vul: 'EW',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// North balanced 20–22 HCP
						deal: 'N:K9.AT6.AK2.AQJ74 QJT7543.32.Q.K53 A86.KJ98.T9765.8 2.Q754.J843.T962',
						auctionDealer: 'N',
						auction: ['2NT', 'P', '3NT', 'P', 'P', 'P'],
						notes: ['Acol 2NT opening: 20-22 HCP, balanced.'],
					},
				],
			},
			{
				label: '2♣ (strong)',
				deals: [
					{
						board: 4,
						dealer: 'E',
						vul: 'All',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// East: strong GF; 23+ HCP
						deal: 'E:A3.T843.AJ32.QJ3 KQJ6.KQ.KQ8.AKT9 T9874.AJ65.95.75 52.972.T764.8642',
						auctionDealer: 'E',
						auction: ['2C', 'P', '2D', 'P', '2NT', 'P', '3NT', 'P', 'P', 'P'],
						notes: ['Acol strong 2♣: game forcing, ~23+ HCP.'],
					},
				],
			},
			{
				label: 'Benjamin 2♦ (strong)',
				deals: [
					{
						board: 14,
						dealer: 'W',
						vul: 'None',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// West: strong GF via Benjaminised Acol
						deal: 'W:QJ53.T5.QJ9.KT85 98.94.875.A97643 AT762.QJ832.64.2 K4.AK76.AKT32.QJ',
						auctionDealer: 'W',
						auction: ['2D', 'P', '2H', 'P', '2NT', 'P', '3NT', 'P', 'P', 'P'],
						notes: ['Benjaminised Acol: 2♦ shows strong GF; relay then to NT.'],
					},
				],
			},
			{
				label: '2 of a Suit (weak)',
				deals: [
					{
						board: 5,
						dealer: 'S',
						vul: 'NS',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// South weak 2♥ (6+ hearts, ~6–10 HCP)
						deal: 'S:J653.KQ7.AJ2.QT6 KT72.-.KQ98543.92 8.AJ98654.76.K43 AQ94.T32.T.AJ875',
						auctionDealer: 'S',
						auction: ['2H', 'P', 'P', 'P'],
						notes: ['Acol weak two: 6-card suit, about 6-10 HCP.'],
					},
				],
			},
			{
				label: '3 of a Suit (weak)',
				deals: [
					{
						board: 6,
						dealer: 'W',
						vul: 'EW',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// West 7-card spade preempt, ~5–9 HCP
						deal: 'W:8.KQ8.KJ62.QJ853 -.763.A9743.AKT64 AKJ64.AJT95.8.97 QT97532.42.QT5.2',
						auctionDealer: 'W',
						auction: ['3S', 'P', 'P', 'P'],
						notes: ['Acol 3-level preempt: 7-card suit, about 5-9 HCP.'],
					},
				],
			},
			{
				label: 'Pass',
				deals: [
					{
						board: 7,
						dealer: 'N',
						vul: 'None',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// North: unsuitable to open (<12 HCP)
						deal: 'N:Q9863.J7.JT54.32 KJT42.AT964.9.98 A5.Q5.Q8762.KJ65 7.K832.AK3.AQT74',
						auctionDealer: 'N',
						auction: ['P', 'P', 'P', 'P'],
						notes: ['Pass: fewer than 12 HCP and no compelling distribution.'],
					},
				],
			},
			{
				label: 'Weak jump overcall',
				deals: [
					{
						board: 15,
						dealer: 'N',
						vul: 'NS',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// East: weak jump to 2♠ over 1♥ opening by North
						deal: 'N:J9.AQ942.AK86.32 AKQT653.T75.2.T8 82.KJ8.JT9754.AJ 74.63.Q3.KQ97654',
						auctionDealer: 'N',
						auction: ['1H', '2S', 'P', 'P', '3H', 'P', '4H', 'P', 'P', 'P'],
						notes: ['Weak jump overcall shows 6-card suit and ~6–10 HCP.'],
					},
				],
			},
			{
				label: 'Takeout double',
				deals: [
					{
						board: 16,
						dealer: 'E',
						vul: 'EW',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// East opens 1♦; South short ♦ and 4-4 majors → TO double
						deal: 'E:9.A853.84.K97652 K2.T42.AKT73.AQ3 AQT7.KQJ96.65.T8 J86543.7.QJ92.J4',
						auctionDealer: 'E',
						auction: ['1D', 'X', 'P', '1H', 'P', '2H', 'P', 'P', 'P'],
						notes: ['Classic takeout double shape by South over 1♦.'],
					},
				],
			},
		],
	},
	{
		group: 'Conventions',
		items: [
			{
				label: 'Slam bidding',
				deals: [
					{
						board: 8,
						dealer: 'N',
						vul: 'All',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// NS strong spade fit headed by AKQJ
						deal: 'N:AKQJ97.Q.J962.K4 8.T9862.A54.9762 6432.AK743.K.AJ5 T5.J5.QT873.QT83',
						auctionDealer: 'N',
						auction: [
							'1S',
							'P',
							'3S',
							'P',
							'4NT',
							'P',
							'5H',
							'P',
							'6S',
							'P',
							'P',
							'P',
						],
						notes: [
							'Slam try with keycard enquiry leading to 6♠ (5♥ = two keycards without the trump queen).',
						],
					},
				],
			},
			{
				label: 'Gerber (over NT)',
				deals: [
					{
						board: 17,
						dealer: 'S',
						vul: 'All',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// South opens 1NT (Acol); North uses 4♣ Gerber; 4♦ reply = one ace (per note)
						deal: 'S:8.AKQT72.AT76.63 65.J54.Q98.AQ542 AQ97.863.KJ42.KT KJT432.9.53.J987',
						auctionDealer: 'S',
						auction: [
							'1NT',
							'P',
							'4C',
							'P',
							'4D',
							'P',
							'4NT',
							'P',
							'6NT',
							'P',
							'P',
							'P',
						],
						notes: ['Gerber 4♣ over 1NT; 4♦ = one ace; quantitative to 6NT.'],
					},
				],
			},
			{
				label: '4th Suit Forcing',
				deals: [
					{
						board: 9,
						dealer: 'W',
						vul: 'NS',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// Auction: 1♣–1♥; 1♠–2♦ (4th suit, game forcing)
						deal: 'W:QT.AT.KQJ7.J9752 J3.KJ92.A9532.QT 98754.7653.4.864 AK62.Q84.T86.AK3',
						auctionDealer: 'W',
						auction: [
							'1C',
							'P',
							'1H',
							'P',
							'1S',
							'P',
							'2D',
							'P',
							'2NT',
							'P',
							'3NT',
							'P',
							'P',
							'P',
						],
						notes: [
							'2♦ is the 4th suit (artificial, forcing to game); opener shows stoppers and strength → 3NT.',
						],
					},
				],
			},
			{
				label: 'Negative double',
				deals: [
					{
						board: 18,
						dealer: 'W',
						vul: 'NS',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// W: 1♣; N overcalls 1♠; E makes a negative double (hearts implied)
						deal: 'W:T865.J6.KJ9.9753 KQ.Q854.A6432.T2 43.KT732.Q7.KJ86 AJ972.A9.T85.AQ4',
						auctionDealer: 'W',
						auction: ['1C', '1S', 'X', 'P', '2H', 'P', 'P', 'P'],
						notes: [
							'Negative double by responder shows the other major(s), here hearts.',
						],
					},
				],
			},
			{
				label: 'Stayman',
				deals: [
					{
						board: 10,
						dealer: 'S',
						vul: 'EW',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// South 1NT with 4 hearts; North has 4 hearts → Stayman then to 3NT
						deal: 'S:J73.Q965.QJT4.A7 T852.AT.A653.T62 KQ6.KJ873.92.KQ4 A94.42.K87.J9853',
						auctionDealer: 'S',
						auction: ['1NT', 'P', '2C', 'P', '2H', 'P', '3NT', 'P', 'P', 'P'],
						notes: [
							'Stayman after 1NT; opener shows a 4-card major (hearts), then to 3NT.',
						],
					},
				],
			},
			{
				label: 'Transfers',
				deals: [
					{
						board: 11,
						dealer: 'S',
						vul: 'None',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// South 1NT; North has 5+ hearts → Jacoby transfer; then to 3NT
						deal: 'S:-.AKQ954.94.96432 A732.6.AQJ865.KJ QT95.J3.KT7.AQT5 KJ864.T872.32.87',
						auctionDealer: 'S',
						auction: ['1NT', 'P', '2D', 'P', '2H', 'P', '3NT', 'P', 'P', 'P'],
						notes: ['Jacoby transfer to hearts (North 5+♥), then to 3NT.'],
					},
				],
			},
			{
				label: 'Inverted minors',
				deals: [
					{
						board: 19,
						dealer: 'N',
						vul: 'None',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// 1♦ – 2♦ is a strong raise; proceed to 3NT
						deal: 'N:QJ732.K.KJT5.K87 A986.J63.Q63.T93 T5.Q7.A98742.AJ4 K4.AT98542.-.Q652',
						auctionDealer: 'N',
						auction: ['1D', 'P', '2D', 'P', '3NT', 'P', 'P', 'P'],
						notes: ['Inverted minors: 2♦ as a strong raise; to 3NT.'],
					},
				],
			},
			{
				label: 'Michaels / Unusual 2NT',
				deals: [
					{
						board: 12,
						dealer: 'N',
						vul: 'EW',
						meta: { event: 'Examples', site: 'Examples', date: '2025.08.27' },
						// Over 1♠, 2♠ shows ♥ and a minor (Michaels)
						deal: 'N:AK986.JT5.A7643.- 2.KQ876.8.KQT765 QT.A432.QT95.J82 J7543.9.KJ2.A943',
						auctionDealer: 'N',
						auction: ['1S', '2S', 'P', '4H', 'P', 'P', 'P'],
						notes: ['Michaels cue-bid over 1♠ showing ♥ and a minor.'],
					},
				],
			},
			{
				label: 'Splinter raise',
				deals: [
					{
						board: 20,
						dealer: 'S',
						vul: 'NS',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// North: 4+♥ with club shortage → 4♣ splinter over 1♥
						deal: 'S:K983.K542.KQT3.Q T754.QT.J96.K742 AJ2.AJ9873.A.J65 Q6.6.87542.AT983',
						auctionDealer: 'S',
						auction: [
							'1H',
							'P',
							'4C',
							'P',
							'4H',
							'P',
							'4NT',
							'P',
							'5H',
							'P',
							'6H',
							'P',
							'P',
							'P',
						],
						notes: [
							'Splinter: 4♣ = singleton/void clubs with ♥ fit; slam try accepted to 6♥.',
						],
					},
				],
			},
			{
				label: 'Bergen raise',
				deals: [
					{
						board: 21,
						dealer: 'W',
						vul: 'EW',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// West: 1♠; East: 3♣ Bergen (4+ support, constructive)
						deal: 'W:AK3.-.K96542.9732 QJ54.J864.T7.AQT 7.97532.83.J8654 T9862.AKQT.AQJ.K',
						auctionDealer: 'W',
						auction: ['1S', 'P', '3C', 'P', '4S', 'P', 'P', 'P'],
						notes: ['Bergen raise: 3♣ constructive raise with 4+ support.'],
					},
				],
			},
			{
				label: 'Multi 2♦ (obscure)',
				deals: [
					{
						board: 22,
						dealer: 'N',
						vul: 'All',
						meta: { event: 'Examples', site: 'Built-in', date: '2025.08.27' },
						// North: weak two in a major (here hearts); responder passes to play 2♥
						deal: 'N:-.AK8652.T842.Q96 98754.J.753.J854 AKQT3.QT74.A6.T2 J62.93.KQJ9.AK73',
						auctionDealer: 'N',
						auction: ['2D', 'P', '2H', 'P', 'P', 'P'],
						notes: ['Multi 2♦: weak two in a major (hearts shown here).'],
					},
				],
			},
		],
	},
]

