import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runCryptoScreener, getCryptoMarketContext, type CryptoCoin, type CryptoMarketContext, type CryptoResult } from "@/lib/crypto.functions";
import { calculateCryptoScore } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { 
  Zap, ShieldCheck, TrendingUp, AlertTriangle, 
  Search, RefreshCw, BarChart3, Coins, 
  ArrowUpRight, ArrowDownRight, Wallet, Info,
  Calculator, Calendar, ShieldAlert, CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/report/Badge";
import { useGeminiKey } from "@/hooks/use-gemini-key";
import { toast } from "sonner";

// --- Sub-components ---

function SuitabilityModal({ onComplete }: { onComplete: (results: any) => void }) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<any>({});

  const handleAnswer = (key: string, value: string) => {
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);
    if (step < 3) setStep(step + 1);
    else onComplete(newAnswers);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Investor Suitability Check</h2>
          <p className="text-sm text-muted-foreground mt-2">Crypto is high-risk. Let's ensure you're ready.</p>
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <p className="text-sm font-semibold">Q1: What is your investment horizon?</p>
            <div className="grid gap-2">
              {["Under 6 months", "6 months–2 years", "2–5 years", "5+ years"].map((opt) => (
                <button key={opt} onClick={() => handleAnswer("horizon", opt)} className="w-full px-4 py-3 rounded-xl border border-border hover:border-foreground/40 text-left text-sm transition-all">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <p className="text-sm font-semibold">Q2: What % of total savings are you investing in crypto?</p>
            <div className="grid gap-2">
              {["Under 2%", "2–5%", "5–10%", "More than 10%"].map((opt) => (
                <button key={opt} onClick={() => handleAnswer("allocation", opt)} className="w-full px-4 py-3 rounded-xl border border-border hover:border-foreground/40 text-left text-sm transition-all">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <p className="text-sm font-semibold">Q3: Can you afford to lose this entire amount?</p>
            <div className="grid gap-2">
              {["Yes completely", "Partially yes", "No"].map((opt) => (
                <button key={opt} onClick={() => handleAnswer("risk", opt)} className="w-full px-4 py-3 rounded-xl border border-border hover:border-foreground/40 text-left text-sm transition-all">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaxImpactCalculator({ coin }: { coin: CryptoCoin }) {
  const [investment, setInvestment] = useState(10000);
  
  const impact = useMemo(() => {
    const buyPrice = coin.price_inr;
    const targetPrice = coin.ai_analyst?.multibagger_estimate?.target_price_inr;
    if (!buyPrice || !targetPrice || targetPrice <= buyPrice) return null;

    const units = investment / buyPrice;
    const grossValue = units * targetPrice;
    const grossGain = grossValue - investment;
    const tds = grossValue * 0.01;
    const tax = grossGain * 0.30;
    const net = grossValue - tax;
    const multiple = net / investment;

    return { grossValue, grossGain, tds, tax, net, multiple };
  }, [coin, investment]);

  if (!impact) return null;

  return (
    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1.5">
          <Calculator className="w-3 h-3" /> India Tax Impact
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Investment:</span>
          <input 
            type="number" 
            value={investment} 
            onChange={(e) => setInvestment(Number(e.target.value))}
            className="w-20 bg-transparent border-b border-amber-500/30 text-[10px] font-bold text-center outline-none focus:border-amber-500"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-[9px] text-muted-foreground uppercase">Gross Return</div>
          <div className="text-sm font-medium text-muted-foreground line-through">₹{Math.round(impact.grossValue ?? 0).toLocaleString()}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[9px] text-amber-600 uppercase font-bold">Real Post-Tax</div>
          <div className="text-lg font-black text-amber-700 dark:text-amber-400">₹{Math.round(impact.net ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="pt-2 border-t border-amber-500/10 flex justify-between items-end">
        <div className="text-[9px] text-muted-foreground leading-tight italic">
          30% tax: -₹{Math.round(impact.tax ?? 0).toLocaleString()}<br/>
          1% TDS: -₹{Math.round(impact.tds ?? 0).toLocaleString()} (claimable)
        </div>
        <div className="text-right">
          <div className="text-[9px] text-muted-foreground">Post-Tax Multiplier</div>
          <div className="text-sm font-bold text-emerald-600">{(impact.multiple ?? 0).toFixed(2)}x</div>
        </div>
      </div>
    </div>
  );
}

function CryptoCard({ coin, rank }: { coin: CryptoCoin; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const scoreData = calculateCryptoScore(coin);
  const { composite, tier } = scoreData;

  const signalColor = {
    STRONG: "bg-emerald-500 text-white",
    MODERATE: "bg-blue-500 text-white",
    CONFLICTED: "bg-amber-500 text-white",
    WEAK: "bg-slate-500 text-white",
    AVOID: "bg-red-500 text-white",
    SPECULATIVE: "bg-purple-500 text-white",
  }[coin.signal?.strength || "WEAK"] || "bg-slate-500";

  return (
    <div className={cn(
      "group relative flex flex-col rounded-3xl border border-border bg-card transition-all hover:shadow-xl",
      expanded ? "shadow-2xl ring-1 ring-foreground/10" : ""
    )}>
      {/* Top Header */}
      <div className="p-6 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-secondary font-bold text-sm">
              #{rank}
            </div>
            <div>
              <h3 className="font-bold text-lg leading-none">{coin.coin_name || "Unknown Coin"}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-muted-foreground">{coin.ticker}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-semibold">{coin.category}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black tracking-tight">₹{(coin.price_inr ?? 0).toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">{coin.price_source}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Mkt Cap (USD)</div>
            <div className="text-xs font-semibold">${((coin.market_cap_usd ?? 0) / 1e9).toFixed(1)}B</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">52W Low</div>
            <div className="text-xs font-semibold text-muted-foreground">₹{(coin.performance?.low_52w_inr ?? 0).toLocaleString()}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">52W High</div>
            <div className="text-xs font-semibold text-muted-foreground">₹{(coin.performance?.high_52w_inr ?? 0).toLocaleString()}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Below ATH</div>
            <div className="text-xs font-semibold text-red-500">-{(coin.pct_below_ath ?? 0).toFixed(1)}%</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">7D Change</div>
            <div className={cn("text-xs font-bold flex items-center gap-0.5", (coin.performance?.change_7d_pct ?? 0) >= 0 ? "text-emerald-600" : "text-red-600")}>
              {(coin.performance?.change_7d_pct ?? 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(coin.performance?.change_7d_pct ?? 0)}%
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Score</div>
            <div className="flex items-center gap-1.5">
              <div className="text-xs font-bold">{composite}/100</div>
              <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-foreground" style={{ width: `${composite}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Dual Analyst Row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
            <div className="text-[9px] font-bold text-blue-600 uppercase mb-1">📊 Research Desk</div>
            <div className="text-xs font-bold">{coin.research_desk?.sentiment || "NEUTRAL"}</div>
            <div className="text-[9px] text-muted-foreground mt-1 truncate">Target: ₹{(coin.research_desk?.consensus_target_inr ?? 0).toLocaleString() || "—"}</div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div className="text-[9px] font-bold text-emerald-600 uppercase mb-1">🤖 AI Analyst</div>
            <div className="text-xs font-bold">{coin.ai_analyst?.recommendation || "HOLD"}</div>
            <div className="text-[9px] text-muted-foreground mt-1 truncate">{coin.ai_analyst?.multibagger_estimate?.return_multiple || "—"}x Potential</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5", signalColor)}>
            {tier.badge} {tier.label}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            {expanded ? "Collapse details" : "Tap for deep reasoning"}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-border p-6 bg-muted/20 animate-in fade-in duration-300">
          <div className="grid gap-6">
            
            {/* Thinking Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> AI Deep Reasoning
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-4 rounded-2xl bg-background/50 border border-border space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Price Position</div>
                  <p className="text-xs leading-relaxed">{coin.ai_analyst?.thinking?.price_position || "—"}</p>
                </div>
                <div className="p-4 rounded-2xl bg-background/50 border border-border space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Multibagger Calc</div>
                  <p className="text-xs leading-relaxed">{coin.ai_analyst?.thinking?.multibagger_calculation || "—"}</p>
                </div>
              </div>
            </div>

            {/* Tax & DCA Row */}
            <div className="grid sm:grid-cols-2 gap-4">
              <TaxImpactCalculator coin={coin} />
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-3">
                <h4 className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Entry Strategy (DCA)
                </h4>
                <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {coin.ai_analyst?.thinking?.technical_analysis?.includes("Lump Sum") ? "Lump Sum" : "Systematic DCA"}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {coin.ai_analyst?.thinking?.technical_analysis || "—"}
                </p>
                <div className="pt-2 border-t border-blue-500/10 text-[9px] text-blue-600 font-medium">
                  Support: ₹{(coin.technical?.support_inr ?? 0).toLocaleString() || "—"} · Resistance: ₹{(coin.technical?.resistance_inr ?? 0).toLocaleString() || "—"}
                </div>
              </div>
            </div>

            {/* Risks */}
            <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5">
              <h4 className="text-[10px] font-bold text-red-600 uppercase mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Material Risk Factors
              </h4>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {(coin.ai_analyst?.risks || []).map((risk, i) => (
                  <div key={i} className="flex gap-2 text-[11px] leading-tight text-muted-foreground">
                    <span className="text-red-500 font-bold shrink-0">•</span>
                    {risk}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Disclaimer */}
            <div className="text-[9px] leading-tight text-muted-foreground/60 italic text-center px-4">
              {coin.disclaimer}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CryptoDashboard({ onBack }: { onBack: () => void }) {
  const getContext = useServerFn(getCryptoMarketContext);
  const runScreener = useServerFn(runCryptoScreener);
  
  const [data, setData] = useState<CryptoResult | null>(null);
  const [context, setContext] = useState<CryptoMarketContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuitability, setShowSuitability] = useState(false);
  const [suitabilityDone, setSuitabilityDone] = useState(false);
  
  const { apiKey } = useGeminiKey();

  useEffect(() => {
    const done = localStorage.getItem("gk_crypto_suitability_done");
    if (done) setSuitabilityDone(true);
    else setShowSuitability(true);
  }, []);

  const fetchData = async () => {
    if (!suitabilityDone) return;
    setLoading(true);
    setError(null);
    try {
      const [ctxRes, scrRes] = await Promise.all([
        getContext({ data: { apiKey: apiKey || undefined } }),
        runScreener({ data: { apiKey: apiKey || undefined } })
      ]);

      if (ctxRes.error) throw new Error(ctxRes.error);
      if (scrRes.error) throw new Error(scrRes.error);
      
      setContext(ctxRes.result);
      setData(scrRes.result);
    } catch (e: any) {
      setError(e.message || "Discovery failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (suitabilityDone && !data) fetchData();
  }, [suitabilityDone]);

  const handleSuitability = (answers: any) => {
    if (answers.risk === "No") {
      toast.error("Crypto is too risky for your profile.", { duration: 5000 });
      onBack();
      return;
    }
    localStorage.setItem("gk_crypto_suitability_done", "true");
    setSuitabilityDone(true);
    setShowSuitability(false);
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
      {showSuitability && <SuitabilityModal onComplete={handleSuitability} />}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-1">
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 flex items-center gap-1">
            ← Back to Home
          </button>
          <h1 className="text-3xl font-black tracking-tighter sm:text-4xl">
            CRYPTO <span className="text-muted-foreground font-light">PICKS</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Top 10 Undervalued Multibagger Cryptos Under ₹200. Reconciled via Dual-Analyst Research Desk & AI Analyst.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-2.5 rounded-2xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Discovering..." : "Discover Picks"}
          </button>
        </div>
      </div>

      {/* Market Context Banner */}
      {context && (
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold">BTC: ₹{(context.bitcoin.price_inr ?? 0).toLocaleString()}</span>
            </div>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold">Phase: {context.market_phase}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="blue" label={`Altcoin Index: ${context.altcoin_season_index}/100`} />
            <Badge variant="emerald" label={`Sentiment: ${context.fear_greed_label}`} />
          </div>
        </div>
      )}

      {/* Safety Guide */}
      <div className="p-5 rounded-3xl border border-amber-500/20 bg-amber-500/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform">
          <ShieldCheck className="w-24 h-24" />
        </div>
        <h3 className="text-sm font-bold text-amber-600 flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4" /> BEGINNER SAFETY GUIDE
        </h3>
        <div className="grid sm:grid-cols-3 gap-6 text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">
          <div className="space-y-1">
            <span className="font-bold">1. NO REGULATION</span>
            <p>Crypto is not regulated by SEBI. No legal protection if an exchange fails.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold">2. 30% FLAT TAX</span>
            <p>All gains taxed at 30% flat + 1% TDS. No loss set-off allowed in India.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold">3. VOLATILITY RISK</span>
            <p>Prices can drop 90% in days. Never invest what you cannot afford to lose.</p>
          </div>
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-[300px] rounded-3xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-12 text-center space-y-4 border border-dashed rounded-3xl bg-red-500/5 border-red-500/20">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold">Discovery Failed</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{error}</p>
          <button onClick={fetchData} className="px-6 py-2 rounded-xl bg-foreground text-background text-sm font-bold">Try Again</button>
        </div>
      )}

      {/* Coins Grid */}
      {data && !loading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {data.coins.sort((a,b) => a.price_inr - b.price_inr).map((coin, i) => (
            <CryptoCard key={coin.ticker} coin={coin} rank={i + 1} />
          ))}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="text-center py-20 border border-dashed rounded-3xl">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-bold">Ready to Scan the Crypto Market?</h2>
          <p className="text-muted-foreground text-sm mb-6">Discovery finds the top 10 cryptos under ₹200 with multibagger potential.</p>
          <button onClick={fetchData} className="px-8 py-3 rounded-2xl bg-foreground text-background font-bold transition-transform hover:scale-105 active:scale-95">
            Initialize Scanning
          </button>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center max-w-2xl mx-auto pt-10 border-t border-border">
        Cryptocurrencies are highly volatile and unregulated in India. Prices can fall to zero. 30% flat tax + 1% TDS on all crypto transactions in India. 
        This is NOT SEBI-registered investment advice. AI analysis can be wrong. Invest only what you can afford to lose completely.
      </div>
    </div>
  );
}
