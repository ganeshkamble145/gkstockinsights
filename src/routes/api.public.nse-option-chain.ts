import { createFileRoute } from "@tanstack/react-router";

const INDEX_SYMBOLS = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"]);

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/option-chain",
};

async function getNseCookies(): Promise<string> {
  const res = await fetch("https://www.nseindia.com/option-chain", {
    headers: BROWSER_HEADERS,
    redirect: "follow",
  });
  // Cloudflare runtime exposes set-cookie via headers.getSetCookie
  // Fallback: combine all set-cookie entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyHeaders = res.headers as any;
  let cookies: string[] = [];
  if (typeof anyHeaders.getSetCookie === "function") {
    cookies = anyHeaders.getSetCookie();
  } else {
    const raw = res.headers.get("set-cookie");
    if (raw) cookies = raw.split(/,(?=[^;]+=[^;]+)/);
  }
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

export const Route = createFileRoute("/api/public/nse-option-chain")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const rawSymbol = (url.searchParams.get("symbol") ?? "").trim().toUpperCase();
        if (!rawSymbol || !/^[A-Z0-9&-]{1,20}$/.test(rawSymbol)) {
          return Response.json({ error: "Invalid symbol" }, { status: 400 });
        }

        try {
          const cookie = await getNseCookies();
          const isIndex = INDEX_SYMBOLS.has(rawSymbol);
          const apiUrl = isIndex
            ? `https://www.nseindia.com/api/option-chain-indices?symbol=${encodeURIComponent(rawSymbol)}`
            : `https://www.nseindia.com/api/option-chain-equities?symbol=${encodeURIComponent(rawSymbol)}`;

          const res = await fetch(apiUrl, {
            headers: { ...BROWSER_HEADERS, Accept: "application/json", Cookie: cookie },
          });

          if (!res.ok) {
            return Response.json(
              { error: `NSE responded ${res.status}` },
              { status: 502, headers: { "Cache-Control": "no-store" } },
            );
          }

          const data = await res.json();
          return new Response(JSON.stringify({ symbol: rawSymbol, data }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=30",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
