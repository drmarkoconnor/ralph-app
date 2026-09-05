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
  a deliberate transition to the four-seat card table.
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

## Play-table information policy

- A concealed seat renders as a compact marker containing its seat and current
  card count. It does not render a fan of card backs and does not expose HCP.
- The only full card displays are the learner-controlled hand, a hand the
  teacher has deliberately revealed, and dummy after it is legally exposed by
  the opening lead.
- Played cards remain in the central current-trick area. Reducing concealed
  hands must not move the trick away from the visual centre of the table.
- These rules apply in both normal and presentation views. They reduce clutter
  while preserving the public information needed to teach the hand.

## Present table

- Presentation is one action labelled **Present table**, rather than separate
  presentation and fullscreen controls.
- The action immediately enters a clean table layout and attempts browser
  fullscreen. App chrome, navigation, utility bars, and Player toolbars are
  hidden so the projected screen is reserved for play.
- The clean layout retains one unobtrusive **Restore normal view · Esc** control.
- A denied or unavailable fullscreen request is not an error state. The Player
  remains in the same clean in-page table mode and card play continues without
  interruption.
- Restoring normal view returns the ordinary Player chrome and controls without
  changing the board, trick, visibility choices, or play history.

## Compact AI Coach

- AI Coach has returned only as a small, manual **Nudge me** aid. The former
  large Coach modal and notebook remain retired from live bidding and play.
- During bidding the Coach sits below the auction, beside South's hand and the
  bidding controls. During play it occupies the free lower-left table rail. Its
  answer scrolls inside a bounded card and never expands over the learner's
  cards or the central trick.
- The control appears only when the learner has a real decision. It is hidden
  while North, East or West bids automatically, during the recorded-auction
  comparison, while a computer plays, at the contract checkpoint, and while a
  completed trick is settling.
- When North is declarer and the table rotates, the Coach follows the
  learner-facing North perspective. It can still discuss a decision made from
  exposed dummy without treating dummy as hidden information.
- Every paid request requires a button press. There is no automatic polling or
  background AI coaching.
- Live nudges target about 35–45 words: one public observation and one bridge
  principle or thinking question. They must not name the final bid or card.
  **Explain principle** is an optional second, separately metered request.
- An unsigned visitor sees one compact offer per browser: **£10 per month, up
  to 100 AI-assisted deals**, with Contact Mark and Sign in actions. After it is
  dismissed, only a small locked Coach pill remains. Sales prompts are hidden
  from clean presentation mode.
- The bridge player itself remains public and free. A failed Coach access check
  must not block bidding, card play, replay or presentation.

## AI access and spending policy

- `OPENAI_API_KEY` remains server-side in Netlify Functions and must never use a
  `VITE_` prefix or enter the browser bundle.
- `COACH_ENABLED=true` is the explicit, fail-closed kill switch. Omitting it or
  setting it to another value disables paid generation.
- Keep `COACH_TRIAL_ENABLED=false`. The old anonymous signed-cookie trial route
  remains closed and is not used by the compact Player.
- Owner access requires an authenticated Netlify Identity subject, the
  server-managed `coach-owner` role, and an exact match with
  `COACH_OWNER_EMAIL`. Request-time checks use the authenticated subject rather
  than the optional `confirmedAt` profile field, which is absent from Netlify's
  verified JWT fallback shape.
- Subscriber access requires an authenticated Identity subject, the
  server-managed `coach-subscriber` role, and a separate active entitlement
  keyed by the immutable Identity user ID. The complete admin record must show
  a confirmed email before that entitlement is granted. A role or email address
  alone is insufficient.
- Subscriber entitlements are initially granted manually after payment. Each
  entitlement stores its own start and end time, plan, limits and audit fields.
  Payment-provider automation is deliberately deferred.
- The subscriber allowance is 100 client-identified AI-assisted deals per
  entitlement period, at most 20 paid generation attempts per deal, and no more
  than 2,000 paid attempts across the whole period. A deal begins on its first
  provider-dispatched attempt, not when a PBN is loaded. Replaying the same deal
  in the same period does not consume another deal.
- The browser derives a SHA-256 fingerprint from the canonical 52-card deal,
  dealer and vulnerability. The fingerprint is used only for metering and is
  stripped before model input is built. The model continues to receive only
  the learner-visible/public context.
- Durable entitlement and usage records use a strong-consistency Netlify Blobs
  store with conditional writes. Concurrent requests cannot admit deal 101,
  paid attempt 21 on one deal, or paid attempt 2,001 in one period. The ledger
  records dispatch before calling the provider, so errors, aborts and receipt
  failures cannot silently erase potential cost. They do not increase the
  separate successful-response count.
- Owner calls also use durable Blobs metering: at most 80 paid attempts in a
  rolling hour and 2,000 per UTC calendar month. Warm-instance request
  throttles, the immediate kill switch and OpenAI project spend limits remain
  additional backstops. The app's usage estimate is helpful; the OpenAI Usage
  dashboard remains authoritative for provider billing.
- Client-generated deal identity is suitable for the current invited and
  manually trusted cohort. A determined technical user could falsify local deal
  input, so a larger commercial service should move to server-issued play
  sessions before claiming fraud-resistant deal accounting.

### Competition replay and Coach access

- The `/competitions` catalogue, complete replay flow and published expert-score
  comparison are free. They do not require Coach access.
- At eligible bidding and card-play decisions, competition boards use the same
  compact, manual Coach control as other PBNs. There is no large Coach modal and
  no automatic AI generation.
- An unauthorised visitor sees the normal small contact/sign-in offer. Only a
  signed-in owner or subscriber with active Coach access can make a model call;
  the ordinary usage limits and metering apply.
- Source attribution remains visible independently of Coach access. Keeping the
  replay free is not a substitute for checking redistribution permission.

### Cost envelope at the September 2026 launch price

- The selected model is `gpt-5.6-luna`, using the Responses API with reasoning
  disabled for quick, economical nudges. Current text pricing is $0.20 per
  million input tokens, $0.02 cached input, $0.25 cache writes and $1.20 output.
- The absolute product allowance is 2,000 paid generation attempts per
  subscriber period: 100 client-identified deals multiplied by 20 attempts.
  Provider failures remain inside this ceiling, so retries cannot increase the
  worst-case model-call count.
- At an intentionally cautious 4,000 input and 240 output tokens for every
  response, provider cost is about $2.18, or £1.81 at $1.20/£1. Adding a 15%
  contingency gives an AI budget of about £2.09 per fully used subscription.
- If the £10 customer price includes 20% VAT, net revenue is £8.33. After the
  cautious £2.09 AI budget and an illustrative £0.50 payment-processing reserve,
  the contribution is about £5.74 per subscriber period before Netlify usage,
  support, tax and other overhead. This supports a positive model-cost margin,
  but it is a planning estimate rather than accounting or tax advice.
- Set an OpenAI project budget of roughly $3 per fully used subscriber-month,
  plus a separate small allowance for owner testing, and review real token use
  before automating sales.

## Deferred work

- Expand the guided bidder progressively with tested ACOL competitive auctions, rebids, opener continuations, doubles, and convention choices.
- Continue simplifying restart and replay for both the auction and the hand.
- A future post-game Coach workspace may use the full screen, complete public play
  history, trick-by-trick navigation, and separate perspectives for declarer
  and defence.
- Add a simple owner UI for inviting accounts and granting or revoking the
  already-supported durable entitlements.
- Add a hosted payment flow and verified webhook only after the manually managed
  £10 service has proved useful. Do not grant access from an unverified browser
  payment return alone.
- If a complimentary trial returns, move it to verified email before launch.
  A browser cookie is not proof of one use per person because it can be cleared
  or replaced on another device.

## Verification commands

Run from `ralph-react`:

```bash
node --test src/player-v2/playerV2Reducer.test.js src/player-v2/acolPracticeBidder.test.js
npm run test:coach
npm run test:generator2
npm run build
```
