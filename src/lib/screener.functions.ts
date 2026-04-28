import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAIWithFallback, parseAIJson } from "./ai-provider";
import { gkCache, screenerCacheKey, checkMarketHours, CACHE_TTL } from "./perf-utils";

export interface ScreenerStock {
  company: string;
  ticker: string;
  sector: string;
  niftyWeight?: string;
  price: string;
  priceAsOf?: string;
  high52w: string;
  low52w: string;
  return1y: string;
  return3y?: string;
  vsNifty1y?: string;
  vsNifty3y?: string;
  pe: string;
  pe5yAvg?: string;
  sectorMedianPe?: string;
  pb: string;
  evEbitda?: string;
  roce: string;
  roe?: string;
  de: string;
  promoterHolding: string;
  promoterPledging?: string;
  promoterBuying?: string;
  fiiTrend?: string;
  fiiHolding?: string;
  diiHolding?: string;
  marketCap: string;
  revCagr3y?: string;
  profitCagr3y?: string;
  pegRatio?: string;
  fcfStatus?: string;
  dcfIntrinsicValue?: string;
  dcfUpsidePct?: number;
  peerCompany?: string;
  peerComparison?: string;
  portfolioAllocation?: string;
  undervaluedReason?: string;
  thesis: string;
  catalysts: string[];
  risks: string[];
  riskVolatility: number;
  riskLiquidity: number;
  riskFundamental: number;
  analystTarget?: string;
  upsidePct?: number;
  buyHoldSell?: string;
  horizon?: string;
  riskReward?: "LOW" | "MEDIUM" | "HIGH";
  // Chart helpers (numeric copies)
  peNum?: number;
  roceNum?: number;
}

export interface ScreenerResult {
  picks: ScreenerStock[];
  sectors: string[];
  summary: string;
  dataNotice: string;
  sources: string[];
  portfolioRationale?: string;
}

const InputSchema = z.object({
  kind: z.enum(["penny", "nifty100"]),
});

const PRICE_DIRECTIVE = `PRICE / CMP DATA POLICY (mandatory):
- Always populate "price" with the MOST RECENT close price you can produce for the stock from your knowledge — do NOT use stale prices from years ago. Format like "₹84.50".
- Populate "priceAsOf" with the date you believe the price reflects (e.g. "as of last close" or "approx. <Month YYYY>"). If markets are closed, use the last trading day's close.
- All other figures (52W high/low, returns, ratios, holdings) should reflect the most recent fiscal/quarter data you have. Mark anything older than 6 months by adding "(stale)" to that field.
- Do not refuse to provide a price. If uncertain, give your best recent estimate and clearly note it in priceAsOf.`;

const PENNY_PROMPT = `You are an experienced Indian stock market analyst. Identify the top 10 highly undervalued PENNY STOCKS listed on NSE/BSE with strong multibagger potential.

Screener.in-style criteria:
- Stock price below ₹100
- P/E below 30 (where applicable)
- P/B below 2 (ideally below 1 = below book value)
- ROCE above 10%
- D/E below 1
- Promoter holding above 40%
- Zero or minimal promoter pledging
- Positive revenue & profit growth over 3 years
- Market cap below ₹15,000 Cr

For each stock provide all the fields in the schema. Rate each risk (volatility, liquidity, fundamental) on a 1-10 scale (10 = highest risk). Ensure picks span diverse sectors. Return EXACTLY 20 stocks.

${PRICE_DIRECTIVE}`;

const NIFTY_PROMPT = `You are an experienced Indian stock market analyst with deep expertise in fundamental and technical analysis. Identify the top 10 highly UNDERVALUED stocks from the NIFTY 100 index listed on NSE/BSE with strong MULTIBAGGER potential.

STRICT screening criteria (Screener.in style):
- Current NIFTY 100 constituent (mention approximate index weight)
- P/E significantly below stock's own 5-year historical average AND below sector median (provide both numbers)
- P/B below 3 (ideally below 1.5 for non-financials)
- ROCE above 15% (12% acceptable for capital-intensive sectors like infra/utilities)
- D/E below 1 (below 0.5 preferred; exclude banks/NBFCs from D/E filter)
- Promoter holding above 40% with zero/minimal pledging
- Revenue CAGR > 12% (3Y), Net profit CAGR > 15% (3Y)
- PEG ratio below 1
- FCF positive in at least 2 of last 3 years
- FII/DII holding INCREASING in last 2 quarters (institutional accumulation)

ADDITIONAL REQUIREMENTS:
- Return EXACTLY 20 stocks
- Sector diversification: picks MUST span at least 6 different sectors (banking, IT, pharma, infrastructure, FMCG, auto, energy, metals, capital goods, etc.)
- Provide DCF-based intrinsic value estimate for each stock + upside %
- Compare each pick against its closest large-cap peer (one-line comparison)
- Suggest portfolio allocation % across the 10 stocks (totals must equal 100%)
- Performance vs NIFTY 100 index for 1Y and 3Y (e.g. "+12% vs index")
- Note if promoter has bought shares in open market in last 6 months

${PRICE_DIRECTIVE}`;

const SCHEMA = `{
  "picks": [ /* exactly 20 items */
    {
      "company": "string",
      "ticker": "NSE:XXX",
      "sector": "string",
      "niftyWeight": "..% of NIFTY 100",
      "price": "₹...",
      "priceAsOf": "as of <date or last close>",
      "high52w": "₹...",
      "low52w": "₹...",
      "return1y": "+/-..%",
      "return3y": "+/-..%",
      "vsNifty1y": "+/-..% vs NIFTY",
      "vsNifty3y": "+/-..% vs NIFTY",
      "pe": "..x",
      "pe5yAvg": "..x",
      "sectorMedianPe": "..x",
      "pb": "..",
      "evEbitda": "..x",
      "roce": "..%",
      "roe": "..%",
      "de": "..",
      "promoterHolding": "..%",
      "promoterPledging": "..%",
      "promoterBuying": "YES (last 6 months) | NO",
      "fiiTrend": "UP|FLAT|DOWN",
      "fiiHolding": "..%",
      "diiHolding": "..%",
      "marketCap": "₹.. Cr",
      "revCagr3y": "..%",
      "profitCagr3y": "..%",
      "pegRatio": "..",
      "fcfStatus": "POSITIVE|MIXED|NEGATIVE",
      "dcfIntrinsicValue": "₹...",
      "dcfUpsidePct": number,
      "peerCompany": "Closest large-cap peer name",
      "peerComparison": "one-line comparison vs peer",
      "portfolioAllocation": "..%",
      "undervaluedReason": "specific reason — sector rotation / temporary miss / macro headwinds etc.",
      "thesis": "2-3 sentence multibagger investment thesis — what needs to happen for 2x-5x",
      "catalysts": ["catalyst 1","catalyst 2","catalyst 3"],
      "risks": ["risk 1","risk 2","risk 3"],
      "riskVolatility": 1-10,
      "riskLiquidity": 1-10,
      "riskFundamental": 1-10,
      "analystTarget": "₹...",
      "upsidePct": number,
      "buyHoldSell": "e.g. 18 Buy / 4 Hold / 2 Sell",
      "horizon": "1 year|3 years|5 years",
      "riskReward": "LOW|MEDIUM|HIGH",
      "peNum": number /* numeric P/E for chart */,
      "roceNum": number /* numeric ROCE % for chart */
    }
  ],
  "sectors": ["unique sector list — at least 5"],
  "summary": "2-line overview of the selection",
  "portfolioRationale": "1-2 sentence rationale for the suggested portfolio allocation",
  "dataNotice": "Prices reflect the latest close known to the model. Live market access is not available — verify current CMP on NSE/BSE/Screener.in before trading.",
  "sources": ["Screener.in","NSE/BSE filings","Moneycontrol","Bloomberg","Brokerage reports"]
}`;

export const runScreener = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ result: ScreenerResult | null; error: string | null; _fromCache?: boolean }> => {
    // Fix 2: cache-first — return cached AI result instantly
    const cacheKey = screenerCacheKey(data.kind);
    const cached = gkCache.get<ScreenerResult>(cacheKey);
    if (cached) return { result: cached, error: null, _fromCache: true };

    const prompt = data.kind === "penny" ? PENNY_PROMPT : NIFTY_PROMPT;
    const userPrompt = `${prompt}\n\nReturn ONLY valid JSON matching this schema (no prose, no fences):\n\n${SCHEMA}`;

    const aiRes = await callAIWithFallback([
      {
        role: "system",
        content:
          "You are an INDIAN STOCK SCREENER AI. Use the freshest data you have on NSE/BSE listed companies — always provide the latest close price you can recall (never stale multi-year-old prices). Live market data fetching is unavailable; clearly disclaim figures may need verification. Output ONLY valid JSON. EDUCATIONAL purposes, not SEBI-registered investment advice.",
      },
      { role: "user", content: userPrompt },
    ]);

    if (!aiRes.content) {
      return { result: null, error: aiRes.error ?? "AI request failed." };
    }

    const parsed = parseAIJson<ScreenerResult>(aiRes.content);
    if (!parsed) {
      return { result: null, error: "Could not parse AI response as JSON." };
    }

    // Cache the fresh result
    const marketOpen = checkMarketHours();
    const ttl = marketOpen ? CACHE_TTL.penny_scanner : CACHE_TTL.after_market_close;
    gkCache.set(cacheKey, parsed, ttl);

    return { result: parsed, error: null, _fromCache: false };
  });
