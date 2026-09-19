# TODOS

## Booking / Cal.com

### P0 — the LIVE booking funnel on www.rumi.build is 404ing, and it is not this repo
**Found 2026-09-19.** `https://www.rumi.build/book` serves a Cal.com inline embed
pointed at **`rumi-app/30-min-meeting`** — both halves of which were renamed away on
2026-08-05 (`rumi-app` → `rumi-ai`, `30-min-meeting` → `call-30min`). Cal.com issues
no redirect, so that page renders "Error Code: 404. Cal Link seems to be wrong."
That page also takes **no payment at all** — it is a bare "Book a 30-minute call"
demo page with no Stripe.

That deployment is **not built from this repo** (see CLAUDE.md): its nav says
"Request a demo", which has never appeared in this repo's history. Fixing it means
working in the twin, `rumi-inc/Frontend_Rumi_AIEmployees` → Vercel project
`rumi-build`. Nothing in *this* repo can fix it, and this repo currently serves no
domain.

Corroborating evidence that the funnel has been dead for weeks: Cal.com has sent
exactly **one** booking confirmation since 2026-08-01 (on 2026-08-05), and it was for
a **"15-min discovery call"** — not for `call-30min` or `discovery-call-60min`.

### P0 — nobody has verified that `call-30min` and `discovery-call-60min` resolve
`src/lib/data.ts` hardcodes `rumi-ai/call-30min` and `rumi-ai/discovery-call-60min`.
Both were added on 2026-08-05 and **no booking has ever arrived on either one.** The
only event Cal.com has actually confirmed bookings for is a 15-minute discovery call,
whose slug is not in this repo at all.

These may be correct and simply unused, or they may be a third dead rename. It cannot
be settled from an agent session — cal.com is blocked by the org egress proxy — so it
has to be checked by hand against the Cal.com dashboard: open `https://cal.com/rumi-ai`
and read off the live event slugs. **Do not deploy a guessed slug**: the page it lands
on is `/book/success`, reached only after a card is charged.

Partly mitigated as of this change: `CalEmbed` now listens for Cal.com's `linkFailed`
event and renders a recovery block (direct link + `support@rumi.build`) instead of
Cal's raw 404, so a dead slug no longer strands a paying customer with nothing to
click. That handles the symptom; it does not make the slug right.


### ~~Create the 60-minute Cal.com event type~~ — DONE 2026-08-05
`rumi-ai/discovery-call-60min` exists, and `CAL_LINK_60MIN` in `src/lib/data.ts` names it, so a $125 buyer now gets a 60-minute calendar on `/book/success` instead of the email-you-times fallback. That fallback is still live code for the case where a length has no event type — it just has no configuration reaching it today.

The slug is **hardcoded, not read from `NEXT_PUBLIC_CAL_LINK_60MIN` any more.** The env var existed because the event did not, so `""` was the honest value; it bought nothing else, because `NEXT_PUBLIC_*` is inlined at build time and changing it still required a redeploy. In the repo it is version-controlled and covered by `tests/unit/cal-link.test.ts`.

### Split the free intro call from the paid strategy call
**Priority:** P1 — the last half of this still open
`/schedule` and the post-payment `/book/success` both book `rumi-ai/call-30min`, so the calendar cannot tell a paid booking from an invited one and `/schedule` remains a guessable no-payment path to the call `/book` charges $75 for. Fix: create a third event type for the invited intro call, add an `INTRO_CAL_LINK` constant, and point `/schedule` at it.

The old free event (`rumi-ai/30-min-meeting`, described "Free 30-min call") was **replaced** on 2026-08-05 rather than kept, so there is no intro event to point at right now — it has to be created before this can be closed.

**CAL.COM RENAMES ARE PRODUCTION INCIDENTS.** Twice on 2026-08-05 a dashboard rename 404'd a live slug with no redirect: the account handle (`rumi-app` → `rumi-ai`), then the event type (`30-min-meeting` → `call-30min`). Both times the page that broke was `/book/success`, reached only *after* a card is charged. Nothing offline can catch the next one. Change a slug and deploy the matching `src/lib/data.ts` edit in the same sitting.

### Add the two call columns to the retention API
**Priority:** P2 (was P1 — no longer able to break the money path)
`src/app/api/stripe/webhook/route.ts` sends `call_duration` (`"30min"` / `"60min"`) and `call_minutes` (a number) on the `customers/by-session/{id}` upsert, so the CRM can tell a $75 booking from a $125 one. If that endpoint validates strictly it answers 4xx, and the handler now **retries once without those two keys** rather than throwing — the paid status lands either way, and the rejection is logged as "rejected the call fields". So this is no longer a release blocker; it is a data gap. Add the two columns (or confirm unknown fields are ignored) and the retry stops firing. Both keys are sent only when present, so replayed pre-1.1.0.0 sessions are unaffected. Covered by `tests/unit/stripe-webhook.test.ts`.

## Deploy / Vercel

### Set the new env vars, then clean up the dead ones
**Priority:** P0 for the additions, P1 for the cleanup
Add to the Vercel project before v1.1.0.0 goes live:
- `STRIPE_PRICE_ID_60MIN` — the Stripe Price id for the $125 / 60-minute call (create the Price in Stripe first, in **both** test and live mode). Without it the 60-minute option is not offered on `/book` at all, and `/book/success` refuses to verify a 60-minute session.
- `STRIPE_PRICE_ID_30MIN` — **reused, but repriced.** The 30-minute call was repriced to $75, so the existing Price object is now wrong. Create a new $75 Price in Stripe and repoint this variable; do not edit the old one. Because the *name* is reused, an un-repointed variable is still a valid id that keeps charging the old figure — `/book/success` now refuses such a session (reason `mismatch`) and the webhook logs it, so the symptom is a customer told "this payment doesn't match what we charge" and a log line naming this variable.
- ~~`NEXT_PUBLIC_CAL_LINK_60MIN`~~ — no longer read by anything. The 60-minute slug is hardcoded in `src/lib/data.ts` (see above). Safe to delete from the Vercel project if it was ever set; it is inert either way.

Still to remove: `RESEND_API_KEY`, `EVALUATION_TO`, `EVALUATION_FROM` are dead since `/api/evaluate` was deleted (v1.0.0.0). `NEXT_PUBLIC_SITE_URL` is set on the Vercel project (`https://www.rumiai.ai`, 2026-08-05) and the code no longer falls back to a hardcoded host: `getSiteUrl()` in `src/lib/stripe.ts` fails closed — `/api/checkout` answers 503 and the log names the variable — instead of returning a paid buyer to an origin nobody configured. (Not "to the sibling site" — that was the original diagnosis and it was wrong: rumi.build is an alias of *this* deployment. Corrected in the `getSiteUrl` doc comment.) Keep it set; `NEXT_PUBLIC_*` is inlined at build time, so changing it requires a redeploy, not just an env edit.

### Confirm the `@rumiai.ai` support mailbox, then move `SUPPORT_EMAIL`
**Priority:** P2
The canonical host moved to `https://www.rumiai.ai` (v1.2.0.0 → this change), but `SUPPORT_EMAIL` in `src/lib/data.ts` is still `support@rumi.build`, and so are the twelve literals that spell it out in the footer, Terms, Privacy, the SMS consent clause, `/book/success` and `lib/llms-content.ts`. That was deliberate: both domains have Google Workspace MX records, but MX proving mail is *routed* is not the same as a `support@rumiai.ai` mailbox being *read*, and this address is what `/book/success` shows a customer whose payment could not be verified. A branding mismatch is cheaper than a bounced email at that moment.

To close it: confirm someone reads `support@rumiai.ai`, then change `SUPPORT_EMAIL` alone and run `pnpm test` — `tests/unit/self-reference.test.ts` derives the expected mailbox from that constant, so it will fail listing every literal still on the old domain. Better still, delete the literals and import the constant. The `rumi.build` mailbox should keep forwarding either way; it is an alias of the same site, not a dead domain.

### There is no tracked `.env.example`
**Priority:** P2
`git ls-files | grep env` returns nothing, despite CHANGELOG line 36 claiming ".env.example stays tracked". Nothing in the repo tells a deployer that `STRIPE_PRICE_ID_30MIN`, `STRIPE_PRICE_ID_60MIN` or `NEXT_PUBLIC_CAL_LINK_60MIN` exist — they are discoverable only by reading `src/lib/stripe.ts` and `src/lib/data.ts`. Add one (price ids and Cal slugs are not secrets; keys stay out of it).

### Smoke-test the edge redirects after deploy
**Priority:** P2
The 26 `vercel.json` redirects run only at the Vercel edge — `next start`/Playwright never exercise them. After the next production deploy, run a `curl -sI` matrix over the legacy URLs (`/pricing`, `/sprint`, `/deposit`, `/automation`, `/evaluate`, `/audit`, `/chief-of-staff`, old `/services/*` slugs) and confirm one-hop 308s to live pages.

## Design (awaiting Saba — DESIGN.md Decisions Log has details)

### Rule on the open WCAG item and deferred visual calls
**Priority:** P2
Open set from the v1.0.0.0 review, all logged in DESIGN.md: `.eyebrow` accent-on-white contrast (3.77:1 at 11px, ~29 sites — globals.css is locked); hover-state contrast dip on navy links (partly mooted in v1.2.0.0: the nav is white now and its hover/active states moved to accent-hover, which passes AA; footer hover-accent on the deeper v2 navy now measures 4.52:1 — passing, but with 0.02 margin); emoji icons vs accent-colored icon set on the role cards; sign-off on the new homepage section order and background assignments. (FA badge letter-spacing on joined Persian script was fixed in v1.2.0.0 — the badge drops tracking under html[lang=fa].)

## i18n

### Decide whether Farsi extends beyond the homepage
**Priority:** P3
The homepage is fully translated EN/FA; `/services` and the role pages are English pinned LTR (deliberate, documented in `services/page.tsx`). The real fix, if Farsi is a supported locale for the offer pages, is locale-routed pages (`/fa/...`) with per-locale dictionaries — also resolves the first-paint language flash (language restore is a post-hydration effect).

## Completed

### Swap the hardcoded `rumi.build` canonical URLs to `www.rumiai.ai`
**Completed:** v1.2.2.0 (2026-08-05)
`metadataBase` in `src/app/layout.tsx`, `BASE` in `src/app/sitemap.ts`, the sitemap URL in `src/app/robots.ts` and all fourteen URLs in `src/lib/llms-content.ts` now name `https://www.rumiai.ai`; per-page canonicals are relative and follow `metadataBase`, and the built output was checked to confirm zero `rumi.build` URLs ship.

Two premises in the original entry turned out to be wrong, and the deferral was reversed on that basis. The twin repo does **not** own rumi.build: this one deployment answers on all four of `rumiai.ai`, `www.rumiai.ai`, `rumi.build` and `www.rumi.build`, verified by fetching both `www` hosts and getting byte-identical HTML carrying this repo's own build markers. So the old canonicals were never "pointing search engines at the sibling site" — they named another alias of the same site, which is why nothing ever failed. That made the swap a branding choice rather than a bug fix, and it was approved once the aliasing was clear.

`SUPPORT_EMAIL` stayed behind deliberately — see the open mailbox item above. Drift is now pinned by `tests/unit/self-reference.test.ts`, and CLAUDE.md's stale "Nothing local says which domain this deploys to" section was rewritten in the same change.
