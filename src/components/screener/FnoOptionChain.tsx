import { useState } from "react";
import { cn } from "@/lib/utils";
import { useOptionChain } from "@/hooks/use-option-chain";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 });

/** F&O live OI panel + mini option chain (5 strikes ± ATM). */
export function FnoOptionChain({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);
  const { state, refresh } = useOptionChain(symbol, 60_000);

  if (state.status === "loading") {
    return (
      <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 animate-pulse">
        <div className="h-3 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-4 rounded-lg border border-a-border bg-a-fill p-3">
        <div className="text-[11px] text-a-text">
          OI data unavailable —{" "}
          <a
            href="https://www.nseindia.com/option-chain"
            target="_blank"
            rel="noreferrer"
            className="underline hover:no-underline"
          >
            check NSE option chain ↗
          </a>
        </div>
      </div>
    );
  }

  const c = state.chain;
  const pcrTone =
    c.pcr > 1.2
      ? "text-emerald-600 dark:text-emerald-400"
      : c.pcr < 0.8
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          📊 Live OI · {c.expiry ?? "Nearest expiry"}
        </div>
        <button
          onClick={refresh}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3">
        <Mini label="Call OI" value={compact.format(c.totalCallOI)} />
        <Mini label="Put OI" value={compact.format(c.totalPutOI)} />
        <Mini label="PCR" value={c.pcr.toFixed(2)} tone={pcrTone} />
        <Mini label="Max Pain" value={c.maxPainStrike != null ? `₹${inr.format(c.maxPainStrike)}` : "—"} />
      </div>

      {c.atmIV != null && (
        <div className="text-[11px] text-muted-foreground mb-3">
          ATM IV: <span className="text-foreground font-medium">{c.atmIV.toFixed(2)}%</span> · Spot:{" "}
          <span className="text-foreground font-medium">
            {c.underlyingValue ? `₹${inr.format(c.underlyingValue)}` : "—"}
          </span>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-muted-foreground hover:text-foreground"
      >
        {open ? "− Hide option chain" : "+ Show ATM ± 5 chain"}
      </button>

      {open && c.rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-right py-1 px-1">Call OI</th>
                <th className="text-right py-1 px-1">Δ OI</th>
                <th className="text-right py-1 px-1">LTP</th>
                <th className="text-center py-1 px-1 font-semibold">Strike</th>
                <th className="text-right py-1 px-1">LTP</th>
                <th className="text-right py-1 px-1">Δ OI</th>
                <th className="text-right py-1 px-1">Put OI</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => {
                const isAtm = r.strike === c.atmStrike;
                return (
                  <tr
                    key={r.strike}
                    className={cn(
                      "border-b border-border/40",
                      isAtm && "bg-blue-500/10",
                    )}
                  >
                    <td className="text-right py-1 px-1">{r.call ? compact.format(r.call.oi) : "—"}</td>
                    <td className={cn("text-right py-1 px-1", oiTone(r.call?.oiChange))}>
                      {r.call ? compact.format(r.call.oiChange) : "—"}
                    </td>
                    <td className="text-right py-1 px-1">{r.call ? inr.format(r.call.ltp) : "—"}</td>
                    <td className="text-center py-1 px-1 font-semibold">{inr.format(r.strike)}</td>
                    <td className="text-right py-1 px-1">{r.put ? inr.format(r.put.ltp) : "—"}</td>
                    <td className={cn("text-right py-1 px-1", oiTone(r.put?.oiChange))}>
                      {r.put ? compact.format(r.put.oiChange) : "—"}
                    </td>
                    <td className="text-right py-1 px-1">{r.put ? compact.format(r.put.oi) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function oiTone(v: number | undefined): string {
  if (v == null) return "";
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded bg-card py-1.5 px-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-[11px] font-medium mt-0.5 truncate", tone)}>{value}</div>
    </div>
  );
}
