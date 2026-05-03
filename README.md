# 📈 GK Stock Insights — Indian Stock Fundamental Analyser

> **Live app:** [gkstockinsights.lovable.app](https://gkstockinsights.lovable.app)  
> **Local dev:** `http://localhost:8081`

A full-stack, AI-powered Indian stock market analysis platform for long-term investors and active traders. It combines live Yahoo Finance market data with Google Gemini large-language-model analysis to rank, score, and explain stocks across five specialised dashboards.

---

## 🚀 Feature Overview

| Tab | Purpose |
|-----|---------|
| **Stock Analyser** | Deep 8-tab fundamental report for any NSE/BSE ticker |
| **Penny Stocks** | Top 10 undervalued penny stocks (price < ₹100) ranked by composite score |
| **NIFTY 100** | Top 10 undervalued large-cap picks from the Nifty 100 index |
| **F&O Trading** | Top 10 stocks best-suited for Futures & Options strategies |
| **Crypto Picks** | Top 10 undervalued cryptos under ₹200 with India tax calculator |
| **⚡ AI Performance** | Tracks recommendation accuracy (Win Rate) and stores AI self-learning takeaways |
| **📈 Mutual Funds** | 15 top funds (3 per category) with 6-factor scoring and dual AI/Expert research |
| **📊 My Portfolio** | Personal portfolio tracker — Excel import/export, add/edit/delete, get AI recommendations |

---

## 🧠 AI Engine

### Model Cascade (5-level Gemini fallback)
All AI calls route through a unified provider in `src/lib/ai-provider.ts`:

```
1. gemini-3.1-pro-preview        (primary — frontier reasoning)
2. gemini-3-flash-preview        (ultra-fast next-gen)
3. gemini-3.1-flash-lite-preview (lightest next-gen)
4. gemini-2.5-flash              (stable workhorse)
5. gemini-2.5-flash-lite         (fastest fallback)
6. gemini-2.5-pro                (deep reasoning fallback)
```

- **5-second pause** between each attempt to let per-minute quota recover
- Each model has its own rate-limit bucket — a 429 on one succeeds on another
- All calls use `responseMimeType: "application/json"` — no code-fence stripping

### 🧠 Self-Learning Feedback Loop (v2.0)
The platform now implements a closed-loop learning architecture:
1.  **Outcome Tracking**: Recommendations are tracked at 7, 14, and 30-day intervals.
2.  **Mistake Analysis**: Before generating new picks, the AI fetches its recent "LOSSES" from Supabase.
3.  **Prompt Refinement**: The AI analyzes why previous picks failed and adjusts its screening logic to avoid similar patterns.
4.  **Learning Takeaways**: For every report, the AI generates a "Lesson Learned" which is persisted in the AI Learning Log.
- `parseAIJson<T>()` utility handles any residual markdown fences

### AI Outputs per Tab
| Tab | AI Returns |
|-----|-----------|
| Stock Analyser | Valuation, thesis, DCF, peer comparison, analyst consensus, 8 report sections |
| Screener (Penny/Nifty) | Ranked 10-stock list: sector, P/E, ROCE, promoter holding, composite score, recommendation |
| F&O | Greeks (Delta/Theta/Gamma), Max Pain, PCR, strategy legs (BUY/SELL), options play type |
| Crypto Picks | Multibagger potential, 52W high/low, RSI, India exchange availability, dual-analyst view |
| AI Performance | Historical prediction accuracy, model self-rating, confidence calibration |
| Mutual Funds | 3 picks per category: NAV, Returns, AUM, Alpha, Sharpe, Dual Analysis, Suitability |
| My Portfolio | Verdict, strategy, entry/target/SL prices, score, reasoning, risks per holding |

---

## 🏆 Composite Scoring Engine (`src/lib/scoring.ts`)

**Expert Override Engine:** The system programmatically overrides AI recommendations by recalculating the "Upside %" using live prices against analyst targets. A **Valuation Safety Cap** is applied to ensure overvalued stocks (Price > Target) are never flagged as "Strong Buy."

### Equity Stocks (Penny & Nifty 100) — 6 Factors
| Factor | Weight | Signal |
|--------|--------|--------|
| 5-Day Price Momentum | 25% | Higher momentum → higher score |
| Volume vs 3M Average | 20% | Volume ratio > 3× avg → max score |
| 52-Week Range Proximity | 15% | Closer to 52W high → higher score |
| P/E vs Sector Median | 15% | Below sector P/E → higher score |
| RSI(14) Sweet Spot | 15% | 40–65 range → max (avoids overbought/oversold) |
| Market Cap Stability | 10% | Larger cap → more stable (log scale) |

### F&O Stocks — 6 Factors
| Factor | Weight | Signal |
|--------|--------|--------|
| Open Interest Size | 20% | Larger OI → better liquidity |
| OI Change % | 20% | Fresh buildup (positive ΔOI) → bullish |
| 5-Day Price Momentum | 20% | Directional confidence |
| Implied Volatility | 15% | 20%–50% IV → ideal for option buyers |
| Volume vs Average | 15% | High volume → liquid contract |
| Put-Call Ratio | 10% | PCR 0.7–1.3 → balanced sentiment |

### Crypto Assets — 5 Factors
| Factor | Weight | Signal |
|--------|--------|--------|
| Multibagger Potential | 30% | Estimated return multiple vs historical volatility |
| Fundamental Utility | 25% | Real-world use case + developer activity |
| Technical Momentum | 20% | RSI(14) in 35-65 range + 52W range position |
| Tokenomics Risk | 15% | Inflation rate + unlock schedule (lower = better) |
| Sentiment Consensus | 10% | Research Desk + AI Analyst agreement |

### Recommendation Tiers
| Score | Tier | Badge |
|-------|------|-------|
| ≥ 80 | STRONG BUY | ⭐ |
| 60–79 | BUY | ✅ |
| 40–59 | HOLD | ⚠️ |
| 20–39 | AVOID | 🔻 |
| < 20 | SELL | ❌ |

---

## 📡 Live Market Data

- **Source:** Yahoo Finance via server-side proxy (`/api/public/yahoo-proxy`)
- **Data fetched:** 1-month daily OHLCV history (open, high, low, close, volume)
- **Computed client-side:** 5-day price momentum, Wilder RSI(14), 52W range position
- **Auto-polling:**
  - Every **60 seconds** during NSE market hours (9:15 AM – 3:30 PM IST, Mon–Fri)
  - Pauses automatically when browser tab is hidden (Page Visibility API)
  - Pauses entirely when market is closed
- **Cache-Control headers:** 55s during market hours, 1h when closed (`stale-while-revalidate`)

---

## ⚡ Performance Architecture (`src/lib/perf-utils.ts`)

| Optimisation | Detail |
|-------------|--------|
| **Parallel fetching** | All 10 stocks fetched via `Promise.allSettled()` simultaneously |
| **TTL localStorage cache** | `gkCache` — time-bucketed keys, configurable TTL per data type |
| **Retry with backoff** | `fetchWithRetry()` — 8s `AbortController` timeout, exponential backoff |
| **Market-hours awareness** | `checkMarketHours()` — no polling outside 9:15–15:30 IST |
| **Visibility pause** | `document.visibilitychange` listener stops polling on tab switch |
| **Progressive rendering** | Skeleton screens render immediately; data fills in as fetched |
| **Error classification** | `ErrorCard`/`ErrorPill` distinguish 429 (rate-limit), 503 (overload), market-closed |

**Cache TTLs:**
- Yahoo Finance quotes: 60s (market open) / 6h (market closed)
- AI screener analysis: 5 min (market open) / 24h (market closed)

---

## 📊 My Portfolio Tab (`src/components/portfolio/MyPortfolioDashboard.tsx`)

A personal stock portfolio tracker with no backend dependency — all data persists in `localStorage`.

### Features
| Feature | Detail |
|---------|--------|
| **Add stock** | Modal: Symbol, Company, Qty, Avg Buy Price, Buy Date, Notes |
| **Edit stock** | Pre-filled modal on any row |
| **Delete stock** | Confirmation dialog |
| **Table view** | Symbol · Company · Qty · Avg Price · Invested · Buy Date · AI Verdict · AI Strategy · Target |
| **⚡ AI Recommendations** | Batch Gemini call for all holdings — populates Verdict, Strategy, Target, Entry, SL |
| **Row expand** | Click any row → inline AI detail panel (reasoning, targets, risks, trend, score) |
| **Totals footer** | Running sum of total amount invested |
| **Excel Export** | Download current portfolio as a pre-filled Excel template |
| **Excel Import** | Upload Excel/CSV to bulk-add stocks with smart deduplication |
| **localStorage persistence** | Survives page refresh, no login required |

### AI Recommendation fields per stock
`verdict` · `score` · `confidence_pct` · `strategy` · `entry_price` · `target_price` · `stop_loss` · `reasoning` · `risks[]` · `technical_trend`

---

## 📋 Screener Dashboards

### Dual View Modes
- **Table View** (default): Sortable columns — score pills, rank badges, recommendation chips
- **Card View**: 52W range bar, sub-factor breakdown, "Min ₹5,000 ≈ X shares" calculator (Penny tab)

### Filters & Controls
- **Sector filter**: Filter results by sector across all tabs
- **Budget filter**: Filter by minimum investment amount
- **🔄 Refresh Prices**: Re-polls Yahoo Finance immediately
- **🤖 Regenerate Picks**: Re-runs full AI screener with new 20-stock list
- **Nifty 50 live strip**: Real-time index ticker at top of F&O tab

### PDF Export (`src/lib/pdf-export.ts`)
- Powered by **jsPDF + jspdf-autotable**
- **Compact Table**: Landscape A4 — all 10 stocks in one table
- **Detailed Cards**: Portrait A4 — one card per stock with thesis, strategy, all metrics

---

## 📈 Stock Analyser (`src/lib/analyser.functions.ts`)

Deep-dive 8-section fundamental report for any NSE/BSE ticker:

1. **Valuation** — P/E, P/B, EV/EBITDA vs sector/historical averages
2. **Growth** — Revenue, earnings, margin trajectory (3–5 years)
3. **Financial Health** — Debt/Equity, Interest Coverage, Current Ratio
4. **Returns** — ROE, ROCE, ROIC trend
5. **Cash Flow** — FCF, OCF, capex intensity
6. **Peers** — Side-by-side competitor comparison table
7. **Ownership** — Promoter holding %, FII/DII trends, pledge %
8. **Long-Term View** — AI thesis, catalysts, risks, DCF-based fair value range

Input: NSE/BSE ticker + investment horizon (3/5/10 years custom)

---

## ⚡ AI Performance Dashboard (`src/components/screener/AIPerformanceDashboard.tsx`)

Self-improving intelligence tracking:
- Records every AI recommendation with timestamp and confidence
- Compares predictions against subsequent price movements
- Tracks model accuracy by verdict tier (STRONG BUY vs BUY vs HOLD etc.)
- Displays calibration chart: predicted confidence vs actual hit rate
- Uses `use-ai-performance.ts` hook backed by `localStorage`

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19 + Vite 7) |
| Routing | TanStack Router — file-based routes |
| UI Primitives | Radix UI + shadcn/ui patterns |
| Styling | Tailwind CSS v4 |
| State | TanStack Query v5 + React `useState` |
| AI Provider | Google Gemini (5-model cascade) |
| Live Data | Yahoo Finance via server-side proxy |
| Database | Supabase (Postgres) — screener cache tables |
| PDF | jsPDF + jspdf-autotable |
| Validation | Zod |
| Deployment | Vite dev server (local) |

---

## 📁 Project Structure

```
src/
├── lib/
│   ├── ai-provider.ts           # Gemini 5-model fallback cascade + parseAIJson
│   ├── analyser.functions.ts    # Server fn: deep fundamental report (8 sections)
│   ├── screener.functions.ts    # Server fn: Penny & Nifty 100 AI screener
│   ├── fno.functions.ts         # Server fn: F&O AI screener (BUY/SELL explicit strikes)
│   ├── crypto.functions.ts      # Server fn: Crypto AI discovery (Top 10 < ₹200)
│   ├── mf.functions.ts          # Server fn: Mutual Funds discovery & research
│   ├── portfolio-ai.functions.ts # Server fn: batch AI recommendations for portfolio
│   ├── scoring.ts               # Composite scoring (equity 6-factor + F&O + Crypto)
│   ├── perf-utils.ts            # TTL cache, fetchWithRetry, market hours, ErrorUI
│   ├── pdf-export.ts            # PDF generation (compact table + detailed cards)
│   ├── types.ts                 # TypeScript interfaces (StockReport, MetricRow…)
│   └── utils.ts                 # Tailwind cn() utility
├── hooks/
│   ├── use-live-quotes.ts       # Yahoo Finance polling (RSI + momentum, auto-pause)
│   ├── use-market-status.ts     # NSE market hours detector
│   ├── use-ai-performance.ts    # AI prediction tracking & accuracy metrics
│   ├── use-option-chain.ts      # F&O option chain data hook
│   ├── use-user-prefs.ts        # User preferences (view mode, filters)
│   └── use-mobile.tsx           # Responsive breakpoint hook
├── components/
│   ├── mf/
│   │   └── MfDashboard.tsx            # Mutual Funds research dashboard
│   ├── screener/
│   │   ├── ScreenerDashboard.tsx      # Penny & Nifty 100 ranked table/card views (52W High/Low)
│   │   ├── FnoDashboard.tsx           # F&O dashboard (52W range bar + explicit strikes)
│   │   ├── CryptoDashboard.tsx        # Crypto dashboard (India Tax Calc + Suitability)
│   │   ├── AIPerformanceDashboard.tsx # AI accuracy tracking dashboard
│   │   ├── PerfUI.tsx                 # Skeleton loaders, ErrorCard, ErrorPill
│   │   ├── MarketStatusBadge.tsx      # Live market open/closed indicator
│   │   ├── LiveMarketView.tsx         # Real-time price strip
│   │   ├── LiveStockSnapshot.tsx      # Per-stock live data panel
│   │   ├── FnoOptionChain.tsx         # Option chain table component
│   │   ├── PriceAlerts.tsx            # Price alert manager
│   │   ├── PdfExportButton.tsx        # PDF export trigger
│   │   ├── RankedBadges.tsx           # Score/rank badge components
│   │   └── BudgetFilterBar.tsx        # Budget range filter UI
│   ├── portfolio/
│   │   └── MyPortfolioDashboard.tsx   # Portfolio tracker (add/edit/delete + AI)
│   ├── report/
│   │   └── Report.tsx                 # 8-section fundamental report renderer
│   └── ui/                            # Radix/shadcn base components
├── routes/
│   ├── index.tsx                # Main page — all tab navigation
│   └── api.public.yahoo-proxy.ts # Server-side Yahoo Finance proxy with cache headers
└── styles.css                   # Global Tailwind base styles + design tokens
supabase/
└── migrations/                  # Supabase Postgres schema migrations
```

---

## ⚙️ Setup & Development

### Prerequisites
- Node.js 20+
- Google Gemini API key (free tier works)

### Environment Variables (`.env`)
```env
# Required — primary AI provider
USER_GEMINI_API_KEY=AIza...

# Optional — additional Gemini quota buckets
GEMINI_API_KEY_TIER3=AIza...
GEMINI_API_KEY_FREE=AIza...

# Supabase (for screener cache)
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_URL=https://...supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Run Locally
```bash
npm install
npm run dev -- --port 8081
# App: http://localhost:8081
```

### Build
```bash
npm run build
```

---

## ⚠️ Disclaimer

> **For educational purposes only.** GK Stock Insights is NOT a SEBI-registered investment advisor. All AI-generated analysis, stock picks, valuations, and F&O strategies are illustrative and based on the AI model's training data. Live prices from Yahoo Finance may be delayed. **Always verify on NSE/BSE, Screener.in, or Moneycontrol before making any investment decisions.** Past performance is not indicative of future results.

---

## 📜 License
Private project — © GK Stock Insights. All rights reserved.
