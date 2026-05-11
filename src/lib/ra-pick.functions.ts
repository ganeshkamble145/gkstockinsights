import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAIWithFallback, parseAIJson } from "./ai-provider";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RAPickStock {
  rank: number;
  companyName: string;
  ticker: string;
  sector: string;
  subSector: string;
  cmp: string;
  marketCap: string;
  faceValue?: string;
  high52w?: string;
  low52w?: string;

  recommendation: "BUY";
  conviction: "High" | "Medium";
  investmentType: "Short-term" | "Long-term" | "Both";
  targetShortTerm?: string;
  targetLongTerm?: string;
  upsideShortTerm?: number;
  upsideLongTerm?: number;
  stopLoss: string;
  stopLossPct: number;
  timeHorizon: string;

  // Intelligence
  latestNews: Array<{ headline: string; source: string; date: string; impact: "POSITIVE" | "NEUTRAL" | "NEGATIVE" }>;
  socialSentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
  promoterActivity: string;
  brokerConsensus: string;
  fiiFiiFlow: string;

  // Filters
  filtersPass: Array<{ filter: string; value: string; pass: boolean }>;

  // Technical
  rsi: number | null;
  macdSignal: "BULLISH_CROSSOVER" | "BEARISH_CROSSOVER" | "NEUTRAL";
  volumeSurge: string;
  supportZone: string;
  resistanceZone: string;
  technicalRating: "STRONG" | "MODERATE" | "WEAK";
  technicalNotes: string;

  // Fundamentals
  pe: string;
  sectorMedianPe: string;
  revenueGrowthQ1: string;
  revenueGrowthQ2: string;
  deRatio: string;
  promoterHolding: string;
  promoterHoldingTrend: "INCREASING" | "STABLE" | "DECREASING";
  pledgedShares: string;
  fundamentalScore: number;
  fundamentalNotes: string;

  // Catalysts & Horizon
  primaryCatalyst: string;
  catalysts: string[];
  shortTermSetup: string;
  longTermSetup: string;

  // Final
  whyThisStock: string[];
  risks: string[];
  redFlagsChecked: string[];
  noRedFlags: boolean;
}

export interface RAPickResult {
  picks: RAPickStock[];
  summary: string;
  marketContext: string;
  sectorThemes: string[];
  dataNotice: string;
  sources: string[];
  analysisDate: string;
}

// ── Input Schema ──────────────────────────────────────────────────────────────

const InputSchema = z.object({
  apiKey: z.string().optional(),
  refresh: z.boolean().optional(),
});

// ── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a SEBI-registered research analyst (RA) and quantitative AI stock expert specialising in undervalued small and mid-cap stocks on Indian stock exchanges (NSE & BSE).

CRITICAL RULES:
1. Every pick's CMP MUST be ≤ ₹500 — hard filter, no exceptions.
2. Market cap above ₹50 Cr. Average daily volume above ₹20 lakh.
3. No SEBI debarment, no ASM/GSM, no promoter fraud.
4. Technical setup must be STRONG or MODERATE only.
5. Fundamental Score must be ≥ 5/10 for each pick.
6. Use your latest training-data prices; mark stale data with "(est.)".
7. Output ONLY valid JSON. No markdown, no code fences, no prose.
8. Each pick must be a DIFFERENT company from a DIFFERENT or complementary sector for diversification.
9. Rank picks by conviction: rank 1 = strongest risk-reward.
10. Keep 'technicalNotes' and 'fundamentalNotes' to 1–2 concise sentences each to stay within token limits.`;

const PICK_SCHEMA = `{
  "rank": 1,
  "companyName": "string",
  "ticker": "NSE:TICKER",
  "sector": "string",
  "subSector": "string",
  "cmp": "₹XXX",
  "marketCap": "₹XXX Cr",
  "faceValue": "₹X",
  "high52w": "₹XXX",
  "low52w": "₹XXX",
  "recommendation": "BUY",
  "conviction": "High|Medium",
  "investmentType": "Short-term|Long-term|Both",
  "targetShortTerm": "₹XXX",
  "targetLongTerm": "₹XXX",
  "upsideShortTerm": 0,
  "upsideLongTerm": 0,
  "stopLoss": "₹XXX",
  "stopLossPct": 0,
  "timeHorizon": "4–6 weeks / 6–12 months",
  "latestNews": [
    { "headline": "string", "source": "string", "date": "YYYY-MM", "impact": "POSITIVE|NEUTRAL|NEGATIVE" }
  ],
  "socialSentiment": "BULLISH|NEUTRAL|BEARISH",
  "promoterActivity": "one-line",
  "brokerConsensus": "one-line",
  "fiiFiiFlow": "one-line",
  "filtersPass": [
    { "filter": "CMP ≤ ₹500", "value": "₹XXX", "pass": true },
    { "filter": "Market Cap > ₹50 Cr", "value": "₹XXX Cr", "pass": true },
    { "filter": "Avg Daily Volume > ₹20L", "value": "₹XX L", "pass": true },
    { "filter": "Min 1Y listing", "value": "X yrs", "pass": true },
    { "filter": "No ASM/GSM", "value": "Clean", "pass": true }
  ],
  "rsi": 0,
  "macdSignal": "BULLISH_CROSSOVER|BEARISH_CROSSOVER|NEUTRAL",
  "volumeSurge": "X× 20-DMA",
  "supportZone": "₹XXX–₹YYY",
  "resistanceZone": "₹XXX–₹YYY",
  "technicalRating": "STRONG|MODERATE",
  "technicalNotes": "1 concise sentence",
  "pe": "XXx",
  "sectorMedianPe": "XXx",
  "revenueGrowthQ1": "+XX% YoY",
  "revenueGrowthQ2": "+XX% YoY",
  "deRatio": "0.XX",
  "promoterHolding": "XX%",
  "promoterHoldingTrend": "INCREASING|STABLE|DECREASING",
  "pledgedShares": "X%",
  "fundamentalScore": 0,
  "fundamentalNotes": "1–2 concise sentences",
  "primaryCatalyst": "one sentence",
  "catalysts": ["catalyst 1", "catalyst 2"],
  "shortTermSetup": "1 sentence",
  "longTermSetup": "1 sentence",
  "whyThisStock": ["catalyst point", "deal/news detail", "fundamental strength", "technical trigger"],
  "risks": ["risk 1", "risk 2"],
  "redFlagsChecked": ["SEBI enforcement", "Pledging >10%", "ASM/GSM", "Negative news", "Governance"],
  "noRedFlags": true
}`;

const USER_PROMPT = `Apply the full 7-step RA analysis framework to identify 7 to 10 of the BEST undervalued Indian stocks currently priced at or below ₹500 CMP.

STEP 1 — INTELLIGENCE: Synthesise latest news, filings, social sentiment, promoter activity, broker reports for each candidate.
STEP 2 — FILTER: CMP ≤ ₹500, Mkt Cap > ₹50 Cr, Volume > ₹20L/day, 1yr+ listing, no ASM/GSM.
STEP 3 — TECHNICAL: RSI (look for ≤35 oversold), bullish MACD crossover, volume surge ≥3×, strong support. Rate STRONG/MODERATE only.
STEP 4 — FUNDAMENTALS: P/E ≥30% below sector median, Revenue growth ≥15% YoY (2 consecutive qtrs), D/E <1.0, Promoter >40% stable/increasing. Score /10.
STEP 5 — CATALYST: Each stock must have a clear PRIMARY catalyst.
STEP 6 — HORIZON: Provide separate ST and LT target prices for each pick.
STEP 7 — RANK & OUTPUT: Rank all picks by overall risk-reward conviction (rank 1 = best).

DIVERSIFICATION RULE: Picks must span at least 5 different sectors.

Return ONLY valid JSON in this exact envelope (no prose, no fences):

{
  "picks": [ <array of 7–10 pick objects matching the schema below> ],
  "summary": "2-sentence market overview",
  "marketContext": "1-sentence on current NSE/BSE market conditions",
  "sectorThemes": ["theme1", "theme2", "theme3"],
  "dataNotice": "Figures from training data — verify on NSE/BSE/Screener.in before investing.",
  "sources": ["source1"],
  "analysisDate": "YYYY-MM"
}

Each pick object must match:
${PICK_SCHEMA}`;

// ── Server Function ───────────────────────────────────────────────────────────

export const runRAPick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<{ result: RAPickResult | null; error: string | null }> => {
    const aiRes = await callAIWithFallback(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT },
      ],
      data.apiKey,
    );

    if (!aiRes.content) {
      return { result: null, error: aiRes.error ?? "AI request failed." };
    }

    const parsed = parseAIJson<RAPickResult>(aiRes.content);
    if (!parsed || !Array.isArray(parsed.picks) || parsed.picks.length === 0) {
      return { result: null, error: "Could not parse AI response. Please try again." };
    }

    // Filter out any picks that violate ₹500 CMP rule
    // Coerce to string first — AI sometimes returns numeric values
    parsed.picks = parsed.picks.filter((p) => {
      const cmpStr = p.cmp != null ? String(p.cmp) : "9999";
      const cmpNum = parseFloat(cmpStr.replace(/[₹,\s]/g, ""));
      // Normalise cmp to a ₹-prefixed string for the UI
      if (!isNaN(cmpNum) && !cmpStr.includes("₹")) {
        p.cmp = `₹${cmpNum}`;
      }
      return isNaN(cmpNum) ? false : cmpNum <= 500;
    });

    // Ensure ranks are sequential
    parsed.picks.forEach((p, i) => { p.rank = i + 1; });

    if (parsed.picks.length === 0) {
      return { result: null, error: "All AI picks exceeded the ₹500 CMP filter. Please retry." };
    }

    return { result: parsed, error: null };
  });
