// Composite scoring for ranked stock dashboards.
// Combines live Yahoo data (price/volume/52W/RSI/momentum) with AI-supplied
// fundamentals (P/E, sector, OI, IV, PCR) into a 0–100 score.

import type { LiveQuote, LiveQuoteState } from "@/hooks/use-live-quotes";

export type Recommendation =
  | { label: "STRONG BUY"; tone: "strong-buy"; emoji: "⭐" }
  | { label: "BUY"; tone: "buy"; emoji: "✅" }
  | { label: "HOLD"; tone: "hold"; emoji: "⚠️" }
  | { label: "AVOID"; tone: "avoid"; emoji: "🔻" }
  | { label: "SELL"; tone: "sell"; emoji: "❌" };

export function recommendationFor(score: number): Recommendation {
  if (score >= 80) return { label: "STRONG BUY", tone: "strong-buy", emoji: "⭐" };
  if (score >= 60) return { label: "BUY", tone: "buy", emoji: "✅" };
  if (score >= 40) return { label: "HOLD", tone: "hold", emoji: "⚠️" };
  if (score >= 20) return { label: "AVOID", tone: "avoid", emoji: "🔻" };
  return { label: "SELL", tone: "sell", emoji: "❌" };
}

export function rankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

/** Clamp a value between 0 and 100. */
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Parse a string like "34.2x" or "₹1,432" or "12.5 lakh contracts/day" into a number. */
export function parseNumeric(value: string | undefined | null): number | undefined {
  if (value == null) return undefined;
  const m = String(value).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : undefined;
}

// ---------- Sub-factor scores (each 0–100) ----------

/** Price momentum (5-day). +5% or more → 100. -5% or worse → 0. */
export function momentumScore(momentum5d: number | undefined): number {
  if (momentum5d == null) return 50;
  return clamp(50 + momentum5d * 10);
}

/** Volume vs 3M avg ratio. 1.0 → 50, 3.0+ → 100. */
export function volumeScore(volume: number, avgVolume?: number): number {
  if (!avgVolume || avgVolume <= 0) return 50;
  const ratio = volume / avgVolume;
  if (ratio <= 0.2) return 0;
  return clamp(((ratio - 0.2) / (3 - 0.2)) * 100);
}

/** Proximity to 52W high. Within 5% → 100, at 52W low → 0. */
export function proximityScore(price: number, high52w?: number, low52w?: number): number {
  if (!high52w || !low52w || high52w <= low52w) return 50;
  const pct = (price - low52w) / (high52w - low52w);
  return clamp(pct * 100);
}

/** P/E vs sector average. Lower P/E than sector → higher score. */
export function peScore(pe: number | undefined, sectorPe: number | undefined): number {
  if (!pe || pe <= 0) return 50;
  if (!sectorPe || sectorPe <= 0) return 50;
  const ratio = pe / sectorPe; // <1 = cheaper than sector
  // ratio 0.5 → 100, ratio 1 → 60, ratio 1.5 → 30, ratio 2+ → 10
  return clamp(110 - ratio * 60);
}

/** RSI sweet spot 40–65 → 100. Outside that, fades toward 30 / 80. */
export function rsiScore(rsi: number | undefined): number {
  if (rsi == null) return 50;
  if (rsi >= 40 && rsi <= 65) return 100;
  if (rsi >= 30 && rsi < 40) return 60 + ((rsi - 30) / 10) * 40;
  if (rsi > 65 && rsi <= 80) return 60 + ((80 - rsi) / 15) * 40;
  if (rsi < 30) return clamp((rsi / 30) * 60);
  return clamp(((100 - rsi) / 20) * 60);
}

/** Market cap stability: large caps score higher. (Numeric Cr.) */
export function mcapScore(marketCapCr: number | undefined): number {
  if (!marketCapCr || marketCapCr <= 0) return 50;
  // <500cr → 30, 1000cr → 50, 10000cr → 80, 100000cr → 95
  const log = Math.log10(marketCapCr);
  return clamp(20 + log * 18);
}

/** Quality: ROE / ROCE. Above 20% is excellent. Below 10% is weak. */
export function qualityScore(roe: number | undefined, roce: number | undefined): number {
  const val = Math.max(roe ?? 0, roce ?? 0);
  if (val <= 0) return 40;
  // 10% -> 40, 15% -> 70, 20% -> 90, 30%+ -> 100
  if (val < 10) return clamp(val * 4);
  return clamp(40 + (val - 10) * 5);
}

/** Leverage: Debt / Equity. Below 0.5 is safe. Above 2 is risky. */
export function leverageScore(de: number | undefined): number {
  if (de == null) return 50;
  if (de <= 0.2) return 100;
  if (de <= 0.5) return 90;
  // 1.0 -> 50, 1.5 -> 25, 2.0+ -> 0
  return clamp(100 - de * 50);
}

/** Safety: Promoter Pledging. 0 is ideal. Above 10% is a flag. */
export function pledgingScore(pledge: number | undefined): number {
  if (pledge == null || pledge <= 0) return 100;
  if (pledge > 50) return 0;
  // 10% -> 70, 25% -> 40, 50% -> 0
  return clamp(100 - pledge * 2);
}

/** Consensus: Upside to Analyst Target. */
export function upsideScore(upsidePct: number | undefined): number {
  if (upsidePct == null) return 50;
  if (upsidePct < 0) return 0; // Price is above target (overvalued)
  if (upsidePct === 0) return 20; 
  // 10% -> 60, 20% -> 85, 30%+ -> 100
  return clamp(20 + upsidePct * 3.5);
}

// ---------- F&O specific ----------

/** Open interest size — higher better. */
export function oiScore(oiText: string | undefined): number {
  const num = parseNumeric(oiText);
  if (num == null) return 50;
  // assume number is in lakh/cr — already normalized by parser. Score by magnitude of digits.
  // Using log to be lenient.
  return clamp(20 + Math.log10(Math.max(num, 1)) * 25);
}

/** OI change %  (positive = fresh buildup, capped at +30%). */
export function oiChangeScore(oiChangePct: number | undefined): number {
  if (oiChangePct == null) return 50;
  return clamp(50 + oiChangePct * 1.7);
}

/** IV ideal 20–50% for buying. */
export function ivScore(ivText: string | undefined): number {
  const iv = parseNumeric(ivText);
  if (iv == null) return 50;
  if (iv >= 20 && iv <= 50) return 100;
  if (iv < 20) return clamp((iv / 20) * 80);
  if (iv <= 80) return clamp(100 - ((iv - 50) / 30) * 70);
  return 20;
}

/** PCR ideal 0.7–1.3. */
export function pcrScore(pcr: number | undefined): number {
  if (pcr == null) return 50;
  if (pcr >= 0.7 && pcr <= 1.3) return 100;
  if (pcr < 0.7) return clamp((pcr / 0.7) * 70);
  return clamp(100 - ((pcr - 1.3) / 0.7) * 70);
}

// ---------- Composite ----------

export interface CompositeBreakdown {
  total: number;
  quality: number;   // NEW: ROE/ROCE
  leverage: number;  // NEW: D/E
  valuation: number; // Combined PE + Upside
  momentum: number;
  volume: number;
  rsi: number;
  mcap: number;
}

export interface FnoCompositeBreakdown {
  total: number;
  oi: number;
  oiChange: number;
  momentum: number;
  iv: number;
  volume: number;
  pcr: number;
}

export interface ScoreInput {
  pe?: number;
  sectorPe?: number;
  marketCapCr?: number;
  roe?: number;
  roce?: number;
  de?: number;
  pledge?: number;
  upsidePct?: number;
}

/**
 * Equity composite (Expert Logic).
 * Weights (100 total):
 *  - Quality (30): ROE/ROCE 15, D/E 10, Pledging 5
 *  - Valuation (20): P/E 10, Upside 10
 *  - Technical (35): Momentum 15, Volume 10, RSI 10
 *  - Safety/Size (15): Mcap 10, 52W Proximity 5
 */
export function computeEquityScore(
  live: LiveQuote | undefined,
  input: ScoreInput,
): CompositeBreakdown {
  const momentum = momentumScore(live?.momentum5d);
  const volume = volumeScore(live?.volume ?? 0, live?.avgVolume3M);
  const proximity52w = live ? proximityScore(live.price, live.fiftyTwoWeekHigh, live.fiftyTwoWeekLow) : 50;
  const pe = peScore(input.pe, input.sectorPe);
  const rsi = rsiScore(live?.rsi14);
  const mcap = mcapScore(input.marketCapCr);
  
  const quality = qualityScore(input.roe, input.roce);
  const leverage = leverageScore(input.de);
  const pledge = pledgingScore(input.pledge);
  const upside = upsideScore(input.upsidePct);

  let total =
    quality * 0.15 +
    leverage * 0.10 +
    pledge * 0.05 +
    pe * 0.10 +
    upside * 0.10 +
    momentum * 0.15 +
    volume * 0.10 +
    rsi * 0.10 +
    mcap * 0.10 +
    proximity52w * 0.05;

  // --- VALUATION SAFETY CAP (Expert Logic) ---
  // If price is significantly above analyst target, we MUST cap the score 
  // to avoid "Strong Buy" recommendations on overextended stocks.
  if (input.upsidePct !== undefined && input.upsidePct < 0) {
    const upside = input.upsidePct;
    let cap = 100;
    if (upside < -20) cap = 35;      // Deeply overvalued -> AVOID
    else if (upside < -10) cap = 55; // Significantly overvalued -> HOLD
    else if (upside < -2) cap = 70;  // Slightly above target -> Max BUY (No Strong Buy)
    total = Math.min(total, cap);
  }

  return {
    total: Math.round(total),
    quality: Math.round(quality),
    leverage: Math.round(leverage),
    valuation: Math.round((pe + upside) / 2),
    momentum: Math.round(momentum),
    volume: Math.round(volume),
    rsi: Math.round(rsi),
    mcap: Math.round(mcap),
  };
}

export interface FnoScoreInput {
  oi?: string;
  oiChangePct?: number;
  iv?: string;
  pcr?: number;
}

/**
 * F&O composite.
 * Weights: OI 20, OI chg 20, momentum 20, IV 15, volume 15, PCR 10.
 */
export function computeFnoScore(
  live: LiveQuote | undefined,
  input: FnoScoreInput,
): FnoCompositeBreakdown {
  const oi = oiScore(input.oi);
  const oiChange = oiChangeScore(input.oiChangePct);
  const momentum = momentumScore(live?.momentum5d);
  const iv = ivScore(input.iv);
  const volume = volumeScore(live?.volume ?? 0, live?.avgVolume3M);
  const pcr = pcrScore(input.pcr);
  const total =
    oi * 0.2 +
    oiChange * 0.2 +
    momentum * 0.2 +
    iv * 0.15 +
    volume * 0.15 +
    pcr * 0.1;
  return {
    total: Math.round(total),
    oi: Math.round(oi),
    oiChange: Math.round(oiChange),
    momentum: Math.round(momentum),
    iv: Math.round(iv),
    volume: Math.round(volume),
    pcr: Math.round(pcr),
  };
}

/** Helper: pull live quote out of the LiveQuoteState map. */
export function quoteOf(state: LiveQuoteState | undefined): LiveQuote | undefined {
  return state?.status === "ok" ? state.quote : undefined;
}

// ---------- Mutual Funds Scoring (Part 5) ----------

export interface MfCompositeBreakdown {
  composite: number;
  breakdown: {
    returns: number;
    riskAdjusted: number;
    cost: number;
    ratings: number;
    manager: number;
    aum: number;
  };
  tier: {
    label: string;
    badge: string;
    color: "green" | "blue" | "amber" | "red";
  };
}

export function calculateMFScore(fund: any): MfCompositeBreakdown {
  const scores: any = {};

  // ── Factor 1: Returns Quality (30%) ──
  const cagr = fund.performance?.return_5y_cagr_pct
             ?? fund.performance?.return_3y_cagr_pct
             ?? fund.performance?.return_1y_pct;
  const catAvg = fund.performance?.category_avg_1y_pct ?? 12; 
  if (cagr == null) {
    scores.returns = 50; 
  } else {
    const alpha = cagr - catAvg;
    scores.returns = Math.min(Math.max(50 + (alpha * 5), 0), 100);
  }

  // ── Factor 2: Risk-Adjusted Performance (20%) ──
  const sharpe = fund.risk_metrics?.sharpe_ratio;
  scores.riskAdjusted = sharpe == null ? 50
    : sharpe >= 1.5 ? 95
    : sharpe >= 1.0 ? 75
    : sharpe >= 0.5 ? 50
    : 25;

  // ── Factor 3: Cost Efficiency (15%) ──
  const er = fund.costs?.expense_ratio_pct;
  scores.cost = er == null ? 50
    : er <= 0.5 ? 100   
    : er <= 1.0 ? 85
    : er <= 1.5 ? 65
    : er <= 2.0 ? 45
    : 25;               

  // ── Factor 4: Ratings Consensus (15%) ──
  let ratingScore = 50;
  const vr = fund.ratings?.value_research_stars;
  const ms = fund.ratings?.morningstar_medal;
  const cr = fund.ratings?.crisil_rank;
  if (vr?.includes('5')) ratingScore += 20;
  else if (vr?.includes('4')) ratingScore += 10;
  if (ms === 'Gold') ratingScore += 15;
  else if (ms === 'Silver') ratingScore += 8;
  if (cr?.includes('1')) ratingScore += 15;
  else if (cr?.includes('2')) ratingScore += 8;
  scores.ratings = Math.min(Math.max(ratingScore, 0), 100);

  // ── Factor 5: Fund Manager Continuity (10%) ──
  const tenure = fund.fund_manager?.tenure_years;
  scores.manager = tenure == null ? 50
    : tenure >= 7 ? 100
    : tenure >= 5 ? 80
    : tenure >= 3 ? 60
    : tenure >= 1 ? 40
    : 20;

  // ── Factor 6: AUM and Scale (10%) ──
  const aum = fund.aum_crores;
  scores.aum = aum == null ? 50
    : aum >= 2000 && aum <= 30000 ? 100  
    : aum >= 1000 ? 80
    : aum >= 500  ? 60
    : aum >= 100  ? 40
    : 20;  

  const composite = Math.round(
    (scores.returns      * 0.30) +
    (scores.riskAdjusted * 0.20) +
    (scores.cost         * 0.15) +
    (scores.ratings      * 0.15) +
    (scores.manager      * 0.10) +
    (scores.aum          * 0.10)
  );

  return {
    composite: Math.min(Math.max(composite, 0), 100),
    breakdown: scores,
    tier: mfTier(composite)
  };
}

function mfTier(score: number): any {
  if (score >= 80) return { label: 'EXCEPTIONAL',   badge: '⭐⭐⭐',  color: 'green'  };
  if (score >= 65) return { label: 'RECOMMENDED',   badge: '⭐⭐',    color: 'green'  };
  if (score >= 50) return { label: 'CONSIDER',       badge: '⭐',     color: 'blue'   };
  if (score >= 35) return { label: 'REVIEW NEEDED',  badge: '⚠️',    color: 'amber'  };
  return              { label: 'AVOID',              badge: '❌',     color: 'red'    };
}
