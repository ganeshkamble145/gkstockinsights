import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LogRecommendationParams {
  symbol: string;
  tab_type: "penny" | "nifty100" | "fo" | "analyser";
  recommendation: string;
  strategy: string;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  composite_score: number;
  ai_model_used: string;
  min_investment: number;
}

export async function logRecommendation(params: LogRecommendationParams) {
  try {
    // Map internal types to DB allowed types
    const dbTabType = params.tab_type === "analyser" ? "nifty100" : params.tab_type;
    
    // DB check constraint expects EXACT uppercase: 'STRONG BUY','BUY','HOLD','AVOID','SELL'
    const dbRec = params.recommendation.toUpperCase();

    const { data, error } = await supabase.from("recommendations").insert({
      symbol: params.symbol,
      tab_type: dbTabType,
      recommendation: dbRec,
      strategy: params.strategy,
      entry_price: params.entry_price,
      target_price: params.target_price,
      stop_loss: params.stop_loss,
      composite_score: params.composite_score,
      ai_model_used: params.ai_model_used,
      min_investment: params.min_investment,
    }).select();

    if (error) {
      console.warn(`Failed to log ${params.symbol}:`, error);
      toast.error(`DB Error (${params.symbol}): ${error.message}`);
    } else {
      console.log(`Successfully logged ${params.symbol} to DB.`);
    }
    return { data, error };
  } catch (e) {
    console.warn("Error logging recommendation:", e);
  }
}
