# AI Coach server

The bridge player remains public and free. AI generation is an optional,
account-only service implemented by Netlify Functions:

- `POST /api/coach` — generate an authenticated Coach response.
- `GET /api/coach/access` — return safe client-facing availability and allowance state.
- `GET /api/coach/entitlements` — owner-only list or lookup of manual entitlements.
- `POST /api/coach/entitlements` — owner-only grant or revoke operation.
- `POST /api/coach/trial` — retired endpoint; always returns `410 trial_retired` after
  its method and same-origin checks.

No route calls OpenAI unless `COACH_ENABLED` is exactly `true`. Omitting the
variable, setting it to any other value, or removing the API key fails closed.
This server layer may therefore remain deployed while Coach controls are absent
from the Player UI.

## Netlify setup

Set these environment variables in **Project configuration > Environment
variables**:

- `COACH_ENABLED=true` — explicit paid-generation switch. Set it to `false` for
  the immediate kill switch.
- `OPENAI_API_KEY` — server-side API key. Never add a `VITE_` prefix or expose it
  to browser code. Prefer a write-only, Functions-scoped secret when the Netlify
  plan supports that scope.
- `COACH_OWNER_EMAIL` — the exact confirmed Identity email allowed to administer
  entitlements and use owner access.
- `COACH_CONTACT_EMAIL` — optional public contact address returned by the access
  route.

The retired endpoint ignores `COACH_TRIAL_ENABLED`, `COACH_TRIAL_SECRET`, and
`COACH_TRIAL_DAILY_CAP`. They can be removed from Netlify. In particular, a stale
`COACH_TRIAL_ENABLED=true` value cannot reactivate anonymous calls.

In Netlify Identity:

1. Enable Identity and use invite-only registration.
2. Invite the owner, wait for email confirmation, and assign the server-managed
   `coach-owner` role in `app_metadata.roles`.
3. Invite a subscriber and wait for email confirmation before granting an
   entitlement. The owner endpoint adds and removes the `coach-subscriber` role.
4. Sign out and back in after a role change so the Identity token refreshes.

Owner access requires all three checks: a confirmed Identity account, the
`coach-owner` role, and an exact `COACH_OWNER_EMAIL` match. Subscriber access
requires a confirmed account, the `coach-subscriber` role, and a separate active
durable entitlement keyed by the immutable Identity user ID. Neither a role nor
an email address alone grants subscriber access.

Also set a small OpenAI project spend limit and alert. Application limits reduce
accidental use; the provider limit is the final cost backstop.

## Coach request

The authenticated request shape is strict:

```json
{
  "intent": "nudge",
  "question": "What should I be thinking about?",
  "dealFingerprint": "64-lowercase-hex-characters-from-sha-256",
  "context": {}
}
```

`dealFingerprint` is the SHA-256 fingerprint of the canonical deal, dealer and
vulnerability. It is used only by the allowance ledger and is explicitly
stripped before the model request is built. `context` must pass the strict
learner-perspective allowlist; hidden hands, future auction calls and unknown
properties are rejected rather than forwarded.

Subscribers may request `nudge` and `explain`. The broader `compare` and
`remember` intents remain owner-only. A nudge is prompted to use about 35–45
words: one public observation followed by one bridge principle or thinking
question, without naming the final bid or card.

The response includes the safe Coach object plus:

```json
{
  "meta": {
    "model": "gpt-5.6-luna",
    "cached": false,
    "access": "subscriber",
    "usage": {
      "inputTokens": 0,
      "outputTokens": 0,
      "estimatedUsd": 0
    }
  }
}
```

The displayed estimate uses $0.20 per million uncached input tokens, $0.02 per
million cached input tokens, $0.25 per million cache-write tokens, and $1.20 per
million output tokens. The OpenAI Usage dashboard remains authoritative.

## Subscriber allowance

Each manual entitlement has a start, end, fixed 100 client-identified-deal
allowance, fixed 20-paid-call-attempts-per-deal allowance, a hard 2,000 paid-call
ceiling for the whole period, and audit fields. A grant may cover at most 35
days.

Usage is stored in the strongly consistent `ralph-coach-access` Netlify Blobs
store. Conditional writes reserve capacity before generation, so concurrent
requests cannot admit deal 101, paid attempt 21 for one deal, or paid attempt
2,001 for one period. Immediately before provider dispatch, the reservation is
durably changed to a paid attempt. Provider errors, client aborts and response
receipt failures therefore cannot erase potential provider cost; they do not
increase the separate successful-response counter. Only an unused pre-dispatch
reservation can be released. Stale dispatched requests are marked failed after
five minutes but remain counted. An identical completed request returns its
saved response without another paid call or allowance increment.

Replaying the same canonical deal uses the same deal fingerprint and therefore
still counts as one deal during that entitlement period. The browser-derived
fingerprint is suitable for a small invited cohort, but is not fraud-resistant:
a determined client could fabricate it. A larger commercial service should use
server-issued play sessions. Regardless of fabricated deal labels, the durable
2,000-attempt period ceiling bounds application-level subscriber exposure.

Owner calls use the same Blobs store for a durable ceiling of 80 paid attempts
in a rolling hour and 2,000 in a UTC calendar month. The warm-instance duplicate
guard and Netlify request limiter remain additional protections. Keep a strict
OpenAI project budget because provider-side spend control is the final backstop.

## Curated competition deals

Curated competition deals follow the same Coach access rules as every other
deal. A confirmed owner or a subscriber with an active entitlement may request
AI nudges; anonymous, unconfirmed and unentitled users cannot make paid calls.
The canonical deal fingerprint remains required and participates in the normal
per-deal allowance, so replaying a competition board does not consume a second
deal from the same entitlement period.

## Owner entitlement operations

These routes rely on the owner's existing Netlify Identity session and must be
called from the same site origin.

Grant a confirmed Identity user:

```json
{
  "action": "grant",
  "userId": "immutable-netlify-identity-user-id",
  "periodStart": "2026-09-01T00:00:00.000Z",
  "periodEnd": "2026-10-01T00:00:00.000Z",
  "note": "Manual subscription"
}
```

Revoke access:

```json
{
  "action": "revoke",
  "userId": "immutable-netlify-identity-user-id",
  "note": "Subscription ended"
}
```

Use `GET /api/coach/entitlements` to list records, or append an encoded
`?userId=...` to read one record and its current usage. Revocation changes the
durable record first, so access is denied even if Identity role cleanup must be
retried.

`GET /api/coach/access` returns only safe fields: `enabled`, `configured`,
`signedIn`, `access` (`owner`, `subscriber`, or `none`), `authorized`, optional
subscriber allowance data, optional `contactEmail`, and a retired-trial marker.
Every paid POST independently repeats authentication and entitlement checks.

Run focused tests with:

```sh
npm run test:coach-server
```
