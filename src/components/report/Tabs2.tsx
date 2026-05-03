import type { StockReport } from "@/lib/types";
import { Badge, TrendIcon } from "./Badge";

export function GrowthTab({ r }: { r: StockReport }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Is this company growing its revenue and profits?</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Metric</th>
                <th className="text-left py-2 pr-3">3Y CAGR</th>
                <th className="text-left py-2 pr-3">5Y CAGR</th>
                <th className="text-left py-2 pr-3">Trend</th>
                <th className="text-left py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {r.growth.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{row.metric}</td>
                  <td className="py-2.5 pr-3">{row.cagr3y}</td>
                  <td className="py-2.5 pr-3">{row.cagr5y}</td>
                  <td className="py-2.5 pr-3"><TrendIcon dir={row.trend} /></td>
                  <td className="py-2.5 text-muted-foreground text-xs">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">EPS — last 8 quarters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {r.eps8q.map((q, i) => {
            const pos = q.yoy.trim().startsWith("+");
            const neg = q.yoy.trim().startsWith("-");
            return (
              <div key={i} className="rounded-lg bg-secondary p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{q.quarter}</div>
                <div className="text-base font-semibold mt-1">{q.value}</div>
                <div className={`text-[11px] mt-0.5 ${pos ? "text-g-accent" : neg ? "text-r-accent" : "text-muted-foreground"}`}>{q.yoy} YoY</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">Growth classification:</span>
          <Badge label={r.growthClassification} />
        </div>
        <p className="text-sm text-muted-foreground">{r.growthSummary}</p>
      </div>
    </div>
  );
}

export function HealthTab({ r }: { r: StockReport }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Is this company financially safe and stable?</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Metric</th>
                <th className="text-left py-2 pr-3">Value</th>
                <th className="text-left py-2 pr-3">5Y trend</th>
                <th className="text-left py-2 pr-3">Signal</th>
                <th className="text-left py-2">Plain English</th>
              </tr>
            </thead>
            <tbody>
              {r.health.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{row.metric}</td>
                  <td className="py-2.5 pr-3">{row.value}</td>
                  <td className="py-2.5 pr-3"><TrendIcon dir={row.trend} /></td>
                  <td className="py-2.5 pr-3"><Badge label={row.signal} /></td>
                  <td className="py-2.5 text-muted-foreground text-xs">{row.plain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Forward projections — {r.horizonYears} year horizon</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Scenario</th>
                <th className="text-left py-2 pr-3">Assumption</th>
                <th className="text-left py-2 pr-3">Est. revenue</th>
                <th className="text-left py-2 pr-3">Est. net profit</th>
                <th className="text-left py-2">Est. EPS</th>
              </tr>
            </thead>
            <tbody>
              {r.scenarios.map((s, i) => {
                const icon = s.name === "Bear" ? "🐢" : s.name === "Base" ? "🚶" : "🚀";
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{icon} {s.name}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">{s.assumption}</td>
                    <td className="py-2.5 pr-3">{s.revenue}</td>
                    <td className="py-2.5 pr-3">{s.netProfit}</td>
                    <td className="py-2.5">{s.eps}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 italic">Projections based on historical CAGR trends only — not guarantees or predictions.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">Financial health:</span>
          <Badge label={r.healthOverall} />
        </div>
        <p className="text-sm text-muted-foreground">{r.healthSummary}</p>
      </div>
    </div>
  );
}

export function ReturnsTab({ r }: { r: StockReport }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Is this company creating real value for shareholders?</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Metric</th>
                <th className="text-left py-2 pr-3">Current</th>
                <th className="text-left py-2 pr-3">3Y avg</th>
                <th className="text-left py-2 pr-3">5Y avg</th>
                <th className="text-left py-2">Signal</th>
              </tr>
            </thead>
            <tbody>
              {r.returns.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{row.metric}</td>
                  <td className="py-2.5 pr-3">{row.current}</td>
                  <td className="py-2.5 pr-3">{row.avg3y}</td>
                  <td className="py-2.5 pr-3">{row.avg5y}</td>
                  <td className="py-2.5">{row.signal === "—" ? <span className="text-muted-foreground">—</span> : <Badge label={row.signal} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">ROE above 15% = good · ROCE above 15% = efficient capital use</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">Return quality:</span>
          <Badge label={r.returnQuality} />
        </div>
        <p className="text-sm text-muted-foreground">{r.returnSummary}</p>
      </div>
    </div>
  );
}
