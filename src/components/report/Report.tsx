import { useState } from "react";
import type { StockReport } from "@/lib/types";
import { SnapshotTab, ValuationTab } from "./Tabs";
import { GrowthTab, HealthTab, ReturnsTab } from "./Tabs2";
import { PeersTab, OwnershipTab, ViewTab } from "./Tabs3";
import { StrategyTab } from "./StrategyTab";
import { LiveStockSnapshot } from "@/components/screener/LiveStockSnapshot";
import { PriceAlerts } from "@/components/screener/PriceAlerts";
import { MarketStatusBadge } from "@/components/screener/MarketStatusBadge";
import { cn } from "@/lib/utils";

const TABS = ["Snapshot", "Valuation", "Growth", "Health", "Returns", "Peers", "Ownership", "View", "Strategy"] as const;

export function Report({ report }: { report: StockReport }) {
  // Default active tab = "View" (index 7) per spec
  const [active, setActive] = useState(7);

  const conf = report.confidence;
  const confTone =
    conf === "HIGH" || conf === "MODERATE" ? "bg-g-fill text-g-text"
    : conf === "LOW" ? "bg-a-fill text-a-text"
    : "bg-r-fill text-r-text";

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{report.company}</h1>
          <p className="text-sm text-muted-foreground">{report.ticker} · {report.sector}</p>
        </div>
        <MarketStatusBadge />
      </header>

      <LiveStockSnapshot symbol={report.ticker} />
      <PriceAlerts symbol={report.ticker} />

      <div className={cn("rounded-lg px-4 py-2.5 mb-4 text-xs", confTone)}>
        <strong>Data confidence: {conf}</strong>
        <span className="opacity-80"> · Live metrics: {report.liveCount} of {report.totalSections} · Sources: {report.sources.join(", ")}</span>
      </div>

      {report.dataNotice && (
        <div className="rounded-lg border border-a-border bg-a-fill px-4 py-2.5 mb-4 text-xs text-a-text">
          {report.dataNotice}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActive(i)}
            className={cn(
              "px-4 py-1.5 rounded-full border text-sm transition-colors",
              active === i
                ? "border-foreground text-foreground font-medium"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {active === 0 && <SnapshotTab r={report} />}
        {active === 1 && <ValuationTab r={report} />}
        {active === 2 && <GrowthTab r={report} />}
        {active === 3 && <HealthTab r={report} />}
        {active === 4 && <ReturnsTab r={report} />}
        {active === 5 && <PeersTab r={report} />}
        {active === 6 && <OwnershipTab r={report} />}
        {active === 7 && <ViewTab r={report} />}
        {active === 8 && <StrategyTab r={report} />}
      </div>

      <details className="mt-8">
        <summary className="text-xs text-muted-foreground cursor-pointer py-2 select-none">Definitions — tap to expand</summary>
        <div className="text-xs text-muted-foreground space-y-2 pt-2">
          <p><strong className="text-foreground">P/E ratio</strong> — What you pay per ₹1 of profit. Lower vs history and sector = cheaper.</p>
          <p><strong className="text-foreground">P/B ratio</strong> — Price vs what the company actually owns. Below 1 = buying at a discount to assets.</p>
          <p><strong className="text-foreground">EV/EBITDA</strong> — Full business value check including debt. Lower = better value.</p>
          <p><strong className="text-foreground">ROE</strong> — Profit per ₹100 invested by shareholders. Above 15% = good.</p>
          <p><strong className="text-foreground">ROCE</strong> — How efficiently the whole business uses capital. Above 15% = healthy.</p>
          <p><strong className="text-foreground">Free Cash Flow</strong> — Cash left after expenses & investments. Positive & growing = healthy.</p>
          <p><strong className="text-foreground">Promoter pledging</strong> — Founders using shares as loan collateral. Above 10% = red flag.</p>
          <p><strong className="text-foreground">CAGR</strong> — Compound Annual Growth Rate. Average yearly growth.</p>
        </div>
      </details>

      <p className="text-[11px] text-muted-foreground border-t border-border pt-4 mt-6 leading-relaxed">
        This is a fundamental screening and education tool only. Data sourced from NSE, BSE, Annual Reports, Screener.in, Moneycontrol, and public financial databases. This is NOT investment advice, a buy/sell recommendation, or SEBI-registered financial research. AI can make errors — verify all numbers on NSE, BSE, or Screener.in before making any decision. Past performance does not guarantee future results. Investing carries risk. Consult a SEBI-registered financial advisor before investing.
      </p>
    </div>
  );
}
