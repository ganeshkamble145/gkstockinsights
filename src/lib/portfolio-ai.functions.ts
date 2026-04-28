/**
 * portfolio-ai.functions.ts
 * Server function: get AI recommendation for a list of portfolio symbols.
 * Uses existing callAIWithFallback (Gemini cascade).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAIWithFallback, parseAIJson } from "./ai-provider";

const InputSchema = z.object({
  symbols: z.array(z.string()),
});

export interface PortfolioAIResult {
  symbol: string;
  verdict: "STRONG BUY" | "BUY" | "HOLD" | "AVOID" | "SELL";
  score: number;
  strategy: string;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  reasoning: string;
  risks: string[];
  confidence_pct: number;
  technical_trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
}

export interface PortfolioAIResponse {
  results: PortfolioAIResult[];
  error: string | null;
}

function buildPrompt(symbols: string[]): string {
  const list = symbols.map((s) => `- ${s} (NSE/BSE)`).join("\n");
  return `You are an expert Indian stock market analyst. Analyse the following stocks listed on NSE India and provide a JSON recommendation for each.

Stocks to analyse:
${list}

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "results": [
    {
      "symbol": "SYMBOL",
      "verdict": "STRONG BUY",
      "score": 75,
      "confidence_pct": 80,
      "strategy": "Momentum Buy on Support",
      "entry_price": 0,
      "target_price": 0,
      "stop_loss": 0,
      "reasoning": "2-sentence reason for this recommendation based on fundamentals and technicals.",
      "risks": ["Risk 1", "Risk 2"],
      "technical_trend": "UPTREND"
    }
  ]
}

Rules:
- verdict must be one of: STRONG BUY, BUY, HOLD, AVOID, SELL
- score: 0-100 (100 = strongest buy)
- confidence_pct: 0-100
- technical_trend: UPTREND, DOWNTREND, or SIDEWAYS
- entry_price, target_price, stop_loss: realistic INR prices (not 0) based on your latest knowledge
- reasoning: exactly 2 sentences, specific to this stock
- Return ALL ${symbols.length} symbols in the results array`;
}

export const getPortfolioAI = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<PortfolioAIResponse> => {
    if (data.symbols.length === 0) {
      return { results: [], error: null };
    }

    const aiRes = await callAIWithFallback([
      {
        role: "system",
        content:
          "You are an Indian stock market AI analyst. Use your latest training knowledge of NSE/BSE listed companies. Return ONLY valid JSON — no markdown fences, no extra text. EDUCATIONAL purposes only — not SEBI-registered investment advice.",
      },
      { role: "user", content: buildPrompt(data.symbols) },
    ]);

    if (!aiRes.content) {
      return { results: [], error: aiRes.error ?? "AI request failed" };
    }

    interface ParsedResponse {
      results: PortfolioAIResult[];
    }
    const parsed = parseAIJson<ParsedResponse>(aiRes.content);
    if (!parsed?.results) {
      return { results: [], error: "Could not parse AI response" };
    }

    return { results: parsed.results, error: null };
  });
