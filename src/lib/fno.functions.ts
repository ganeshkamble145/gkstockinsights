import { createServerFn } from "@tanstack/react-start";
import { callAIWithFallback, parseAIJson } from "./ai-provider";
import { gkCache, screenerCacheKey, checkMarketHours, CACHE_TTL } from "./perf-utils";

export interface FnoStrategy {
  name: string;
  marketOutlook: string;
  strikeSelection: string;
  expiry: "Weekly" | "Monthly" | string;
  entryCondition: string;
  exitCondition: string;
  stopLoss: string;
  maxProfit: string;
  maxRisk: string;
  riskReward: string;
  positionSizingTip: string;
}

export interface FnoStock {
  rank: number;
  company: string;
  symbol: string; // NSE symbol
  sector: string;
  cmp: string;
  cmpAsOf?: string;
  avgVolume: string; // contracts/day
  openInterest: string;
  bidAskSpread?: string;
  iv: string; // implied volatility
  fiiDiiActivity?: string;
  trend: "Bullish" | "Bearish" | "Sideways" | string;
  support: string;
  resistance: string;
  whyQualifies: string;
  inIndex?: string; // e.g., NIFTY 50 / NIFTY 100
  banStatus?: string; // e.g., "No ban — MWPL 42%"
  strategy: FnoStrategy;
}

export interface FnoResult {
  picks: FnoStock[];
  sectors: string[];
  bestThisWeek: { symbol: string; reason: string }[]; // top 3
  summary: string;
  riskWarning: string;
  dataNotice: string;
  sources: string[];
}

const PROMPT = `You are an expert Indian stock market analyst and F&O trading strategist with deep knowledge of NSE derivatives markets.

TASK: Identify the TOP 20 Indian stocks currently best suited for F&O trading.

SELECTION CRITERIA:
1. High daily trading volume (10 lakh+ contracts/day preferred)
2. High Open Interest (OI)
3. Tight bid-ask spreads (good liquidity)
4. Implied Volatility (IV) between 20%–60% (ideal for options strategies)
5. Strong FII/DII participation
6. Preferably part of NIFTY 50 or NIFTY 100
7. NOT in active F&O ban (no MWPL breach)

For each of the 20 stocks supply ALL fields in the JSON schema below, including:
- Sector
- Why it qualifies (volume, OI, volatility data)
- Current trend (Bullish / Bearish / Sideways)
- Key support & resistance levels
- Implied Volatility (IV)
- An AI-recommended trading strategy with strategy name (Bull Call Spread, Iron Condor, Long Straddle, Short Strangle, Cash-Secured Put, Covered Call, Bear Put Spread, etc.), market outlook required, strike selection (ATM/OTM/ITM with specific strike numbers), expiry (Weekly/Monthly), entry condition, exit condition / target, stop loss, max profit potential, max risk, risk-reward ratio, position sizing tip.

Trader profile: ₹50,000 – ₹1,00,000 capital, conservative risk preference. Favour defined-risk strategies (spreads, iron condors) over naked options.

Then identify the TOP 3 best risk-reward picks for THIS WEEK with a one-line reason each.

PRICE / CMP POLICY (mandatory):
- Always populate "cmp" with the MOST RECENT close price you can produce for the stock — never multi-year-old stale prices. Format like "₹2,845".
- Populate "cmpAsOf" with the date the price reflects (e.g. "last close" or "<Month YYYY>"). If markets are closed, use the last trading day's close.
- Support / resistance / IV should reflect the most recent levels you know.

Return ONLY valid JSON (no prose, no markdown fences) matching this schema:

{
  "picks": [ /* exactly 20 items, ranked 1..20 */
    {
      "rank": number,
      "company": "string",
      "symbol": "NSE symbol (e.g. RELIANCE)",
      "sector": "string",
      "cmp": "₹...",
      "cmpAsOf": "last close | <date>",
      "avgVolume": "e.g. 12.5 lakh contracts/day",
      "openInterest": "e.g. 1.8 Cr shares",
      "bidAskSpread": "e.g. ₹0.05 (tight)",
      "iv": "e.g. 28%",
      "fiiDiiActivity": "short note on recent FII/DII flows",
      "trend": "Bullish | Bearish | Sideways",
      "support": "₹... / ₹...",
      "resistance": "₹... / ₹...",
      "whyQualifies": "1-2 line reason citing volume, OI, IV",
      "inIndex": "NIFTY 50 | NIFTY 100",
      "banStatus": "No ban — MWPL ..%",
      "strategy": {
        "name": "e.g. Bull Call Spread",
        "marketOutlook": "e.g. moderately bullish",
        "strikeSelection": "ATM/OTM/ITM with explicit strikes",
        "expiry": "Weekly | Monthly",
        "entryCondition": "specific technical trigger",
        "exitCondition": "target / when to book",
        "stopLoss": "explicit SL",
        "maxProfit": "₹... per lot",
        "maxRisk": "₹... per lot",
        "riskReward": "e.g. 1:2.3",
        "positionSizingTip": "e.g. 1 lot for ₹50k capital, 2 lots for ₹1L"
      }
    }
  ],
  "sectors": ["unique sector list"],
  "bestThisWeek": [
    { "symbol": "NSE symbol", "reason": "one-line reason" } /* exactly 3 items */
  ],
  "summary": "2-line overview of the F&O selection and current market context",
  "riskWarning": "Strong general risk warning for F&O traders (leverage, time decay, gap risk).",
  "dataNotice": "Prices and Greeks reflect the latest close known to the model. Live market access unavailable — verify on NSE option chain before placing trades.",
  "sources": ["NSE option chain","Sensibull","Opstra","Moneycontrol","Brokerage reports"]
}`;

export const runFno = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ result: FnoResult | null; error: string | null; _fromCache?: boolean }> => {
    // Fix 2: cache-first for F&O scan (5 min TTL market hours)
    const cacheKey = screenerCacheKey("fo");
    const cached = gkCache.get<FnoResult>(cacheKey);
    if (cached) return { result: cached, error: null, _fromCache: true };

    const aiRes = await callAIWithFallback([
      {
        role: "system",
        content:
          "You are an INDIAN F&O DERIVATIVES STRATEGIST AI. Use the freshest knowledge you have on NSE F&O — always provide the latest close prices and IV levels you can recall (never multi-year-old stale prices). Live market data is unavailable; disclaim that figures must be verified on NSE option chain. Output ONLY valid JSON. EDUCATIONAL purposes only — NOT SEBI-registered investment advice.",
      },
      { role: "user", content: PROMPT },
    ]);

    if (!aiRes.content) {
      return { result: null, error: aiRes.error ?? "AI request failed." };
    }

    const parsed = parseAIJson<FnoResult>(aiRes.content);
    if (!parsed) {
      return { result: null, error: "Could not parse AI response as JSON." };
    }

    // Cache result
    const marketOpen = checkMarketHours();
    const ttl = marketOpen ? CACHE_TTL.fo_scan : CACHE_TTL.after_market_close;
    gkCache.set(cacheKey, parsed, ttl);

    return { result: parsed, error: null, _fromCache: false };
  },
);
