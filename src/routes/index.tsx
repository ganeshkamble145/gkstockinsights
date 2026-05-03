import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyseStock } from "@/lib/analyser.functions";
import type { StockReport } from "@/lib/types";
import { Report } from "@/components/report/Report";
import { ScreenerDashboard } from "@/components/screener/ScreenerDashboard";
import { FnoDashboard } from "@/components/screener/FnoDashboard";
import { AIPerformanceDashboard } from "@/components/screener/AIPerformanceDashboard";
import { MyPortfolioDashboard } from "@/components/portfolio/MyPortfolioDashboard";
import { MarketStatusBadge } from "@/components/screener/MarketStatusBadge";
import { cn } from "@/lib/utils";
import stockLogo from "@/assets/stock-logo.png";
import { SettingsModal } from "@/components/SettingsModal";
import { useGeminiKey } from "@/hooks/use-gemini-key";
import { toast } from "sonner";

type View = "analyser" | "penny" | "nifty100" | "fno" | "performance" | "portfolio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Indian Stock Fundamental Analyser — Long-Term Investor Tool" },
      { name: "description", content: "Build a complete fundamental report for any NSE/BSE listed stock. Valuation, growth, financial health, returns, peers, ownership and a clear long-term view." },
      { property: "og:title", content: "Indian Stock Fundamental Analyser" },
      { property: "og:description", content: "8-tab fundamental report for Indian stocks. For long-term investors." },
    ],
  }),
  component: Index,
});

const HORIZONS = [3, 5, 10];

function Index() {
  const analyse = useServerFn(analyseStock);
  const [view, setView] = useState<View>("analyser");
  const [ticker, setTicker] = useState("");
  const [horizon, setHorizon] = useState<number>(5);
  const [customHorizon, setCustomHorizon] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StockReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { apiKey } = useGeminiKey();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const finalHorizon = customHorizon ? parseInt(customHorizon, 10) || horizon : horizon;
      const res = await analyse({ data: { ticker: ticker.trim(), horizon: finalHorizon, apiKey: apiKey || undefined } });
      if (res.error) {
        setError(res.error);
        if (res.error.includes("429")) {
          toast.error("Rate limited. Try adding your own API key in Settings!", { duration: 5000 });
        }
      }
      else setReport(res.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setReport(null);
    setError(null);
    setTicker("");
    setCustomHorizon("");
    setHorizon(5);
  }

  if (view === "penny" || view === "nifty100") {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 sm:px-8 py-8">
        <ScreenerDashboard kind={view} onBack={() => setView("analyser")} />
      </div>
    );
  }

  if (view === "fno") {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 sm:px-8 py-8">
        <FnoDashboard onBack={() => setView("analyser")} />
      </div>
    );
  }

  if (view === "performance") {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 sm:px-8 py-8">
        <AIPerformanceDashboard onBack={() => setView("analyser")} />
      </div>
    );
  }

  if (view === "portfolio") {
    return (
      <div className="min-h-screen bg-background text-foreground px-4 sm:px-8 py-8">
        <MyPortfolioDashboard onBack={() => setView("analyser")} />
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-8 py-8">
      {!report ? (
        <div className="max-w-xl mx-auto pt-8 sm:pt-16">
          <div className="flex justify-between items-center mb-4">
            <SettingsModal />
            <MarketStatusBadge />
          </div>
          <div className="mb-8 text-center">
            <img
              src={stockLogo}
              alt="Indian Stock Fundamental Analyser logo"
              className="mx-auto mb-4 h-24 sm:h-32 w-auto rounded-xl shadow-sm object-cover"
            />
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Indian Stock Fundamental Analyser</h1>
            <p className="text-sm text-muted-foreground mt-2">For long-term investors · NSE / BSE listed companies</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <button
              onClick={() => setView("analyser")}
              className={cn(
                "px-4 py-1.5 rounded-full border text-sm font-medium transition-colors",
                view === "analyser" ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              Single Stock Analyser
            </button>
            <button
              onClick={() => setView("penny")}
              className="px-4 py-1.5 rounded-full border border-border text-muted-foreground text-sm hover:border-foreground/40 hover:text-foreground transition-colors"
            >
              Penny Stocks
            </button>
            <button
              onClick={() => setView("nifty100")}
              className="px-4 py-1.5 rounded-full border border-border text-muted-foreground text-sm hover:border-foreground/40 hover:text-foreground transition-colors"
            >
              NIFTY 100 Stocks
            </button>
            <button
              onClick={() => setView("fno")}
              className="px-4 py-1.5 rounded-full border border-border text-muted-foreground text-sm hover:border-foreground/40 hover:text-foreground transition-colors"
            >
              F&amp;O Trading
            </button>
            <button
              onClick={() => setView("performance")}
              className={cn(
                "px-4 py-1.5 rounded-full border text-sm font-medium transition-colors",
                view === "performance" ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              ⚡ AI Performance
            </button>
            <button
              onClick={() => setView("portfolio")}
              className={cn(
                "px-4 py-1.5 rounded-full border text-sm font-medium transition-colors",
                view === "portfolio" ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              📊 My Portfolio
            </button>

          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                1. Which stock?
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="TCS · RELIANCE · HDFCBANK"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">Company name or NSE/BSE ticker</p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                2. Investment horizon
              </label>
              <div className="flex flex-wrap gap-2">
                {HORIZONS.map((h) => (
                  <button
                    type="button"
                    key={h}
                    onClick={() => { setHorizon(h); setCustomHorizon(""); }}
                    className={cn(
                      "px-4 py-2 rounded-full border text-sm transition-colors",
                      !customHorizon && horizon === h
                        ? "border-foreground text-foreground font-medium"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    )}
                  >
                    {h} Years
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={customHorizon}
                  onChange={(e) => setCustomHorizon(e.target.value)}
                  placeholder="Custom"
                  className="w-24 px-3 py-2 rounded-full border border-border bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !ticker.trim()}
              className="w-full py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Researching fundamentals…" : "Build my fundamental report"}
            </button>

            {error && (
              <div className="rounded-lg border border-r-border bg-r-fill px-3 py-2 text-xs text-r-text">{error}</div>
            )}
          </form>

          <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
            Educational tool. Not investment advice. Always verify numbers on NSE/BSE/Screener.in
            and consult a SEBI-registered advisor before investing.
          </p>
        </div>
      ) : (
        <div>
          <button
            onClick={reset}
            className="mb-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Analyse another stock
          </button>
          <Report report={report} />
        </div>
      )}
    </div>
  );
}
