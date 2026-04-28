import { useEffect, useState } from "react";

export type MarketStatus = "open" | "preopen" | "closed";

export interface MarketStatusInfo {
  status: MarketStatus;
  label: string;
  istNow: Date;
  istLabel: string;
}

/** Compute IST date/time from current UTC. */
function getIstParts(now: Date) {
  // IST = UTC + 5:30
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const ist = new Date(utcMs + 5.5 * 60 * 60_000);
  return ist;
}

export function getMarketStatus(now = new Date()): MarketStatusInfo {
  const ist = getIstParts(now);
  const day = ist.getUTCDay(); // since constructed offset, getUTC* reflects IST clock
  const hour = ist.getUTCHours();
  const minute = ist.getUTCMinutes();
  const totalMin = hour * 60 + minute;

  let status: MarketStatus = "closed";
  if (day >= 1 && day <= 5) {
    if (totalMin >= 9 * 60 && totalMin < 9 * 60 + 15) status = "preopen";
    else if (totalMin >= 9 * 60 + 15 && totalMin <= 15 * 60 + 30) status = "open";
  }

  const label =
    status === "open"
      ? "Market Open"
      : status === "preopen"
        ? "Pre-open"
        : "Market Closed — LTP";

  const istLabel = ist.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC", // already shifted
  }) + " IST";

  return { status, label, istNow: ist, istLabel };
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
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  const ist = new Date(utcMs + 5.5 * 60 * 60_000);
  return (
    ist.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }) + " IST"
  );
}
