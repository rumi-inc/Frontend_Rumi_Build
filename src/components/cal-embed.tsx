"use client";

import { useEffect, useRef, useState } from "react";
import { calUrlFor, SUPPORT_EMAIL } from "@/lib/data";

type CalApi = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  ns?: Record<string, CalApi>;
  q?: unknown[][];
};

declare global {
  interface Window {
    Cal?: CalApi;
  }
}

interface CalEmbedProps {
  calLink: string;
  email?: string | null;
  name?: string | null;
  /**
   * Mobile fallback height. The Cal embed auto-resizes to its content via
   * postMessage once it loads — this only prevents layout shift before that.
   */
  minHeight?: number;
  /**
   * How long to wait for Cal.com to say the link resolved before giving up and
   * showing the recovery block. Generous on purpose — this is a fallback for a
   * script that never answers at all (blocked, offline, Cal.com down), not a
   * performance budget. A slow calendar that eventually renders must not be
   * replaced by an error, so `linkReady` cancels this.
   */
  loadTimeoutMs?: number;
}

const EMBED_SCRIPT_SRC = "https://app.cal.com/embed/embed.js";

/**
 * loading → the script is still coming, or Cal has not reported on the link yet.
 * ready   → Cal.com confirmed the event type resolved; the iframe is real.
 * failed  → Cal.com said the link is wrong, or nothing answered in time.
 */
type EmbedStatus = "loading" | "ready" | "failed";

export function CalEmbed({
  calLink,
  email,
  name,
  minHeight = 1100,
  loadTimeoutMs = 15000,
}: CalEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [status, setStatus] = useState<EmbedStatus>("loading");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Cal.com's official snippet (https://cal.com/docs/embed) — installs
    // window.Cal and queues calls until embed.js loads.
    (function (C, A, L) {
      const w = C as Window & { Cal?: CalApi };
      const d = w.document;
      const p = (a: CalApi, ar: unknown[]) => {
        a.q = a.q || [];
        a.q.push(ar);
      };
      w.Cal =
        w.Cal ||
        (function () {
          const cal = w.Cal as CalApi;
          // eslint-disable-next-line prefer-rest-params
          const ar = arguments as unknown as unknown[];
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            const s = d.createElement("script");
            s.src = A;
            // NOT a success signal. The script loading only means Cal's code
            // arrived — it says nothing about whether THIS event type exists.
            // Treating it as readiness is what produced the failure this
            // component now handles: the box was revealed at full height and
            // Cal rendered "Error Code: 404. Cal Link seems to be wrong." into
            // it, which reads to a customer who has just been charged as a
            // broken site with no way forward. Readiness comes from the
            // `linkReady` event below, which fires only for a link that resolved.
            s.onerror = () => setStatus("failed");
            d.head.appendChild(s);
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api = function (this: unknown) {
              // eslint-disable-next-line prefer-rest-params
              p(api as CalApi, arguments as unknown as unknown[]);
            } as CalApi;
            const namespace = ar[1];
            api.q = api.q || [];
            if (typeof namespace === "string") {
              cal.ns = cal.ns || {};
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              p(cal, ar);
            } else {
              p(cal, ar);
            }
            return;
          }
          p(cal, ar);
        } as unknown as CalApi);
    })(window, EMBED_SCRIPT_SRC, "init");

    const prefill: Record<string, string> = {};
    if (name) prefill.name = name;
    if (email) prefill.email = email;

    window.Cal!("init", { origin: "https://app.cal.com" });

    // The two signals that actually describe the LINK rather than the script.
    // Cal.com emits linkFailed for a username or event slug it cannot resolve —
    // exactly the 404 a dashboard rename produces, and the one thing no offline
    // test in this repo can catch (see tests/unit/cal-link.test.ts). Catching it
    // at runtime is the only place this failure can be handled, so it is handled
    // here instead of being rendered to the customer as Cal's raw error text.
    window.Cal!("on", {
      action: "linkReady",
      callback: () => setStatus("ready"),
    });
    window.Cal!("on", {
      action: "linkFailed",
      callback: () => setStatus("failed"),
    });

    window.Cal!("inline", {
      elementOrSelector: "#cal-embed-target",
      calLink,
      config: Object.keys(prefill).length ? prefill : undefined,
    });

    window.Cal!("ui", {
      theme: "light",
      cssVarsPerTheme: {
        light: { "cal-brand": "#059669" },
        dark: { "cal-brand": "#059669" },
      },
      hideEventTypeDetails: false,
      layout: "month_view",
    });
  }, [calLink, email, name]);

  // Nothing answered at all. linkFailed covers a link Cal.com rejects, but a
  // script that never executes — blocked by an extension, a dead network, a
  // Cal.com outage — emits no event of any kind, and the previous version sat
  // on "Loading calendar…" forever. Indefinitely pretending to load is the one
  // outcome with no recovery path, so it times out into the block below.
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus("failed"), loadTimeoutMs);
    return () => clearTimeout(timer);
  }, [status, loadTimeoutMs]);

  // Built from the same helper CALENDLY_URL uses, so the escape hatch and the
  // embed can never name different calendars — see calUrlFor in src/lib/data.ts.
  const calUrl = calUrlFor(calLink);
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    "I couldn't book a time",
  )}`;

  if (status === "failed") {
    return (
      <div
        ref={containerRef}
        role="alert"
        className="w-full rounded-xl border border-accent/30 bg-accent/5 p-6"
      >
        <h2 className="text-base font-semibold text-ink mb-2">
          The calendar didn&rsquo;t load
        </h2>
        {/* Says what to do, not what went wrong. Whoever reads this has already
            been charged on /book/success, and "Error Code: 404" tells them
            nothing they can act on. Both routes out are given because they fail
            independently: the direct link is useless if the event type is the
            thing that is broken, and email is the one path that works even
            then. */}
        <p className="text-sm text-ink mb-4">
          This is on us, not on you
          {calUrl ? ", and your time is still available" : ""}. Open the
          calendar directly, or email us and we&rsquo;ll send you times within
          one business day.
        </p>
        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-4">
          {calUrl ? (
            <a
              href={
                email ? `${calUrl}?email=${encodeURIComponent(email)}` : calUrl
              }
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-accent hover:text-accent-hover"
            >
              Open the calendar on Cal.com
            </a>
          ) : null}
          <a
            href={mailto}
            className="underline text-accent hover:text-accent-hover"
          >
            Email {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-visible rounded-xl border border-line bg-white"
      style={{ minHeight }}
    >
      {status === "loading" && (
        <div
          className="flex w-full items-center justify-center text-sm text-muted"
          style={{ minHeight }}
        >
          Loading calendar…
        </div>
      )}
      <div
        id="cal-embed-target"
        className="cal-embed-target w-full"
        style={{ minHeight: status === "ready" ? minHeight : 0 }}
      />
    </div>
  );
}
