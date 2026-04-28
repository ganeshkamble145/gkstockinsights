import type { StockReport } from "@/lib/types";
import { Badge } from "./Badge";

const REC_TONE: Record<string, "ok" | "warn" | "bad" | "info"> = {
  BUY: "ok",
  ACCUMULATE: "ok",
  HOLD: "info",
  REDUCE: "warn",
  SELL: "bad",
};

const BIAS_TONE: Record<string, "ok" | "warn" | "bad"> = {
  BULLISH: "ok",
  NEUTRAL: "warn",
  BEARISH: "bad",
};

const RISK_TONE: Record<string, "ok" | "warn" | "bad"> = {
  LOW: "ok",
  MEDIUM: "warn",
  HIGH: "bad",
};

export function StrategyTab({ r }: { r: StockReport }) {
  const recTone = REC_TONE[r.recommendation] ?? "info";
  const recCard =
    recTone === "ok" ? "bg-g-fill border-g-border" :
    recTone === "warn" ? "bg-a-fill border-a-border" :
    recTone === "bad" ? "bg-r-fill border-r-border" :
    "bg-b-fill border-b-border";
  const recText =
    recTone === "ok" ? "text-g-text" :
    recTone === "warn" ? "text-a-text" :
    recTone === "bad" ? "text-r-text" :
    "text-b-text";

  return (
    <div className="space-y-4">
      {/* AI Recommendation */}
      <div className={`rounded-xl border p-6 ${recCard}`}>
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
              <span className={recText}>AI fundamental recommendation</span>
            </div>
            <div className={`text-3xl font-bold ${recText}`}>{r.recommendation}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
              <span className={recText}>Confidence</span>
            </div>
            <Badge label={r.recommendationConfidence} tone={
              r.recommendationConfidence === "HIGH" ? "ok" :
              r.recommendationConfidence === "MEDIUM" ? "warn" : "bad"
            } />
          </div>
        </div>
        <p className={`text-sm leading-relaxed ${recText}`}>{r.recommendationRationale}</p>
        <div className={`mt-4 pt-3 border-t border-current/15 text-xs ${recText} opacity-80`}>
          <strong>Suitable for:</strong> {r.suitableFor}
        </div>
      </div>

      {/* F&O Strategy */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-base font-semibold">Futures &amp; Options strategy</h3>
          <div className="flex gap-2">
            <Badge label={r.foBias} tone={BIAS_TONE[r.foBias]} />
            <Badge label={`${r.foRiskLevel} RISK`} tone={RISK_TONE[r.foRiskLevel]} />
          </div>
        </div>

        <div className="rounded-lg bg-secondary p-4 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Strategy</div>
          <div className="text-lg font-semibold">{r.foStrategyName}</div>
          <p className="text-sm text-muted-foreground mt-2">{r.foRationale}</p>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Trade legs</div>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Action</th>
                <th className="text-left py-2 pr-3">Instrument</th>
                <th className="text-left py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {r.foLegs.map((leg, i) => {
                const isBuy = leg.action.toLowerCase().startsWith("buy");
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                        isBuy ? "bg-g-fill text-g-text" : "bg-r-fill text-r-text"
                      }`}>{leg.action}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{leg.instrument}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{leg.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <PayoffBox label="Max profit" value={r.foMaxProfit} tone="ok" />
          <PayoffBox label="Max loss" value={r.foMaxLoss} tone="bad" />
          <PayoffBox label="Breakeven" value={r.foBreakeven} tone="info" />
        </div>

        {r.foNotes && r.foNotes.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Things to know</div>
            <ul className="space-y-1.5">
              {r.foNotes.map((n, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="rounded-xl border border-a-border bg-a-fill p-4 text-xs text-a-text leading-relaxed">
        <strong>⚠ Educational only.</strong> The recommendation and F&amp;O strategy are AI-generated views based on
        fundamentals — not SEBI-registered investment advice or a guaranteed trade plan. F&amp;O carries leverage and
        can result in losses larger than your capital. Always verify, paper-trade first, and consult a SEBI-registered
        advisor before acting.
      </div>
    </div>
  );
}

function PayoffBox({ label, value, tone }: { label: string; value: string; tone: "ok" | "bad" | "info" }) {
  const cls = tone === "ok" ? "bg-g-fill text-g-text" : tone === "bad" ? "bg-r-fill text-r-text" : "bg-b-fill text-b-text";
  return (
    <div className={`rounded-lg p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80 mb-1">{label}</div>
      <div className="text-sm font-medium leading-snug">{value}</div>
    </div>
  );
}
