/**
 * MyPortfolioDashboard — localStorage-persisted portfolio tab.
 * Add / Edit / Delete stock entries in a table.
 * "Get AI Recommendations" button fetches Gemini analysis for all entries.
 */

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPortfolioAI, type PortfolioAIResult } from "@/lib/portfolio-ai.functions";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

export interface PortfolioEntry {
  id: string;
  symbol: string;
  company: string;
  qty: number;
  avgPrice: number;
  buyDate: string;
  notes: string;
}

type AICacheMap = Record<string, PortfolioAIResult>;

const STORAGE_KEY = "gk_portfolio_entries";
const AI_CACHE_KEY = "gk_portfolio_ai_cache";

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

// ─── Verdict badge ────────────────────────────────────────────────────────

const VERDICT_CLS: Record<string, string> = {
  "STRONG BUY": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "BUY":        "bg-green-100  text-green-800  dark:bg-green-900/40  dark:text-green-300",
  "HOLD":       "bg-amber-100  text-amber-800  dark:bg-amber-900/40  dark:text-amber-300",
  "AVOID":      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "SELL":       "bg-red-100    text-red-800    dark:bg-red-900/40    dark:text-red-300",
};

function VerdictBadge({ v }: { v: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap", VERDICT_CLS[v] ?? "bg-secondary text-muted-foreground")}>
      {v}
    </span>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────

interface ModalProps {
  initial: Partial<PortfolioEntry>;
  onSave: (e: PortfolioEntry) => void;
  onClose: () => void;
}

function EntryModal({ initial, onSave, onClose }: ModalProps) {
  const [symbol,   setSymbol]   = useState(initial.symbol   ?? "");
  const [company,  setCompany]  = useState(initial.company  ?? "");
  const [qty,      setQty]      = useState(String(initial.qty      ?? ""));
  const [avgPrice, setAvgPrice] = useState(String(initial.avgPrice ?? ""));
  const [buyDate,  setBuyDate]  = useState(initial.buyDate  ?? "");
  const [notes,    setNotes]    = useState(initial.notes    ?? "");
  const [err,      setErr]      = useState("");

  function handleSave() {
    const sym  = symbol.trim().toUpperCase();
    const q    = parseFloat(qty);
    const p    = parseFloat(avgPrice);
    if (!sym)         { setErr("Symbol is required"); return; }
    if (isNaN(q) || q <= 0) { setErr("Enter a valid quantity"); return; }
    if (isNaN(p) || p <= 0) { setErr("Enter a valid price"); return; }
    onSave({
      id:       initial.id ?? crypto.randomUUID(),
      symbol:   sym,
      company:  company.trim(),
      qty:      q,
      avgPrice: p,
      buyDate,
      notes:    notes.trim(),
    });
  }

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">{initial.id ? "Edit" : "Add"} Stock</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Symbol *</label>
              <input className={cn(field, "uppercase")} placeholder="e.g. RELIANCE" value={symbol}
                onChange={e => { setSymbol(e.target.value.toUpperCase()); setErr(""); }}
                disabled={!!initial.id} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Company name</label>
              <input className={field} placeholder="Optional" value={company} onChange={e => setCompany(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Quantity *</label>
              <input type="number" min="0" className={field} placeholder="e.g. 100" value={qty}
                onChange={e => { setQty(e.target.value); setErr(""); }} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Avg buy price (₹) *</label>
              <input type="number" min="0" step="0.01" className={field} placeholder="e.g. 2400" value={avgPrice}
                onChange={e => { setAvgPrice(e.target.value); setErr(""); }} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Buy date</label>
            <input type="date" className={field} value={buyDate} onChange={e => setBuyDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <input className={field} placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {parseFloat(qty) > 0 && parseFloat(avgPrice) > 0 && (
            <div className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Total invested: <span className="font-medium text-foreground">
                ₹{INR.format(parseFloat(qty) * parseFloat(avgPrice))}
              </span>
            </div>
          )}

          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-1.5 rounded-full border border-border text-sm hover:border-foreground/40 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-5 py-1.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────

function DeleteConfirm({ symbol, onConfirm, onCancel }: { symbol: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <p className="text-sm">Delete <span className="font-semibold">{symbol}</span> from your portfolio? This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-1.5 rounded-full border border-border text-sm hover:border-foreground/40 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-1.5 rounded-full bg-red-600 text-white text-sm hover:opacity-90 transition-opacity">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Expand row: full AI detail ───────────────────────────────────────────

function AIDetailRow({ ai }: { ai: PortfolioAIResult }) {
  return (
    <tr>
      <td colSpan={10} className="border-t border-border bg-secondary/20 px-6 py-4">
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <p className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Analysis</p>
            <p className="leading-relaxed">{ai.reasoning}</p>
            <p className="text-muted-foreground mt-1">Confidence: <span className="text-foreground font-medium">{ai.confidence_pct}%</span></p>
            <p className="text-muted-foreground">Trend: <span className="text-foreground font-medium">{ai.technical_trend}</span></p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Price Targets</p>
            <p>Entry: <span className="font-medium">{ai.entry_price ? `₹${INR.format(ai.entry_price)}` : "—"}</span></p>
            <p>Target: <span className="font-medium text-emerald-600 dark:text-emerald-400">{ai.target_price ? `₹${INR.format(ai.target_price)}` : "—"}</span></p>
            <p>Stop Loss: <span className="font-medium text-red-600 dark:text-red-400">{ai.stop_loss ? `₹${INR.format(ai.stop_loss)}` : "—"}</span></p>
            <p>Score: <span className="font-medium">{ai.score}/100</span></p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Risks</p>
            <ul className="space-y-1">
              {(ai.risks ?? []).map((r, i) => (
                <li key={i} className="flex gap-1.5"><span className="text-red-500 mt-0.5 shrink-0">•</span>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────

export function MyPortfolioDashboard({ onBack }: { onBack: () => void }) {
  const getAI = useServerFn(getPortfolioAI);

  const [entries, setEntries]     = useState<PortfolioEntry[]>(() => load(STORAGE_KEY, []));
  const [aiCache, setAiCache]     = useState<AICacheMap>(() => load(AI_CACHE_KEY, {}));
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<PortfolioEntry | null>(null);
  const [delEntry,  setDelEntry]  = useState<PortfolioEntry | null>(null);
  const [expandId,  setExpandId]  = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState<string | null>(null);
  const [aiMsg,     setAiMsg]     = useState<string | null>(null);

  // Persist entries
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  // Persist AI cache
  useEffect(() => { localStorage.setItem(AI_CACHE_KEY, JSON.stringify(aiCache)); }, [aiCache]);

  // ── CRUD ──────────────────────────────────────────────────────────────

  function saveEntry(entry: PortfolioEntry) {
    setEntries(prev =>
      prev.find(e => e.id === entry.id)
        ? prev.map(e => e.id === entry.id ? entry : e)
        : [...prev, entry]
    );
    setShowModal(false);
    setEditEntry(null);
  }

  function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
    setAiCache(prev => { const n = { ...prev }; const sym = entries.find(e => e.id === id)?.symbol; if (sym) delete n[sym]; return n; });
    setDelEntry(null);
  }

  // ── AI Recommendations ─────────────────────────────────────────────────

  async function fetchAI() {
    if (entries.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setAiMsg(null);
    try {
      const symbols = [...new Set(entries.map(e => e.symbol))];
      setAiMsg(`⚡ Fetching AI analysis for ${symbols.length} stock${symbols.length > 1 ? "s" : ""}…`);
      const res = await getAI({ data: { symbols } });
      if (res.error) { setAiError(res.error); return; }
      const map: AICacheMap = { ...aiCache };
      res.results.forEach(r => { map[r.symbol] = r; });
      setAiCache(map);
      setAiMsg(`✅ AI recommendations ready for ${res.results.length} stock${res.results.length > 1 ? "s" : ""}`);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────

  const totalInvested = entries.reduce((s, e) => s + e.qty * e.avgPrice, 0);

  return (
    <div className="max-w-7xl mx-auto pb-16 space-y-6">
      {/* Back */}
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">📊 My Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {entries.length} stock{entries.length !== 1 ? "s" : ""} · Total invested: <span className="text-foreground font-medium">₹{INR.format(totalInvested)}</span>
            {" · "}<span className="text-[10px]">💾 Saved locally in browser</span>
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setEditEntry(null); setShowModal(true); }}
            className="px-4 py-1.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add stock
          </button>
          <button
            onClick={fetchAI}
            disabled={aiLoading || entries.length === 0}
            className="px-4 py-1.5 rounded-full border border-border text-sm font-medium hover:border-foreground/40 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {aiLoading
              ? <><span className="animate-spin inline-block">⚡</span> Fetching AI…</>
              : "⚡ Get AI Recommendations"}
          </button>
        </div>
      </div>

      {/* AI status */}
      {aiMsg && !aiError && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{aiMsg}</span>
          <button onClick={() => setAiMsg(null)} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}
      {aiError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>⚠️ {aiError}</span>
          <button onClick={() => setAiError(null)} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Table */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center space-y-3">
          <div className="text-4xl">📈</div>
          <p className="text-sm text-muted-foreground">No stocks yet.</p>
          <button
            onClick={() => { setEditEntry(null); setShowModal(true); }}
            className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add your first stock
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Avg Price</th>
                  <th className="px-4 py-3 font-medium text-right">Invested</th>
                  <th className="px-4 py-3 font-medium">Buy Date</th>
                  <th className="px-4 py-3 font-medium">AI Verdict</th>
                  <th className="px-4 py-3 font-medium">AI Strategy</th>
                  <th className="px-4 py-3 font-medium text-right">Target</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const ai   = aiCache[e.symbol];
                  const exp  = expandId === e.id;
                  const inv  = e.qty * e.avgPrice;

                  return (
                    <>
                      <tr
                        key={e.id}
                        className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-colors"
                        onClick={() => setExpandId(exp ? null : e.id)}
                      >
                        <td className="px-4 py-3 font-semibold">
                          {e.symbol}
                          {exp && <span className="ml-1 text-[9px] text-muted-foreground">▲</span>}
                          {!exp && ai && <span className="ml-1 text-[9px] text-muted-foreground">▼ details</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate">{e.company || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{e.qty}</td>
                        <td className="px-4 py-3 text-right tabular-nums">₹{INR.format(e.avgPrice)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">₹{INR.format(inv)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.buyDate || "—"}</td>
                        <td className="px-4 py-3">
                          {aiLoading
                            ? <span className="text-[10px] animate-pulse text-muted-foreground">⚡ Fetching…</span>
                            : ai
                              ? <VerdictBadge v={ai.verdict} />
                              : <span className="text-[10px] text-muted-foreground italic">—</span>}
                        </td>
                        <td className="px-4 py-3 max-w-[140px] truncate" title={ai?.strategy}>
                          {ai?.strategy || "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {ai?.target_price ? `₹${INR.format(ai.target_price)}` : "—"}
                        </td>
                        <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditEntry(e); setShowModal(true); }}
                              className="px-2 py-0.5 rounded border border-border hover:border-foreground/40 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDelEntry(e)}
                              className="px-2 py-0.5 rounded border border-border text-red-500 hover:border-red-400 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {exp && ai && <AIDetailRow key={`${e.id}-ai`} ai={ai} />}
                    </>
                  );
                })}
              </tbody>

              {/* Footer totals */}
              <tfoot className="border-t-2 border-border bg-secondary/50">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-[11px] text-muted-foreground" colSpan={3}>
                    TOTAL ({entries.length} stocks)
                  </td>
                  <td />
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    ₹{INR.format(totalInvested)}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Portfolio entries are saved in your browser's local storage. AI recommendations are powered by Gemini and are for educational purposes only — not SEBI-registered investment advice.
      </p>

      {/* Modals */}
      {showModal && (
        <EntryModal
          initial={editEntry ?? {}}
          onSave={saveEntry}
          onClose={() => { setShowModal(false); setEditEntry(null); }}
        />
      )}
      {delEntry && (
        <DeleteConfirm
          symbol={delEntry.symbol}
          onConfirm={() => deleteEntry(delEntry.id)}
          onCancel={() => setDelEntry(null)}
        />
      )}
    </div>
  );
}
