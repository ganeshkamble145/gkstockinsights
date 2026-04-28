import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveQuote } from "@/hooks/use-live-quotes";
import { cn } from "@/lib/utils";

interface PriceAlertsProps {
  /** Cleaned NSE ticker (no .NS / NSE: prefix). */
  symbol: string;
}

interface PriceAlertRow {
  id: string;
  symbol: string;
  target_price: number;
  alert_type: "above" | "below";
  created_at: string;
  triggered_at: string | null;
}

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

const formSchema = z.object({
  target_price: z
    .number({ invalid_type_error: "Enter a valid price" })
    .positive("Price must be greater than 0")
    .max(10_000_000, "Price seems too high"),
  alert_type: z.enum(["above", "below"]),
});

export function PriceAlerts({ symbol }: PriceAlertsProps) {
  const cleaned = symbol
    .replace(/^NSE:/i, "")
    .replace(/^BSE:/i, "")
    .replace(/\.(NS|BO)$/i, "")
    .trim()
    .toUpperCase();

  const { state } = useLiveQuote(cleaned);
  const livePrice = state?.status === "ok" ? state.quote.price : null;

  const [alerts, setAlerts] = useState<PriceAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [alertType, setAlertType] = useState<"above" | "below">("above");
  const [error, setError] = useState<string | null>(null);

  // Tracks last seen price per alert id, so we only fire when the price
  // CROSSES the threshold (not just sits past it on first load).
  const lastPriceByAlert = useRef<Map<string, number>>(new Map());
  // Prevent duplicate toasts during a single page session.
  const triggeredThisSession = useRef<Set<string>>(new Set());

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("symbol", cleaned)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load price alerts:", error);
      toast.error("Couldn't load alerts");
    } else {
      setAlerts((data ?? []) as PriceAlertRow[]);
    }
    setLoading(false);
  }, [cleaned]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Watch live price and fire toasts when crossings happen.
  useEffect(() => {
    if (livePrice == null) return;
    const active = alerts.filter((a) => !a.triggered_at);
    if (active.length === 0) return;

    for (const alert of active) {
      if (triggeredThisSession.current.has(alert.id)) continue;

      const prev = lastPriceByAlert.current.get(alert.id);
      lastPriceByAlert.current.set(alert.id, livePrice);

      let crossed = false;
      if (alert.alert_type === "above") {
        // First reading or a true upward crossing.
        crossed = prev != null
          ? prev < alert.target_price && livePrice >= alert.target_price
          : livePrice >= alert.target_price;
      } else {
        crossed = prev != null
          ? prev > alert.target_price && livePrice <= alert.target_price
          : livePrice <= alert.target_price;
      }

      if (crossed) {
        triggeredThisSession.current.add(alert.id);
        const direction = alert.alert_type === "above" ? "crossed above" : "fell below";
        toast.success(`🔔 ${cleaned} alert triggered`, {
          description: `Price ${direction} ₹${inrFmt.format(alert.target_price)} — current ₹${inrFmt.format(livePrice)}`,
          duration: 12_000,
        });
        // Mark as triggered in DB (fire-and-forget).
        supabase
          .from("price_alerts")
          .update({ triggered_at: new Date().toISOString() })
          .eq("id", alert.id)
          .then(({ error }) => {
            if (error) console.error("Failed to mark alert triggered:", error);
            else loadAlerts();
          });
      }
    }
  }, [livePrice, alerts, cleaned, loadAlerts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = formSchema.safeParse({
      target_price: Number(targetInput),
      alert_type: alertType,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("price_alerts").insert({
      symbol: cleaned,
      target_price: parsed.data.target_price,
      alert_type: parsed.data.alert_type,
    });
    setSubmitting(false);

    if (insertError) {
      console.error("Failed to create alert:", insertError);
      toast.error("Couldn't create alert");
      return;
    }

    toast.success(
      `Alert set: notify when ${cleaned} ${parsed.data.alert_type === "above" ? "rises above" : "falls below"} ₹${inrFmt.format(parsed.data.target_price)}`,
    );
    setTargetInput("");
    loadAlerts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("price_alerts").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete alert:", error);
      toast.error("Couldn't delete alert");
      return;
    }
    triggeredThisSession.current.delete(id);
    lastPriceByAlert.current.delete(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast("Alert removed");
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-3">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Price alerts</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Get notified while this tab is open. Alerts persist across sessions.
          </p>
        </div>
        {livePrice != null && (
          <div className="text-[11px] text-muted-foreground">
            Live CMP: <span className="font-medium text-foreground">₹{inrFmt.format(livePrice)}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
            Target price (₹)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder="e.g. 1500"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            required
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
            Trigger when
          </label>
          <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setAlertType("above")}
              className={cn(
                "px-3 py-1.5",
                alertType === "above"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-background text-muted-foreground",
              )}
            >
              Rises above
            </button>
            <button
              type="button"
              onClick={() => setAlertType("below")}
              className={cn(
                "px-3 py-1.5 border-l border-border",
                alertType === "below"
                  ? "bg-red-500/10 text-red-700 dark:text-red-400"
                  : "bg-background text-muted-foreground",
              )}
            >
              Falls below
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add alert"}
        </button>
      </form>

      {error && <div className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</div>}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Active alerts ({alerts.filter((a) => !a.triggered_at).length})
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div className="text-xs text-muted-foreground">No alerts yet for {cleaned}.</div>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a) => {
              const isTriggered = !!a.triggered_at;
              const tone =
                a.alert_type === "above"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400";
              return (
                <li
                  key={a.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs",
                    isTriggered && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("font-medium", tone)}>
                      {a.alert_type === "above" ? "▲ Above" : "▼ Below"} ₹
                      {inrFmt.format(a.target_price)}
                    </span>
                    {isTriggered && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        Triggered
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 text-[11px]"
                    aria-label="Delete alert"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
