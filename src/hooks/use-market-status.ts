import { useEffect, useState } from "react";

export type MarketStatus = "open" | "preopen" | "closed";

export interface MarketStatusInfo {
  status: MarketStatus;
  label: string;
  istNow: Date;
  istLabel: string;
}

export function getMarketStatus(now = new Date()): MarketStatusInfo {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
  });
  
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  
  const h = parseInt(get("hour") || "0", 10);
  const m = parseInt(get("minute") || "0", 10);
  const dayName = get("weekday");
  const totalMin = h * 60 + m;

  let status: MarketStatus = "closed";
  const isWeekday = !["Sat", "Sun"].includes(dayName || "");
  if (isWeekday) {
    if (totalMin >= 9 * 60 && totalMin < 9 * 60 + 15) status = "preopen";
    else if (totalMin >= 9 * 60 + 15 && totalMin < 15 * 60 + 30) status = "open";
  }

  const label =
    status === "open"
      ? "Market Open"
      : status === "preopen"
        ? "Pre-open"
        : "Market Closed — LTP";

  const istLabel = now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }) + " IST";

  return { status, label, istNow: now, istLabel };
}

export function useMarketStatus(refreshMs = 30_000) {
  const [info, setInfo] = useState<MarketStatusInfo>(() => getMarketStatus());
  useEffect(() => {
    const tick = () => setInfo(getMarketStatus());
    tick();
    const id = setInterval(tick, refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return info;
}

export function formatIst(d: Date | number | undefined | null): string {
  if (!d) return "—";
  const date = typeof d === "number" ? new Date(d * 1000) : d;
  return (
    date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }) + " IST"
  );
}
