import { describe, expect, it } from "vitest";
import {
  CAL_LINK,
  CALENDLY_URL,
  CAL_LINK_60MIN,
  CALENDLY_URL_60MIN,
  calUrlFor,
} from "@/lib/data";

// ── Why this file exists ──────────────────────────────────────────────────────
// On 2026-08-05 the Cal.com profile username was renamed from `rumi-app` to
// `rumi-ai` in the Cal.com dashboard. Cal.com does not redirect the old handle,
// so https://cal.com/rumi-app/30-min-meeting started answering 404 the instant
// it changed — and CAL_LINK, a string in this repo, still said `rumi-app`.
//
// The page that broke is /book/success: the one a customer sees AFTER their
// card has been charged. They paid, landed on "One last step — pick your time",
// and the calendar had nothing to render.
//
// NOTHING HERE CAN CATCH THAT, and it is worth being honest about why: the
// username half of this slug lives in someone else's dashboard, and no offline
// assertion can know it was renamed. Only a live request to cal.com can, and
// this suite does not make network calls.
//
// What these cases DO catch is the class of mistake that made the rename worse
// than it had to be: two independent literals holding the same slug, so a fix
// applied to one and missed on the other sends the inline embed and the
// open-in-a-new-tab link to different calendars. CALENDLY_URL is derived from
// CAL_LINK now, and the first case is what stops anyone un-deriving it.

const CAL_HOST = "https://cal.com/";

describe("the Cal.com slug has one source", () => {
  it("derives the full URL from the slug rather than restating it", async () => {
    // Pins the derivation itself. Written as a composition rather than a
    // literal so it keeps holding through the next rename: the point is that
    // the two agree, not what today's slug happens to be.
    expect(CALENDLY_URL).toBe(`${CAL_HOST}${CAL_LINK}`);
  });

  it("derives the 60-minute URL the same way, or leaves both empty together", async () => {
    // Both branches are asserted even though only the non-empty one executes
    // today: CAL_LINK_60MIN is a hardcoded slug now, not env-sourced, so ""
    // is a state the code still supports but no configuration reaches. Kept
    // because half-empty is what would actually hurt — a link to
    // "https://cal.com/" is a live URL pointing at nothing in particular.
    if (CAL_LINK_60MIN === "") {
      expect(CALENDLY_URL_60MIN).toBe("");
    } else {
      expect(CALENDLY_URL_60MIN).toBe(`${CAL_HOST}${CAL_LINK_60MIN}`);
    }
  });
});

/**
 * Every booking slug that is actually configured, labelled so a failure names
 * WHICH constant is malformed rather than just printing a bad string.
 *
 * EVERY case below walks this, not CAL_LINK alone. The shape checks used to
 * inspect only the 30-minute slug while the dead-handle check walked both,
 * which made the file read as though it covered the pair — so a malformed
 * CAL_LINK_60MIN (a full URL, an extra path segment, an uppercase character)
 * would have stayed green and reached CalEmbed after a $125 purchase. The
 * more expensive of the two products had the weaker guard.
 *
 * Filtered because "" is a supported state for a length with no event type;
 * every caller re-guards the filtered length, because a filter that empties
 * silently turns its case into zero assertions (TESTING.md, "guard the walkers").
 */
function configuredSlugs(): Array<[string, string]> {
  const all: Array<[string, string]> = [
    ["CAL_LINK", CAL_LINK],
    ["CAL_LINK_60MIN", CAL_LINK_60MIN],
  ];
  return all.filter(([, slug]) => slug !== "");
}

/** Fails loudly when the filter above leaves nothing to assert against. */
function guardedSlugs(caseName: string): Array<[string, string]> {
  const slugs = configuredSlugs();
  expect(
    slugs.length,
    `every booking slug is empty — "${caseName}" asserted nothing`
  ).toBeGreaterThan(0);
  return slugs;
}

describe("the Cal.com slug is shaped like a slug", () => {
  it("is a bare username/event pair, not a URL", async () => {
    // CalEmbed interpolates these into https://cal.com/<slug>. A value that
    // already carried the scheme would build "https://cal.com/https://cal.com/…"
    // — a 404 that looks like a typo in the calendar, not in the code.
    for (const [name, slug] of guardedSlugs("bare username/event pair")) {
      expect(slug, `${name} carries a scheme`).not.toMatch(/^https?:\/\//);
      expect(slug.startsWith("/"), `${name} has a leading slash`).toBe(false);
      expect(slug.endsWith("/"), `${name} has a trailing slash`).toBe(false);
    }
  });

  it("names exactly one username and one event type", async () => {
    for (const [name, slug] of guardedSlugs("one username and one event type")) {
      const parts = slug.split("/");
      expect(parts, `${name} is "${slug}" — expected "<username>/<event>"`).toHaveLength(2);
      const [username, event] = parts;
      expect(username.length, `${name} has an empty username`).toBeGreaterThan(0);
      expect(event.length, `${name} has an empty event slug`).toBeGreaterThan(0);
      // Cal.com handles and event slugs are lowercase kebab. An uppercase or
      // space-carrying value survives every check above and still 404s.
      expect(username, `${name}'s username is not lowercase kebab`).toMatch(/^[a-z0-9-]+$/);
      expect(event, `${name}'s event slug is not lowercase kebab`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("does not point at anything Cal.com has already 404'd", async () => {
    // The one place that names literals, deliberately. These are not stale
    // values we might reasonably return to — they are URLs Cal.com now answers
    // 404 for, and re-introducing either takes the post-payment calendar down.
    // Both were verified dead by hand on 2026-08-05, the day each was replaced.
    const DEAD = [
      "rumi-app", // the account handle, renamed to rumi-ai
      "30-min-meeting", // the event type, replaced by call-30min
    ];
    for (const [name, slug] of guardedSlugs("dead-handle check")) {
      for (const dead of DEAD) {
        expect(
          slug.split("/"),
          `${name} is "${slug}", which contains "${dead}" — Cal.com no longer resolves it`
        ).not.toContain(dead);
      }
    }
  });

  it("gives the two lengths different event types", async () => {
    // A 30-minute slot booked against a 60-minute purchase looks like it
    // worked and is discovered by the customer, on the call. price-copy.test.ts
    // checks this off CALL_OPTIONS; this checks the constants those read from,
    // so a copy-paste while wiring a new event type fails here first.
    if (CAL_LINK_60MIN !== "") {
      expect(CAL_LINK_60MIN).not.toBe(CAL_LINK);
      expect(CALENDLY_URL_60MIN).not.toBe(CALENDLY_URL);
    }
  });
});

describe("calUrlFor", () => {
  // The helper both constants and CalEmbed's recovery link now read through, so
  // the embed and the escape hatch beside it cannot name different calendars.
  it("builds the public Cal.com URL for a slug", async () => {
    expect(calUrlFor("someone/a-call")).toBe("https://cal.com/someone/a-call");
  });

  it("returns the empty string for a length with no event type", async () => {
    // The branch that matters. "https://cal.com/" is a LIVE url — it serves
    // Cal.com's own page, not a 404 — so a naive concatenation hands someone
    // who has paid a link that looks like it worked and books nothing.
    expect(calUrlFor("")).toBe("");
  });

  it("is what both exported URLs are derived from", async () => {
    expect(CALENDLY_URL).toBe(calUrlFor(CAL_LINK));
    expect(CALENDLY_URL_60MIN).toBe(calUrlFor(CAL_LINK_60MIN));
  });
});
