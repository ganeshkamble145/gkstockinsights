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
  momentum: number;
  volume: number;
  proximity52w: number;
  pe: number;
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
}

/**
 * Equity composite (penny / nifty).
 * Weights: momentum 25, volume 20, 52W 15, P/E 15, RSI 15, mcap 10.
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
  const total =
    momentum * 0.25 +
    volume * 0.2 +
    proximity52w * 0.15 +
    pe * 0.15 +
    rsi * 0.15 +
    mcap * 0.1;
  return {
    total: Math.round(total),
    momentum: Math.round(momentum),
    volume: Math.round(volume),
    proximity52w: Math.round(proximity52w),
    pe: Math.round(pe),
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
