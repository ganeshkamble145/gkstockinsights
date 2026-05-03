import { cn } from "@/lib/utils";

export function ScoringLegend() {
  return (
    <div className="mt-12 space-y-8 border-t border-border pt-8">
      <section>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
          AI Recommendation Labels
        </h3>
        <div className="grid gap-3 sm:grid-cols-5">
          <LegendItem 
            label="STRONG BUY" 
            score="80-100" 
            tone="strong-buy" 
            desc="Exceptional alignment of fundamentals, momentum, and valuation." 
          />
          <LegendItem 
            label="BUY" 
            score="60-79" 
            tone="buy" 
            desc="Healthy setup with positive growth outlook and fair entry price." 
          />
          <LegendItem 
            label="HOLD" 
            score="40-59" 
            tone="hold" 
            desc="Neutral stance. Wait for clearer trend or better valuation." 
          />
          <LegendItem 
            label="AVOID" 
            score="20-39" 
            tone="avoid" 
            desc="Significant fundamental concerns or extreme overvaluation." 
          />
          <LegendItem 
            label="SELL" 
            score="0-19" 
            tone="sell" 
            desc="Critical red flags. High risk of capital erosion." 
          />
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            Expert Equity Logic (0-100)
          </h3>
          <div className="space-y-2.5">
            <WeightBar label="Quality (ROE / ROCE)" weight={15} />
            <WeightBar label="Leverage (Debt / Equity)" weight={10} />
            <WeightBar label="Valuation (P/E vs Sector)" weight={10} />
            <WeightBar label="Analyst Target Upside %" weight={10} />
            <WeightBar label="Price Momentum (5-Day)" weight={15} />
            <WeightBar label="Relative Volume Spike" weight={10} />
            <WeightBar label="RSI / Overbought-Oversold" weight={10} />
            <WeightBar label="Safety (Promoter Pledging / Cap)" weight={10} />
            <WeightBar label="52W High Proximity" weight={5} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            Expert mode balances fundamental quality (30%), valuation (20%), and 
            technical momentum (35%) to find institutional-grade compounders.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            F&O Scoring Logic (0-100)
          </h3>
          <div className="space-y-2.5">
            <WeightBar label="Open Interest (OI) Size" weight={20} />
            <WeightBar label="OI Change %" weight={20} />
            <WeightBar label="Price Momentum" weight={20} />
            <WeightBar label="IV / Option Pricing" weight={15} />
            <WeightBar label="Volume Spike" weight={15} />
            <WeightBar label="Put-Call Ratio (PCR)" weight={10} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            F&O scores focus on institutional positioning (OI) and volatility (IV) to identify 
            high-probability trading setups.
          </p>
        </div>
      </section>
    </div>
  );
}

function LegendItem({ label, score, tone, desc }: { label: string; score: string; tone: string; desc: string }) {
  const tones: Record<string, string> = {
    "strong-buy": "bg-g-fill text-g-text border-g-accent",
    "buy": "bg-g-fill text-g-text border-g-accent/50",
    "hold": "bg-a-fill text-a-text border-a-border",
    "avoid": "bg-r-fill text-r-text border-r-accent/50",
    "sell": "bg-r-fill text-r-text border-r-accent",
  };

  return (
    <div className={cn("rounded-lg border p-3 flex flex-col gap-1.5", tones[tone])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider">{label}</span>
        <span className="text-[10px] font-medium opacity-80">{score}</span>
      </div>
      <p className="text-[11px] leading-snug opacity-90">{desc}</p>
    </div>
  );
}

function WeightBar({ label, weight }: { label: string; weight: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{weight}%</span>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div 
          className="h-full bg-foreground/40 rounded-full" 
          style={{ width: `${weight}%` }}
        />
      </div>
    </div>
  );
}
