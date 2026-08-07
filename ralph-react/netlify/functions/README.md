# AI Coach server

The ordinary bridge player remains public. AI access is isolated behind these server routes:

- `POST /api/coach` — existing private owner endpoint.
- `POST /api/coach/trial` — one anonymous, real AI nudge per signed browser cookie.
- `GET /api/coach/access` — safe client-facing owner/trial availability summary.

The owner endpoint does not call OpenAI unless all of the following pass first:

1. Netlify Identity has authenticated the request.
2. The Identity user has the server-controlled `coach-owner` role.
3. `COACH_OWNER_EMAIL` is configured and the signed-in email matches it.
4. The submitted learner context passes the strict allowlist.

The schema supports learner seat North or South for rotated declarer control. The legacy `south-acol-12-14-safe-v1` profile remains South-only; new dynamic contexts use `learner-acol-12-14-safe-v2`. Profile seat, perspective seat, first known hand, auction turn marker, and visible-contract role must agree.

Both generation routes use `gpt-5.6-luna` through the OpenAI Responses API with no reasoning effort, low verbosity, structured output, a short output cap, and `store: false`.

## Netlify setup

- In **Project configuration > Identity**, enable Identity.
- In **Identity > Registration > Registration preferences**, select **Invite only**.
- In **Identity > Users**, invite the owner's email address.
- Open that Identity user, choose **Edit settings**, and add the role `coach-owner`. Roles belong in server-controlled `app_metadata.roles`, never `user_metadata`.
- Store `OPENAI_API_KEY` in the project's environment variables. Do not use a `VITE_` prefix; the browser must never receive this key.
  - On Pro, prefer a write-only secret limited to the **Functions** scope.
  - On Personal/Free, Netlify does not permit that Functions-only secret scope. The no-upgrade option is a standard site environment variable, ideally with a **Production** value only. It remains outside the source and browser bundle, but Netlify team owners can read it, so use this option only after accepting that trade-off.
- Add `COACH_OWNER_EMAIL` with the same owner email as a required second check. The endpoint remains disabled if this is missing. Although the parser supports a list, use one address to keep this feature owner-only.
- Anonymous trial settings are separate and fail closed:
  - `COACH_TRIAL_ENABLED=true` explicitly enables real anonymous calls. Set it to `false` for the immediate kill switch.
  - `COACH_TRIAL_SECRET` must be a random secret of at least 32 characters. Store it as a Functions-scoped secret when the plan allows. Rotating it invalidates existing trial cookies and therefore resets their browser identity.
  - `COACH_TRIAL_DAILY_CAP` is optional and defaults to `20`. Accepted values are 1–250. This is a durable UTC-day cap across all anonymous browsers.
- After changing a role, sign out and sign back in so the refreshed Identity token includes it.
- In the OpenAI project that owns this key, set a small monthly spend limit/alert and restrict model usage to the Coach model where available. This is the provider-level backstop if the owner account or key is ever compromised.

The repository-root `.env` is for local development only and is ignored by Git. Netlify does not receive that file: production values must be entered separately in the Netlify project environment. Verify the complete invitation and role flow on a Netlify preview before promoting it to production.

For a local UI review without authentication or paid calls, run Vite and open:

```text
http://127.0.0.1:5173/player?coach-preview=1
```

This development-only preview enables free local facts but deliberately disables every paid button. The query parameter cannot bypass production authentication or the server endpoint.

## Private owner request and response

The request is:

```json
{
  "intent": "nudge",
  "question": "What should I be thinking about?",
  "context": {}
}
```

Accepted owner intents are `nudge`, `explain`, `compare`, and `remember`. `context` must be produced by the coach context builder; unknown properties, mismatched learner seats, and altered safety/profile values are rejected rather than passed to the model.

The response is:

```json
{
  "coach": {
    "message": "…",
    "concept": "…",
    "certainty": "known",
    "factsUsed": [],
    "suggestedChecks": []
  },
  "meta": {
    "model": "gpt-5.6-luna",
    "cached": false,
    "usage": {
      "inputTokens": 0,
      "outputTokens": 0,
      "estimatedUsd": 0
    }
  }
}
```

Repeated identical requests are coalesced and cached briefly. Netlify also limits the route to 12 requests per minute for each IP/domain combination. A warm-instance limit of 12 new calls per minute and 80 per hour protects against double-clicks and accidental loops. These are cost backstops; the Identity owner role and exact-email check are the primary protection.

The player counts every AI request it dispatches and shows the cost estimate returned by completed responses. A cancelled browser request can still have started upstream, so the OpenAI Usage dashboard remains the authoritative spending record.

## Anonymous one-nudge trial

The trial accepts only this shape:

```json
{
  "intent": "nudge",
  "context": {}
}
```

Free-form `question`, `explain`, `compare`, and `remember` requests are rejected. Automatic coaching must not call the trial route. It uses the same strict learner-perspective and spoiler-safety validation as the owner route, with a smaller output cap.

On first use, a valid cookie-less POST only issues a HMAC-signed `__Host-ralph-coach-trial` cookie and returns `428 trial_cookie_required`; it does not reserve a trial or call OpenAI. The client helper transparently repeats the same request once after the browser has stored the cookie, so this remains one click in the UI. The cookie uses `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and no `Domain`. Only a hash of its random identifier becomes a ledger key; neither the OpenAI key nor the signing secret reaches the browser.

After that handshake, the site-scoped `ralph-coach-trials` Netlify Blobs store uses strong consistency and conditional writes. It atomically reserves the shared signed-cookie identity before calling OpenAI, so concurrent requests carrying that cookie can start at most one generation. Parallel cookie-less handshakes themselves perform no paid work. A completed identical retry can return its saved spoiler-safe response without another paid call. A failed upstream attempt remains consumed because a timeout may already have incurred provider cost. Completion writes also retry conditional conflicts; if the one-use receipt still cannot be saved, the route reports `trial_completion_failed` instead of silently returning success and reconciles the reservation to a consumed state where possible.

Cost backstops are layered:

- Four trial-endpoint requests per minute for each Netlify IP/domain bucket, allowing the no-cost handshake plus one generation while still bounding retries.
- One atomic reservation for each valid browser cookie.
- Durable `COACH_TRIAL_DAILY_CAP` across all trial visitors.
- `COACH_TRIAL_ENABLED=false` immediately disables new trial calls after the environment change is deployed.
- The OpenAI project model/rate/spend limits remain the final provider-level backstop.

Response errors are machine-distinguishable. `trial_cookie_required` is the no-cost handshake response normally absorbed by the client helper. `trial_used` returns `409` with `accessRequired: true`; `trial_in_progress`, `trial_daily_cap`, `trial_disabled`, `trial_completion_failed`, and configuration/provider failures use separate codes. A successful trial response also returns `meta.trialUsed: true` and `meta.accessRequired: true`, allowing the UI to show sign-in immediately after the free response.

This is one free nudge per retained browser cookie, not a provable one per human. Clearing cookies, using a different browser/device, or rotating `COACH_TRIAL_SECRET` can produce a new anonymous identity. The daily cap bounds that unavoidable anonymous risk. A future paid rollout should require verified Identity login and store entitlements/credits against immutable Identity user IDs; access codes should be one-use server-side redemption tokens, not permanent browser secrets.

`GET /api/coach/access` returns only safe state such as `owner`, `access`, and trial availability. It never grants access: both POST routes repeat their full authorization or reservation checks.

Run focused tests with:

```sh
npm run test:coach
```
