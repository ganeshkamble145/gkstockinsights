import { supabase } from "@/integrations/supabase/client";

export async function getLearningPrompt(): Promise<string> {
  try {
    // 1. Fetch recent WINS and LOSSES
    const { data: outcomes } = await supabase
      .from("recommendations")
      .select(`
        symbol, tab_type, strategy, outcome_label:recommendation_outcomes(outcome_label, profit_pct)
      `)
      .not("recommendation_outcomes", "is", null)
      .order("recommended_at", { ascending: false })
      .limit(20);

    if (!outcomes || outcomes.length === 0) {
      return "No historical performance data available yet. Use your general institutional knowledge.";
    }

    const wins = outcomes.filter(o => (o.outcome_label as any)?.[0]?.outcome_label === "WIN").slice(0, 5);
    const losses = outcomes.filter(o => (o.outcome_label as any)?.[0]?.outcome_label === "LOSS").slice(0, 5);

    let prompt = "\n\n### SELF-LEARNING FEEDBACK (MOST RECENT PERFORMANCE)\n";
    prompt += "Use the following actual market outcomes to refine your current stock selection strategy:\n\n";

    if (wins.length > 0) {
      prompt += "SUCCESSFUL PICKS (WINS):\n";
      wins.forEach(w => {
        prompt += `- ${w.symbol} (${w.tab_type}): Strategy used was "${w.strategy}". This resulted in a profit.\n`;
      });
    }

    if (losses.length > 0) {
      prompt += "\nFAILED PICKS (LOSSES):\n";
      losses.forEach(l => {
        prompt += `- ${l.symbol} (${l.tab_type}): Strategy used was "${l.strategy}". This resulted in a loss. ANALYZE AND AVOID SIMILAR PATTERNS.\n`;
      });
    }

    prompt += "\nINSTRUCTION: Adjust your selection logic to replicate the successful patterns and avoid the factors that led to the failed picks.";
    
    return prompt;
  } catch (e) {
    console.error("Self-learning fetch failed:", e);
    return "";
  }
}
