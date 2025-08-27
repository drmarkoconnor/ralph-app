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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified 52-card layout, South balanced ~13 HCP
            deal: 'S:KQ7.QJ4.KJ3.9754 A943.T985.972.J8 JT652.AK72.64.T2 8.63.AQT85.AKQ63',
            auctionDealer: 'S',
            auction: ['1NT', 'P', 'P', 'P'],
            notes: ['Acol 1NT opening: 12‑14 HCP, balanced.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified: South solid clubs, no outside A/K
            deal: 'S:8.83.74.AKQJT96 AKQ.AKT7.AKQ.87 JT95.QJ96.JT98.543 76432.542.6532.2',
            auctionDealer: 'S',
            auction: ['3NT', 'P', 'P', 'P'],
            notes: [
              'Acol Gambling 3NT: solid 7+ card minor, no outside A/K.',
            ],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // West: opening 1♥ with 5 hearts, ~14 HCP (Acol permits 4+ majors; 5 here for clarity)
            deal: 'W:-.-.-.- -.-.-.- -.-.-.- K83.AKT74.Q53.Q6',
            auctionDealer: 'W',
            auction: ['1H', 'P', '2H', 'P', 'P', 'P'],
            notes: ['Acol 1♥ opening (4+ hearts; here 5‑card for clarity), 12‑19 HCP.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified: North balanced 21 HCP
            deal: 'N:AKQ.KJ4.AQ3.QJ94 9753.A83.T52.T75 JT62.QT962.6.K92 84.75.KJ9874.A83',
            auctionDealer: 'N',
            auction: ['2NT', 'P', '3NT', 'P', 'P', 'P'],
            notes: ['Acol 2NT opening: 20‑22 HCP, balanced.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // East: strong 2♣ (game force; 23+ HCP) — rest will be auto-completed
            deal: 'E:-.-.-.- -.-.-.- AKQ.AQJ.AK4.543 -.-.-.-',
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // West: strong hand via Benjaminised Acol 2♦ (game force)
            deal: 'W:-.-.-.- -.-.-.- -.-.-.- AKQ.AJ10.AKQ4.87',
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified: South weak 2H, 6-card suit
            deal: 'S:983.QJT974.K8.62 AKQ7.53.AQJ53.T4 JT52.AK62.72.A87 64.98.T964.JK953',
            auctionDealer: 'S',
            auction: ['2H', 'P', 'P', 'P'],
            notes: ['Acol weak two: 6‑card suit, about 6‑10 HCP.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified: West 7-card spade preempt
            deal: 'W:QJT9874.62.83.52 AK2.KQJ5.K72.AJ7 653.A874.QT96.93 9.T93.AJ54.KQT864',
            auctionDealer: 'W',
            auction: ['3S', 'P', 'P', 'P'],
            notes: ['Acol 3‑level preempt: 7‑card suit, about 5‑9 HCP.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // North: unsuitable to open (<12 HCP)
            deal: 'N:9752.873.864.842 -.-.-.- -.-.-.- -.-.-.-',
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // East: weak jump to 2♠ over 1♥ opening by North
            deal: 'N:A7.KQJ83.A42.983 -.-.-.- -.-.-.- -.-.-.-',
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // East opens 1♦, South has short diamonds and support for unbid majors -> TO double
            deal: 'E:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified: NS strong spade fit
            deal: 'N:AKQJ5.AK2.KQ.32 T983.965.872.J97 98764.QJ3.A65.K5 2.T874.QJT943.AT8',
            auctionDealer: 'N',
            auction: ['1S', 'P', '3S', 'P', '4NT', 'P', '5H', 'P', '6S', 'P', 'P', 'P'],
            notes: ['Slam try with keycard enquiry leading to 6♠.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // South opens 1NT; North uses 4♣ Gerber to ask for aces
            deal: 'S:KQ7.QJ4.KJ3.9754 -.-.-.- -.-.-.- -.-.-.-',
            auctionDealer: 'S',
            auction: ['1NT', 'P', '4C', 'P', '4D', 'P', '4NT', 'P', '6NT', 'P', 'P', 'P'],
            notes: ['Gerber 4♣ over 1NT; 4♦=one ace; quantitative to 6NT.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            deal: 'W:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
            auctionDealer: 'W',
            auction: ['1C', 'P', '1H', 'P', '1S', 'P', '2D', 'P', '2NT', 'P', '3NT', 'P', 'P', 'P'],
            notes: ['4th suit (2♦) forcing to game inquiry; rebid to NT.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            deal: 'W:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
            auctionDealer: 'W',
            auction: ['1C', '1S', 'X', 'P', '2H', 'P', 'P', 'P'],
            notes: ['Negative double by responder shows the other major(s).'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified: South 1NT, 4-card hearts available
            deal: 'S:KQ7.QJ4.KJ3.9754 A943.T985.972.J8 JT62.AK72.64.T2 85.63.AQT85.AKQ63',
            auctionDealer: 'S',
            auction: ['1NT', 'P', '2C', 'P', '2H', 'P', '3NT', 'P', 'P', 'P'],
            notes: ['Stayman after 1NT; opener shows a 4‑card major (hearts).'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Fully specified: South 1NT; North transfers to hearts
            deal: 'S:KQ7.QJ4.KJ3.9754 A943.T985.972.J8 JT62.AK72.64.T2 85.63.AQT85.AKQ63',
            auctionDealer: 'S',
            auction: ['1NT', 'P', '2D', 'P', '2H', 'P', '3NT', 'P', 'P', 'P'],
            notes: ['Jacoby transfer to hearts, then to 3NT.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            deal: 'N:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            // Opponents use a Michaels cue‑bid over 1♠ to show ♥ + a minor
            deal: 'N:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
            auctionDealer: 'N',
            auction: ['1S', '2S', 'P', '4H', 'P', 'P', 'P'],
            notes: ['Michaels cue‑bid over 1♠ showing ♥ and a minor.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            deal: 'S:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
            auctionDealer: 'S',
            auction: ['1H', 'P', '4C', 'P', '4H', 'P', '4NT', 'P', '5H', 'P', '6H', 'P', 'P', 'P'],
            notes: ['Splinter: 4♣ as singleton/void club with ♥ fit; slam try.'],
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            deal: 'W:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
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
            meta: { event: 'Examples', site: 'Built‑in', date: '2025.08.27' },
            deal: 'N:-.-.-.- -.-.-.- -.-.-.- -.-.-.-',
            auctionDealer: 'N',
            auction: ['2D', 'P', '2H', 'P', 'P', 'P'],
            notes: ['Multi 2♦ (treatment): weak two in a major or strong; illustrative.'],
          },
        ],
      },
    ],
  },
]
