// @vitest-environment jsdom
// Renders a component, so it needs a DOM (vitest.config.ts defaults to `node`).
import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalEmbed } from "@/components/cal-embed";
import { CAL_LINK, SUPPORT_EMAIL, calUrlFor } from "@/lib/data";

// ── Why this file exists ──────────────────────────────────────────────────────
// Three times now a Cal.com dashboard rename has 404'd a slug this repo holds
// as a string: `rumi-app` → `rumi-ai`, then `30-min-meeting` → `call-30min`,
// and the handle is outside this repo either way. tests/unit/cal-link.test.ts
// says plainly that nothing offline can catch that, and that is still true —
// only a live request knows whether a slug resolves.
//
// But "cannot detect it offline" is not the same as "cannot handle it". Cal.com
// tells the page at runtime: the embed emits `linkFailed` for a username or
// event type it cannot resolve. The old component ignored that and revealed the
// embed box on script load, so Cal rendered its own "Error Code: 404. Cal Link
// seems to be wrong." into a full-height white card — to a customer who had
// just been charged on /book/success, with no link, no address, and nothing to
// click. That is the failure these cases pin: not the rename, the HANDLING.
//
// Both branches of the new conditional are covered, plus the third state that
// has no event at all (a script that never answers), because an embed stuck on
// "Loading calendar…" forever is the one outcome with no recovery path.

type CalHandler = () => void;

/**
 * A stand-in for Cal.com's embed API. The real snippet appends a <script> to
 * <head> and queues calls until it loads; jsdom never fetches it, so nothing
 * would ever call back and every case would hit the timeout instead of the
 * branch it means to test. Installing window.Cal BEFORE render makes the
 * snippet's `w.Cal = w.Cal || (…)` keep this one, so the component's real
 * `Cal("on", …)` registrations land here and can be fired on demand.
 */
function installCal() {
  const handlers: Record<string, CalHandler[]> = {};
  const calls: unknown[][] = [];
  const cal = ((...args: unknown[]) => {
    calls.push(args);
    if (args[0] === "on") {
      const { action, callback } = args[1] as {
        action: string;
        callback: CalHandler;
      };
      (handlers[action] ||= []).push(callback);
    }
  }) as unknown as Window["Cal"];
  // `loaded` so the snippet does not try to append a real <script> tag.
  (cal as unknown as { loaded: boolean }).loaded = true;
  window.Cal = cal;
  return {
    calls,
    fire(action: string) {
      const registered = handlers[action] ?? [];
      expect(
        registered.length,
        `the component never registered a "${action}" handler — Cal.com's only runtime signal about the link is unread`
      ).toBeGreaterThan(0);
      act(() => {
        for (const h of registered) h();
      });
    },
  };
}

const embedBox = () => document.querySelector("#cal-embed-target");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  delete window.Cal;
});

describe("CalEmbed while the calendar is still coming", () => {
  it("shows the loading line and keeps the embed target collapsed", () => {
    installCal();
    render(<CalEmbed calLink={CAL_LINK} />);

    expect(screen.getByText("Loading calendar…")).toBeInTheDocument();
    // Collapsed, not absent: Cal needs the element to exist to mount into, but
    // giving it full height before the link resolves is what reserved a
    // 1100px white card for Cal's 404 text to land in.
    expect(embedBox()).toHaveStyle({ minHeight: "0px" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("CalEmbed when Cal.com confirms the link resolved", () => {
  it("drops the loading line and gives the embed its full height", () => {
    const cal = installCal();
    render(<CalEmbed calLink={CAL_LINK} minHeight={900} />);

    cal.fire("linkReady");

    expect(screen.queryByText("Loading calendar…")).not.toBeInTheDocument();
    expect(embedBox()).toHaveStyle({ minHeight: "900px" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not later time out a calendar that already loaded", () => {
    // The timeout and the success signal race on every slow connection. If
    // linkReady did not cancel it, a calendar that took 16 seconds would be
    // replaced by an error telling the customer it failed — while it was on
    // screen and working.
    const cal = installCal();
    render(<CalEmbed calLink={CAL_LINK} loadTimeoutMs={1000} />);

    cal.fire("linkReady");
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(embedBox()).toBeInTheDocument();
  });
});

describe("CalEmbed when Cal.com rejects the link", () => {
  it("replaces the embed with a recovery block naming both ways out", () => {
    const cal = installCal();
    render(<CalEmbed calLink={CAL_LINK} />);

    cal.fire("linkFailed");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The calendar didn’t load");
    // The raw Cal.com string is the thing being replaced. If it ever appears
    // here again, the embed is being rendered through a failure.
    expect(alert.textContent).not.toMatch(/Error Code/i);

    const direct = screen.getByRole("link", {
      name: "Open the calendar on Cal.com",
    });
    expect(direct).toHaveAttribute("href", calUrlFor(CAL_LINK));

    // Email is the route that still works when the EVENT TYPE is what broke —
    // the direct link is equally dead in that case, so it cannot be the only one.
    expect(
      screen.getByRole("link", { name: `Email ${SUPPORT_EMAIL}` })
    ).toHaveAttribute("href", expect.stringContaining(`mailto:${SUPPORT_EMAIL}`));

    // The broken box is gone, not merely covered.
    expect(embedBox()).not.toBeInTheDocument();
    expect(screen.queryByText("Loading calendar…")).not.toBeInTheDocument();
  });

  it("prefills the direct link with the buyer's email when there is one", () => {
    const cal = installCal();
    render(<CalEmbed calLink={CAL_LINK} email="buyer+test@example.com" />);

    cal.fire("linkFailed");

    expect(
      screen.getByRole("link", { name: "Open the calendar on Cal.com" })
    ).toHaveAttribute(
      "href",
      `${calUrlFor(CAL_LINK)}?email=${encodeURIComponent("buyer+test@example.com")}`
    );
  });

  it("offers only email when the length has no event type at all", () => {
    // calLink "" is a supported state (see src/lib/stripe.ts) and calUrlFor
    // returns "" for it. The branch matters because "https://cal.com/" is a
    // LIVE url — it resolves to Cal.com's own signup page, so rendering it as
    // "Open the calendar" sends a paying customer somewhere that looks like it
    // worked and books nothing.
    const cal = installCal();
    render(<CalEmbed calLink="" />);

    cal.fire("linkFailed");

    expect(
      screen.queryByRole("link", { name: "Open the calendar on Cal.com" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `Email ${SUPPORT_EMAIL}` })
    ).toBeInTheDocument();
  });
});

describe("CalEmbed when nothing answers at all", () => {
  it("stops pretending to load once the timeout passes", () => {
    // No linkReady, no linkFailed — the script was blocked, the network is
    // down, or Cal.com is out. There is no event to listen for, which is
    // exactly why the timeout exists: the previous version sat on
    // "Loading calendar…" with no recovery path for as long as the tab was open.
    installCal();
    render(<CalEmbed calLink={CAL_LINK} loadTimeoutMs={1000} />);

    expect(screen.getByText("Loading calendar…")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1001);
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Loading calendar…")).not.toBeInTheDocument();
  });
});
