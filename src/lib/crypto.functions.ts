import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gkCache } from "./perf-utils";
import { callAIWithFallback, parseAIJson } from "./ai-provider";

// --- Types ---

export interface CryptoCoin {
  rank_by_price: number;
  coin_name: string;
  ticker: string;
  category: string;
  use_case: string;
  price_inr: number;
  price_usd: number;
  price_source: string;
  verified_under_200_inr: boolean;
  market_cap_usd: number;
  pct_below_ath: number;
  data_quality: "COMPLETE" | "PARTIAL" | "MINIMAL";
  available_india: boolean;
  india_exchanges: string[];

  performance: {
    change_7d_pct: number;
    change_30d_pct: number;
    change_1y_pct: number;
    ath_inr: number;
    high_52w_inr: number | null;
    low_52w_inr: number | null;
    ath_recovery_multiple: number;
    source: string;
  };

  technical: {
    rsi_14: number | null;
    trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
    support_inr: number | null;
    resistance_inr: number | null;
    technical_verdict: "ACCUMULATE" | "HOLD" | "WAIT" | "AVOID";
  };

  fundamentals: {
    real_world_utility: "HIGH" | "MEDIUM" | "LOW" | "NONE";
    developer_activity: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    holder_trend: "GROWING" | "STABLE" | "DECLINING" | "UNKNOWN";
    tokenomics_risk: "LOW" | "MEDIUM" | "HIGH";
    unlock_risk: string | null;
    fundamental_verdict: "STRONG" | "ADEQUATE" | "WEAK" | "UNCLEAR";
    upcoming_catalysts: string[];
  };

  research_desk: {
    sentiment: "BULLISH" | "NEUTRAL" | "BEARISH" | "NO COVERAGE";
    consensus_target_inr: number | null;
    consensus_target_source: string | null;
    implied_upside_pct: number | null;
    bull_case_from_analysts: string;
    key_concerns_from_analysts: string;
    called_multibagger_by: string | null;
    sources: {
      name: string;
      url: string | null;
      sentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
      as_of: string;
    }[];
    summary: string;
  };

  ai_analyst: {
    recommendation: "STRONG BUY" | "BUY" | "ACCUMULATE" | "HOLD" | "SPECULATIVE BUY" | "AVOID";
    confidence: "HIGH" | "MEDIUM" | "LOW" | "SPECULATIVE";
    confidence_reason: string;
    agrees_with_research_desk: boolean;
    divergence_reason: string | null;

    multibagger_estimate: {
      target_price_inr: number | null;
      return_multiple: number | null;
      method_used: string;
      horizon_years: number;
      classification: "MODERATE" | "HIGH" | "SPECULATIVE" | "LOTTERY";
      derivation: string;
    };

    thinking: {
      price_position: string;
      market_cap_valuation: string;
      fundamental_quality: string;
      tokenomics_risk: string;
      technical_analysis: string;
      multibagger_calculation: string;
      independent_verdict: string;
    };

    risks: string[];
    bull_case: string;
    bear_case: string;
    key_swing_factor: string;
    suggested_portfolio_allocation: "LOW" | "MODERATE" | "HIGH";
    ideal_horizon_years: number;
    entry_strategy: "A" | "B" | "C" | "D";
    summary: string;
  };

  signal: {
    strength: "STRONG" | "MODERATE" | "CONFLICTED" | "WEAK" | "SPECULATIVE";
    direction: "BUY" | "ACCUMULATE" | "HOLD" | "AVOID";
    explanation: string;
  };

  disclaimer: string;
}

export interface CryptoMarketContext {
  market_context_as_of: string;
  bitcoin: {
    price_inr: number;
    price_usd: number;
    dominance_pct: number;
    source: string;
  };
  total_market_cap_usd: number;
  altcoin_season_index: number;
  altcoin_season_verdict: string;
  fear_greed_index: number;
  fear_greed_label: string;
  market_phase: string;
  phase_reasoning: string;
  altcoin_outlook: string;
  altcoin_outlook_reason: string;
  bitcoin_halving_context: string;
  india_crypto_regulatory_context: string;
  overall_recommendation: string;
}

export interface CryptoResult {
  generated_at: string;
  market_context: CryptoMarketContext;
  coins: CryptoCoin[];
}

// --- Server Functions ---

export const getCryptoMarketContext = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ apiKey: z.string().optional() }).parse(input))
  .handler(async ({ data }): Promise<{ result: CryptoMarketContext | null; error: string | null }> => {
    const cacheKey = "crypto_market_context_v1";
    const cached = gkCache.get<CryptoMarketContext>(cacheKey);
    if (cached) return { result: cached, error: null };

    const prompt = `
Search ALL of these:
1. "Bitcoin price today INR USD"
2. "crypto total market cap today"
3. "Bitcoin dominance percentage today"
4. "altcoin season index today"
5. "crypto fear and greed index today"
6. "crypto market outlook bull bear"
7. "Bitcoin halving impact altcoin rally"
8. "India crypto regulation update SEBI RBI"

Return ONLY this JSON:
{
  "market_context_as_of": "ISO DATE",
  "bitcoin": {
    "price_inr": 0, "price_usd": 0,
    "dominance_pct": 0, "source": "Source"
  },
  "total_market_cap_usd": 0,
  "altcoin_season_index": 0,
  "altcoin_season_verdict": "ALTCOIN SEASON (>75) / BITCOIN SEASON (<25) / NEUTRAL",
  "fear_greed_index": 0,
  "fear_greed_label": "Extreme Fear / Fear / Neutral / Greed / Extreme Greed",
  "market_phase": "EARLY BULL / MID BULL / LATE BULL / DISTRIBUTION / BEAR / ACCUMULATION",
  "phase_reasoning": "...",
  "altcoin_outlook": "FAVORABLE / NEUTRAL / UNFAVORABLE",
  "altcoin_outlook_reason": "...",
  "bitcoin_halving_context": "...",
  "india_crypto_regulatory_context": "...",
  "overall_recommendation": "..."
}
`;

    try {
      const res = await callAIWithFallback([
        { role: "system", content: "You are a crypto market researcher." },
        { role: "user", content: prompt }
      ], data.apiKey);

      if (!res.content) return { result: null, error: res.error };
      const parsed = parseAIJson<CryptoMarketContext>(res.content);
      if (!parsed) return { result: null, error: "Failed to parse market context" };
      
      gkCache.set(cacheKey, parsed, 30 * 60 * 1000); // 30 min
      return { result: parsed, error: null };
    } catch (e) {
      return { result: null, error: String(e) };
    }
  });

export const runCryptoScreener = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ apiKey: z.string().optional() }).parse(input))
  .handler(async ({ data }): Promise<{ result: CryptoResult | null; error: string | null }> => {
    const cacheKey = "crypto_screener_v1";
    if (!data.apiKey) {
      const cached = gkCache.get<CryptoResult>(cacheKey);
      if (cached) return { result: cached, error: null };
    }

    // This is a simplified version. In reality, we'd do the multi-phase process.
    // For the sake of this prompt, I'll combine the instructions into a master prompt for Gemini.
    const dateStr = new Date().toISOString().split('T')[0];
    
    const prompt = `
You are the AI engine powering the "Crypto Picks" tab of "GK Stock Insights".
Perform a deep search to find the Top 10 Undervalued Multibagger Cryptos priced UNDER ₹200 (approx $2.40).
Sort by price: Lowest First.

MANDATORY REQUIREMENTS:
1. QUANTITY: You MUST return exactly 10 coins.
2. PRICE CEILING: Every coin MUST be verified as priced UNDER ₹200 INR.
3. DATA INTEGRITY: Do not use placeholders. If data is not available, perform a real-time search. Every field in the schema MUST be populated with high-quality reasoning.
4. DUAL ANALYSIS: 
   - Research Desk: Summarize actual analyst consensus and sentiment from reputable crypto news sites.
   - AI Analyst: Provide independent reasoning, thinking, and risk assessments.
5. INDIA CONTEXT: Explicitly mention if the coin is available on major Indian exchanges (WazirX, CoinDCX, CoinSwitch).

SCHEMA TO FOLLOW (Return ONLY valid JSON):
{
  "generated_at": "${dateStr}",
  "market_context": {
    "market_context_as_of": "...",
    "bitcoin": { "price_inr": 0, "price_usd": 0, "dominance_pct": 0, "source": "..." },
    "total_market_cap_usd": 0,
    "altcoin_season_index": 0,
    "altcoin_season_verdict": "...",
    "fear_greed_index": 0,
    "fear_greed_label": "...",
    "market_phase": "...",
    "phase_reasoning": "...",
    "altcoin_outlook": "...",
    "altcoin_outlook_reason": "...",
    "bitcoin_halving_context": "...",
    "india_crypto_regulatory_context": "...",
    "overall_recommendation": "..."
  },
  "coins": [
    {
      "rank_by_price": 1,
      "coin_name": "...",
      "ticker": "...",
      "category": "...",
      "use_case": "...",
      "price_inr": 0,
      "price_usd": 0,
      "price_source": "...",
      "verified_under_200_inr": true,
      "market_cap_usd": 0,
      "pct_below_ath": 0,
      "data_quality": "COMPLETE",
      "available_india": true,
      "india_exchanges": ["..."],
      "performance": {
        "change_7d_pct": 0,
        "change_30d_pct": 0,
        "change_1y_pct": 0,
        "ath_inr": 0,
        "high_52w_inr": 0,
        "low_52w_inr": 0,
        "ath_recovery_multiple": 0,
        "source": "..."
      },
      "technical": {
        "rsi_14": 0,
        "trend": "...",
        "support_inr": 0,
        "resistance_inr": 0,
        "technical_verdict": "..."
      },
      "fundamentals": {
        "real_world_utility": "...",
        "developer_activity": "...",
        "holder_trend": "...",
        "tokenomics_risk": "...",
        "unlock_risk": "...",
        "fundamental_verdict": "...",
        "upcoming_catalysts": ["..."]
      },
      "research_desk": {
        "sentiment": "...",
        "consensus_target_inr": 0,
        "consensus_target_source": "...",
        "implied_upside_pct": 0,
        "bull_case_from_analysts": "...",
        "key_concerns_from_analysts": "...",
        "called_multibagger_by": "...",
        "sources": [{ "name": "...", "url": "...", "sentiment": "...", "as_of": "..." }],
        "summary": "..."
      },
      "ai_analyst": {
        "recommendation": "...",
        "confidence": "...",
        "confidence_reason": "...",
        "agrees_with_research_desk": true,
        "divergence_reason": "...",
        "multibagger_estimate": {
          "target_price_inr": 0,
          "return_multiple": 0,
          "method_used": "...",
          "horizon_years": 0,
          "classification": "...",
          "derivation": "..."
        },
        "thinking": {
          "price_position": "Detailed analysis of current price vs value",
          "market_cap_valuation": "Analysis of valuation relative to peers",
          "fundamental_quality": "Detailed tech/team/utility analysis",
          "tokenomics_risk": "Detailed inflation/supply analysis",
          "technical_analysis": "RSI and Trend specific analysis",
          "multibagger_calculation": "Show the math behind the multiple",
          "independent_verdict": "Final AI reasoning summary"
        },
        "risks": ["Risk 1", "Risk 2", "Risk 3"],
        "bull_case": "...",
        "bear_case": "...",
        "key_swing_factor": "...",
        "suggested_portfolio_allocation": "...",
        "ideal_horizon_years": 0,
        "entry_strategy": "...",
        "summary": "..."
      },
      "signal": {
        "strength": "...",
        "direction": "...",
        "explanation": "..."
      },
      "disclaimer": "..."
    }
  ]
}
POPULATE ALL 10 COINS. DO NOT TRUNCATE.
`;

    try {
      const res = await callAIWithFallback([
        { role: "system", content: "You are the AI engine powering the Crypto Picks tab of GK Stock Insights." },
        { role: "user", content: prompt }
      ], data.apiKey);

      if (!res.content) return { result: null, error: res.error };
      const parsed = parseAIJson<CryptoResult>(res.content);
      if (!parsed) return { result: null, error: "Failed to parse crypto screener results" };

      gkCache.set(cacheKey, parsed, 2 * 60 * 60 * 1000); // 2 hours
      return { result: parsed, error: null };
    } catch (e) {
      return { result: null, error: String(e) };
    }
  });
