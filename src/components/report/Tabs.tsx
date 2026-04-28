import type { StockReport } from "@/lib/types";
import { Badge } from "./Badge";

export function SnapshotTab({ r }: { r: StockReport }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Company" value={r.company} />
          <Row label="Ticker" value={r.ticker} />
          <Row label="Sector" value={r.sector} />
          <Row label="Industry" value={r.industry} />
        </div>
        <div className="mt-4 border-t border-border pt-4 space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">What it does</div>
            <div className="text-sm">{r.whatItDoes}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">What makes it different</div>
            <div className="text-sm">{r.whatMakesItDifferent}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Metric label="CMP" value={r.cmp} sub={r.cmpTime} />
        <Metric label="52W High" value={r.high52w} sub="NSE" />
        <Metric label="52W Low" value={r.low52w} sub="NSE" />
        <Metric label="Market Cap" value={r.marketCap} sub="BSE" />
        <Metric label="Face Value" value={r.faceValue} sub="NSE" />
      </div>

      {r.flags && r.flags.length > 0 && (
        <div className="space-y-2">
          {r.flags.map((f, i) => (
            <div key={i} className="border-l-4 border-a-accent bg-a-fill rounded-r-lg p-3 px-4">
              <div className="text-sm font-medium text-a-text">{f.title}</div>
              <div className="text-xs text-a-text mt-0.5">{f.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-secondary p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function ValuationTab({ r }: { r: StockReport }) {
  const labels = ["P/E", "P/B", "EV/EBITDA"];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Is this stock cheap, fair, or expensive right now?</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Metric</th>
                <th className="text-left py-2 pr-3">Current</th>
                <th className="text-left py-2 pr-3">Sector avg</th>
                <th className="text-left py-2 pr-3">Stock 5Y avg</th>
                <th className="text-left py-2 pr-3">Signal</th>
                <th className="text-left py-2">Plain English</th>
              </tr>
            </thead>
            <tbody>
              {r.valuation.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{labels[i] ?? row.plain}</td>
                  <td className="py-2.5 pr-3">{row.current}</td>
                  <td className="py-2.5 pr-3">{row.sectorAvg}</td>
                  <td className="py-2.5 pr-3">{row.fiveYAvg}</td>
                  <td className="py-2.5 pr-3"><Badge label={row.signal} /></td>
                  <td className="py-2.5 text-muted-foreground">{row.plain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">Overall valuation:</span>
          <Badge label={r.valuationOverall} />
        </div>
        <p className="text-sm text-muted-foreground">{r.valuationSummary}</p>
      </div>
    </div>
  );
}
