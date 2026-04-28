import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
} as const;

function jsonResponse(body: unknown, status = 200, cacheSeconds = 55) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${cacheSeconds}, stale-while-revalidate=10`,
      ...CORS_HEADERS,
    },
  });
}

/**
 * Server-side proxy for Yahoo Finance chart endpoint.
 * Avoids browser CORS errors and lets us spoof a desktop User-Agent.
 *
 * GET /api/public/yahoo-proxy?symbol=RELIANCE.NS&interval=1d&range=1d
 */
export const Route = createFileRoute("/api/public/yahoo-proxy")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const symbolRaw = url.searchParams.get("symbol");
          if (!symbolRaw) {
            return jsonResponse({ error: "Missing 'symbol' query param" }, 400);
          }

          // Light validation: tickers like RELIANCE.NS, ^NSEI, BANKNIFTY.NS
          const symbol = symbolRaw.trim().toUpperCase();
          if (!/^[\^A-Z0-9.\-&]{1,32}$/.test(symbol)) {
            return jsonResponse({ error: "Invalid symbol" }, 400);
          }

          const interval = url.searchParams.get("interval") ?? "1d";
          const range = url.searchParams.get("range") ?? "1d";

          // Determine cache duration: 55s market hours, 3600s closed
          const nowUtc = new Date();
          const ist = new Date(nowUtc.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
          const day = ist.getDay();
          const time = ist.getHours() * 60 + ist.getMinutes();
          const marketOpen = day >= 1 && day <= 5 && time >= 9 * 60 + 15 && time < 15 * 60 + 30;
          const cacheSeconds = marketOpen ? 55 : 3600;

          const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            symbol,
          )}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;

          const res = await fetch(upstream, { headers: YAHOO_HEADERS });
          const text = await res.text();

          if (!res.ok) {
            return jsonResponse(
              { error: `Yahoo upstream ${res.status}`, body: text.slice(0, 500) },
              res.status,
              10,
            );
          }

          // Pass-through JSON with smart cache duration
          return new Response(text, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${cacheSeconds}, stale-while-revalidate=10`,
              ...CORS_HEADERS,
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          return jsonResponse({ error: message }, 500);
        }
      },
    },
  },
});
