# Frontend_Rumi_Build — Next.js 15 marketing site (lead offer: hire AI employees — five roles priced at ~10% of the workload they cover)

## It has a near-clone twin: `../Frontend_Rumi_AIEmployees`

Same design system — and since v1.0.0.0 this repo ALSO leads with AI Employees, so
the offer no longer tells the two repos apart. Identical `"name": "rumi-build"` in package.json,
same route and component names (`services/[slug]`, `nav.tsx`, `hero.tsx`, `llms.txt`).
`tailwind.config.ts` was byte-identical until v1.2.0.0: brand v2 landed here only, so this
repo's `navy` is `#0B1C36` and `surface` `#F9FAFB` while the twin still ships `#1E293B` /
`#FEFCF7` (`pnpm-lock.yaml` has drifted apart too). Never "resync" either file against the
twin — that reverts the brand. Different GitHub org, too:
`Rumi-team/…` here, `rumiai-ai/…` there. **Never port a change between them** — matching
filenames belong to separate sites.

## The domain: THIS REPO CURRENTLY SERVES NO DOMAIN

**Re-verified 2026-09-19 against the Vercel API, and it reverses what this
section used to say.** The old text ("one deployment, four hosts, one
canonical") described the world on 2026-08-05. It is no longer true, and acting
on it means shipping a fix to a project nobody visits.

What the Vercel API reports today (`list_project_domains`, which is the live
per-domain record — note that `get_project`'s own `domains` array is a stale
denormalized cache and still lists the old mapping, so do not trust it):

| Host | 308s to | Vercel project | Built from |
| --- | --- | --- | --- |
| `rumi.build` | `www.rumi.build` | `rumi-build` (`prj_c8X8nh8UyToR2ydd6vxfmfpRhosn`) | **not this repo** — see below |
| `www.rumi.build` | — | `rumi-build` | **not this repo** |
| `rumiai.ai` | `www.rumiai.ai` | `rumi-ai-website` (`prj_NFNLDqKUiZa9svVBQq9wSxgd5Ybz`) | `RumiAI-LLC/rumi_ai_website` |
| `www.rumiai.ai` | — | `rumi-ai-website` | `RumiAI-LLC/rumi_ai_website` |

**The project this checkout used to be linked to — `rumi-ai`
(`prj_DbGCHRJNYqm6K7D1NATKKNXldyI1`) — has zero domains attached.** The domain
records carry `updatedAt` of 2026-09-16, so the move is recent. There is also no
`.vercel/project.json` in this checkout any more, so nothing local says where a
`vercel deploy` from here would land.

The practical consequence, and the reason this section is now a warning rather
than a fact sheet: **a change merged and deployed from this repo changes nothing
that a customer can reach.** Confirm the current mapping before promising anyone
a deploy, and confirm it from `list_project_domains` rather than from this file
— this section has been wrong twice.

`www.rumi.build` is NOT this codebase. Its `/book` ships nav copy ("Request a
demo") that has never existed anywhere in this repo's git history, a navy nav
(this repo has shipped a white nav since v1.2.0.0), and no Stripe checkout at
all. It is the near-clone twin described above. Do not "fix" this repo expecting
that site to change, and do not port files between them.

### The canonical host, if this repo is ever deployed again

Unchanged as a code invariant: **`https://www.rumiai.ai`**, authored in exactly
one place — `metadataBase` in `src/app/layout.tsx` — with every per-page
canonical and `og:url` relative so it resolves through that. `sitemap.ts` BASE,
`robots.ts` and every URL in `lib/llms-content.ts` must agree, and
`tests/unit/self-reference.test.ts` walks all of `src/` and fails if any of them
drift (it derives the expected host from `metadataBase` rather than restating
it, so moving the site stays one edit). Note that that host is now served by a
different project, which is a question for whoever owns the redirect plan, not
something to silently re-point here.

Two deliberate exceptions, both pinned by that test: `SUPPORT_EMAIL` is still
`support@rumi.build` pending confirmation that an `@rumiai.ai` mailbox exists
(see TODOS.md), and `source: "rumi.build"` in `/api/checkout` is a frozen
analytics key, not a host.

## The offer, as shipped (v1.2.0.0)

The homepage leads with five hireable AI-employee roles — AI Receptionist (from
$300/mo), AI Executive Assistant (from $500/mo), AI Social Media Manager (from
$400/mo), AI Office Manager (from $800/mo) and AI Chief of Staff (from $900/mo).
Core roles are priced at exactly 10% of the monthly workload they cover (the
"90% less than hiring" badge); for the two bundles that rule is a ceiling, and a bundle's
workload must equal the sum of its parts. The agency work (website, app, content,
visibility) sells below as "Extra services". Canonical role data lives in
`src/lib/data.ts`; the long-form prose only the detail pages render lives in
`src/lib/ai-employee-details.ts` and `src/lib/vertical-details.ts` — never import
those back into `data.ts` (`footer.tsx` puts everything reachable from `data.ts`
into every page's client bundle).

The one paid call is sold on `/book` in two lengths — 30 minutes at $75 (the
default) or 60 at $125 — chosen with a radio group on the form. `CALL_OPTIONS`
in `src/lib/stripe.ts` is where both prices are **authored**, along with both
Stripe price-id env vars (`STRIPE_PRICE_ID_30MIN`, `STRIPE_PRICE_ID_60MIN`),
each option's `minutes`, and the Cal.com event it books. `/book` and its form
contain no dollar literal at all and read the catalog live; `/faq` and
`src/lib/llms-content.ts` do restate the figures for prose reasons, and are
pinned to the catalog by the "states both lengths and both prices" test in
`tests/unit/price-copy.test.ts` — so a reprice is `src/lib/stripe.ts` plus
whatever that test then turns red. Price ids are read from the environment and
must never be hardcoded. An option whose price id is unset is not offered on
`/book` at all — unless NO option has one, in which case `/book` shows the whole
catalog and `/api/checkout` owns the refusal.

Each length now books its own Cal.com event type, both hardcoded in
`src/lib/data.ts` (`CAL_LINK` = `rumi-ai/call-30min`, `CAL_LINK_60MIN` =
`rumi-ai/discovery-call-60min`) and pinned by `tests/unit/cal-link.test.ts`.
`NEXT_PUBLIC_CAL_LINK_60MIN` is no longer read by anything. The
email-you-times fallback on `/book/success` is still live code for a length
whose `calLink` is `""`, but no configuration reaches it today. **A Cal.com
rename is a production incident**: Cal.com issues no redirect, so renaming the
handle or an event slug 404s the post-payment calendar until `data.ts` is
edited and deployed. It has happened twice — see TODOS.md.

Languages are English + Farsi, translated client-side in `src/lib/i18n.tsx`
(homepage only; every other page is English, pinned LTR via
`src/components/english-main.tsx`). `/evaluate`, `/audit`, `/chief-of-staff` and
`/pricing` are permanent redirects — do not resurrect them; `/api/evaluate` is
gone entirely.

Releases carry a 4-digit version: `VERSION`, `package.json` and the newest
CHANGELOG.md heading must agree (currently 1.2.2.0). The other docs: DESIGN.md
(locked brand system — Saba owns it), TESTING.md (the test contract), TODOS.md
(deferred work), CHANGELOG.md (release history).

## Testing

```bash
pnpm test        # vitest run  — unit + component, ~2s
pnpm test:e2e    # playwright  — builds the site, serves :3311, drives chromium
pnpm test:all    # both
```

Tests live in `tests/unit/` (Vitest + Testing Library, jsdom) and `tests/e2e/`
(Playwright, chromium only). Read **TESTING.md** before adding to either — it explains the
six invariants the suite exists to pin down (EN/FA parity including array lengths,
slug referential integrity, the pricing arithmetic — 10% of workload, a ceiling for
bundles — the tone rule, the locked design tokens, and the routing/canonical rules)
and the conventions (walk the data, never restate it; guard the walkers;
`toBeDefined()` is banned).

Expectations for any change here:

- Write a test with each new function or data helper.
- Write a regression test with each bug fix — the failing case first.
- Cover both branches of every new conditional.
- Never commit code that breaks existing tests. If a test fails because the production code
  has a real bug, leave the test red and say so; do not edit `src/` to make it pass, and
  never edit `tailwind.config.ts` or `src/app/globals.css` (locked design system).
