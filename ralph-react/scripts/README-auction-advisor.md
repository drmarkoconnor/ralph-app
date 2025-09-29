## ACOL Auction Advisor (Prototype)

Generates deterministic, simplified ACOL auction advice JSON for each board in `/pbn/*.pbn`.

### Usage

1. Place one or more `.pbn` files in `./pbn/`.
2. Run (requires `ts-node` – not yet added to deps; use `npx ts-node` or transpile):

```
npx ts-node scripts/build-auctions.ts
```

Outputs JSON to `./out/advice/{dealHash}.json` with schema:

```
{
  dealHash: string,
  board: number,
  meta: { dealer, vul, system },
  auctions: [ { label, seq[], prob, bullets[] } ],
  recommendation_index: number,
  final_contract: { by, level, strain },
  teacher_focus: string[]
}
```

### Next Steps
- Integrate into PDF pipeline: render auction table + contract + bullets under each hand with a horizontal rule.
- Add loser-count precision and vulnerability awareness.
- Expand alternatives (overcalls, competitive auctions) in v2.
