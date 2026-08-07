# Player V3: South Practice, Rotated Declarer View, and Coach Access

This note records the approved design and first implementation for the learner-facing Player V3 work completed on 7 August 2026.

## Product decisions

- A loaded board begins in **Play as South**, not in a replay of the PBN auction.
- The recorded PBN auction is a separate, read-only comparison track. Switching views never replaces or rewinds the learner's practice auction.
- South makes only South's calls. North, East, and West bid automatically until South is next to act.
- The first release is deliberately guided rather than a complete bridge robot. A computer seat follows the recorded PBN while the practice auction still matches it; after a divergence, it uses a small conservative ACOL ruleset based only on its own hand and the public auction.
- The configured teaching style is ACOL with a 12–14 balanced 1NT, basic Stayman and transfers, and conservative natural continuations. Unsupported competitive or advanced sequences default safely to Pass.
- Return, arrows, Space, and R can pace the recorded comparison, but cannot mutate the live practice auction. This prevents the earlier accidental Return-key confusion.

## Learner ownership and table position

The learner normally occupies South at the bottom of the screen.

| Contract situation | Bottom screen seat | Other screen changes | Learner-controlled cards |
| --- | --- | --- | --- |
| North declarer / South dummy | North | South moves to top; East and West exchange screen sides | North and South |
| South declarer | South | Normal compass layout | South and dummy North |
| North/South defending | South | Normal compass layout | South; North defends automatically |
| East/West declaring | South | Normal compass layout | South; all other seats play automatically |

Dummy is exposed after the opening lead according to normal play. The full 180-degree rotation for a North declarer keeps the acting declarer nearest the learner and avoids asking the learner to play from the far side of a hall display.

## Live Coach experience

- The normal in-play aid is a compact **Coach nudge** attached near the learner's hand and shown only when the learner has a real bidding or card-play decision.
- The nudge asks for a short principle-led prompt. It must use only information legally available to the learner and must not reveal hidden hands or solve the position outright.
- **Coach notebook** opens the larger transcript and detailed controls. This is intentionally secondary during play and is the natural home for a future end-of-hand post-mortem.
- Local deterministic fact buttons remain free and make no API call.

## AI access and cost control

The ordinary bridge player remains public. AI spending is isolated behind Netlify Functions; the OpenAI key is server-side and must never use a `VITE_` environment variable.

Current access model:

1. A retained browser can make one complimentary anonymous `nudge` request.
2. The trial is enabled only when `COACH_TRIAL_ENABLED=true`; a durable daily cap and the OpenAI project budget are independent cost backstops.
3. After the complimentary nudge, a further Coach request opens the access panel and asks the visitor to email the teacher. At present this means a manual, invite-only Netlify Identity account; there is no shared master password or reusable client-side code.
4. The owner route still requires an authenticated Identity user, the server-controlled `coach-owner` role, and an exact `COACH_OWNER_EMAIL` match.

### Required next access milestone

Before a public paid launch, replace browser-only trial identity with verified email/account identity:

- require email verification before issuing further complimentary or paid credits;
- store entitlements and remaining credits against the immutable Identity user ID;
- make any emailed access code a one-use, expiring server-side redemption token;
- add payment only after that entitlement layer exists (for example, a hosted payment checkout plus a verified webhook);
- retain a global daily cap, an immediate kill switch, and provider-level spend limits.

The current cookie trial is a measured preview, not proof of one use per human: clearing cookies or changing devices can create another browser identity. The global daily cap bounds that known limitation until verified accounts replace it.

## Deferred work

- Expand the guided bidder progressively with tested ACOL competitive auctions, rebids, opener continuations, doubles, and convention choices.
- Add a post-game teaching workspace using the full screen, complete public play history, trick-by-trick navigation, and separate perspectives for declarer and defence.
- Add teacher-managed learner accounts, entitlement/credit administration, and verified-email access.
- Consider payments only after the entitlement and audit trail are in place.

## Verification commands

Run from `ralph-react`:

```bash
node --test src/player-v2/playerV2Reducer.test.js src/player-v2/acolPracticeBidder.test.js
npm run test:coach
npm run test:generator2
npm run build
```
