# Player V3: South Practice and Simplified Classroom Workflow

This note records the learner-facing Player V3 decisions first implemented on
7 August 2026 and the simplified classroom workflow approved on 3 September
2026.

## Product decisions

- The Player has three visible phases: **Bid**, **Check contract**, and **Play**.
- A loaded board begins in **Bid as South**, not in a replay of the PBN auction.
- A blank or absent PBN auction remains valid. The Generator is unchanged and is
  not required to manufacture an auction.
- When an auction is absent, the Player presents **First task: bid this hand**.
  It explains that South is the learner seat and that a completed auction or a
  teacher-set contract is needed before card play.
- North, East, and West do not call behind the first-task message. They begin
  automatic guided ACOL bidding only after **Start bidding**.
- **Set a contract instead** remains available as a secondary teacher route for
  lessons intended to begin directly with card play.
- During bidding, the main workspace contains South's compact hand, the auction
  and large bidding controls. The other three hands and the full card table are
  removed from this phase so they cannot obscure the bidding task on a projected
  display.
- South makes only South's calls. North, East, and West bid automatically until
  South is next to act.
- The recorded PBN auction is a secondary, read-only **Compare recorded
  auction** track. It is offered only when recorded calls exist. Switching views
  never replaces or rewinds the learner's practice auction.
- The first release is deliberately guided rather than a complete bridge robot. A computer seat follows the recorded PBN while the practice auction still matches it; after a divergence, it uses a small conservative ACOL ruleset based only on its own hand and the public auction.
- The configured teaching style is ACOL with a 12–14 balanced 1NT, basic Stayman and transfers, and conservative natural continuations. Unsupported competitive or advanced sequences default safely to Pass.
- Return, arrows, Space, and R can pace the recorded comparison, but cannot mutate the live practice auction. This prevents the earlier accidental Return-key confusion.

## Contract checkpoint and phase change

- When bidding ends, the Player replaces the bidding controls with a single
  checkpoint showing the **contract, declarer, opening leader, and learner
  role**.
- **Restart auction** remains available before play if the class wants to review
  a different route.
- **Confirm contract** records the teacher's check. **Start play** then performs
  a deliberate transition to the full four-hand card table.
- A passed-out auction has no card-play phase. The Player explains this and
  offers **Restart auction** and **Next board**; the separate teacher-set
  contract route remains available when required.
- The full N/E/S/W table, hand-reveal controls, trick area, and card-play tools
  appear only in the Play phase. Each preceding phase gives screen space to its
  essential task.

## Learner ownership and table position

The learner normally occupies South at the bottom of the screen.

| Contract situation | Bottom screen seat | Other screen changes | Learner-controlled cards |
| --- | --- | --- | --- |
| North declarer / South dummy | North | South moves to top; East and West exchange screen sides | North and South |
| South declarer | South | Normal compass layout | South and dummy North |
| North/South defending | South | Normal compass layout | South; North defends automatically |
| East/West declaring | South | Normal compass layout | South; all other seats play automatically |

Dummy is exposed after the opening lead according to normal play. The full 180-degree rotation for a North declarer keeps the acting declarer nearest the learner and avoids asking the learner to play from the far side of a hall display.

## AI Coach status

- AI Coach, Coach notebook, near-hand nudge, sign-in prompts, and trial controls
  are temporarily removed from the Player interface.
- The immediate product priority is dependable bidding, contract confirmation,
  card play, and replay with maximum classroom clarity.
- Ordinary Player use therefore exposes no control that can start a paid AI
  request.
- Keep `COACH_TRIAL_ENABLED=false` in the deployed Netlify environment while
  the trial interface is retired; this also closes the anonymous trial endpoint
  against direct calls.
- The existing server-side access and cost-control groundwork may remain dormant
  for a later redesign. Any reintroduction must fit the phase-based classroom
  layout and must not cover the learner's hand, bidding controls, or play table.
- Possible future forms include a very small decision-time nudge and a separate
  end-of-hand post-mortem workspace. Neither is part of the current Player.

## Dormant AI access groundwork

If AI coaching returns, spending must remain isolated behind server-side
functions. Provider keys must never use a `VITE_` environment variable or be
sent to the browser. The earlier browser-trial and invite-only Identity work is
retained only as groundwork, not as an active Player access model.

### Required next access milestone

Before a public paid launch, replace browser-only trial identity with verified email/account identity:

- require email verification before issuing further complimentary or paid credits;
- store entitlements and remaining credits against the immutable Identity user ID;
- make any emailed access code a one-use, expiring server-side redemption token;
- add payment only after that entitlement layer exists (for example, a hosted payment checkout plus a verified webhook);
- retain a global daily cap, an immediate kill switch, and provider-level spend limits.

Any future complimentary trial must not treat a browser cookie as proof of one
use per person: clearing cookies or changing devices creates another browser
identity. A global daily cap, immediate kill switch, and provider-level spend
limits remain necessary even after verified accounts are introduced.

## Deferred work

- Expand the guided bidder progressively with tested ACOL competitive auctions, rebids, opener continuations, doubles, and convention choices.
- Continue simplifying restart and replay for both the auction and the hand.
- Reconsider AI coaching only after the core workflow is classroom-tested. A
  future post-game workspace may use the full screen, complete public play
  history, trick-by-trick navigation, and separate perspectives for declarer
  and defence.
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
