import { useCallback, useEffect, useRef, useState } from "react";

export interface OptionChainRow {
  strike: number;
  call: { oi: number; oiChange: number; ltp: number; iv: number; volume: number } | null;
  put: { oi: number; oiChange: number; ltp: number; iv: number; volume: number } | null;
}

export interface OptionChainSummary {
  symbol: string;
  expiry: string | null;
  underlyingValue: number | null;
  totalCallOI: number;
  totalPutOI: number;
  pcr: number;
  maxPainStrike: number | null;
  atmStrike: number | null;
  atmIV: number | null;
  rows: OptionChainRow[]; // sorted asc by strike, ATM ± 5
  allRows: OptionChainRow[]; // every strike (sorted)
}

export type OptionChainState =
  | { status: "loading" }
  | { status: "ok"; chain: OptionChainSummary }
  | { status: "error"; message: string };

interface NseLeg {
  strikePrice: number;
  expiryDate: string;
  CE?: { openInterest: number; changeinOpenInterest: number; lastPrice: number; impliedVolatility: number; totalTradedVolume: number };
  PE?: { openInterest: number; changeinOpenInterest: number; lastPrice: number; impliedVolatility: number; totalTradedVolume: number };
}

function summarise(symbol: string, raw: { records?: { data?: NseLeg[]; expiryDates?: string[]; underlyingValue?: number } }): OptionChainSummary {
  const data = raw?.records?.data ?? [];
  const expiry = raw?.records?.expiryDates?.[0] ?? null;
  const underlyingValue = raw?.records?.underlyingValue ?? null;

  const filtered = expiry ? data.filter((d) => d.expiryDate === expiry) : data;

  const byStrike = new Map<number, OptionChainRow>();
  for (const leg of filtered) {
    const row: OptionChainRow = byStrike.get(leg.strikePrice) ?? {
      strike: leg.strikePrice,
      call: null,
      put: null,
    };
    if (leg.CE) {
      row.call = {
        oi: leg.CE.openInterest,
        oiChange: leg.CE.changeinOpenInterest,
        ltp: leg.CE.lastPrice,
        iv: leg.CE.impliedVolatility,
        volume: leg.CE.totalTradedVolume,
      };
    }
    if (leg.PE) {
      row.put = {
        oi: leg.PE.openInterest,
        oiChange: leg.PE.changeinOpenInterest,
        ltp: leg.PE.lastPrice,
        iv: leg.PE.impliedVolatility,
        volume: leg.PE.totalTradedVolume,
      };
    }
    byStrike.set(leg.strikePrice, row);
  }

  const allRows = Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);

  const totalCallOI = allRows.reduce((s, r) => s + (r.call?.oi ?? 0), 0);
  const totalPutOI = allRows.reduce((s, r) => s + (r.put?.oi ?? 0), 0);
  const pcr = totalCallOI ? totalPutOI / totalCallOI : 0;

  // ATM = strike closest to underlying
  let atmStrike: number | null = null;
  if (underlyingValue != null && allRows.length) {
    atmStrike = allRows.reduce((best, r) =>
      Math.abs(r.strike - underlyingValue) < Math.abs(best - underlyingValue) ? r.strike : best,
      allRows[0].strike,
    );
  }
  const atmRow = atmStrike != null ? allRows.find((r) => r.strike === atmStrike) : null;
  const atmIV = atmRow ? ((atmRow.call?.iv ?? 0) + (atmRow.put?.iv ?? 0)) / 2 || null : null;

  // Max pain: strike with min total loss across all writers
  let maxPainStrike: number | null = null;
  if (allRows.length) {
    let minLoss = Infinity;
    for (const candidate of allRows) {
      let loss = 0;
      for (const r of allRows) {
        if (r.call) loss += Math.max(0, candidate.strike - r.strike) * r.call.oi;
        if (r.put) loss += Math.max(0, r.strike - candidate.strike) * r.put.oi;
      }
      if (loss < minLoss) {
        minLoss = loss;
        maxPainStrike = candidate.strike;
      }
    }
  }

  // ATM ± 5
  let rows = allRows;
  if (atmStrike != null) {
    const idx = allRows.findIndex((r) => r.strike === atmStrike);
    rows = allRows.slice(Math.max(0, idx - 5), Math.min(allRows.length, idx + 6));
  }

  return {
    symbol,
    expiry,
    underlyingValue,
    totalCallOI,
    totalPutOI,
    pcr,
    maxPainStrike,
    atmStrike,
    atmIV,
    rows,
    allRows,
  };
}

export function useOptionChain(symbol: string | null | undefined, refreshMs = 60_000) {
  const [state, setState] = useState<OptionChainState>({ status: "loading" });
  const abortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!symbol) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/public/nse-option-chain?symbol=${encodeURIComponent(symbol)}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        setState({ status: "error", message: `NSE responded ${res.status}` });
        return;
      }
      const json = await res.json();
      if (json?.error || !json?.data) {
        setState({ status: "error", message: json?.error ?? "No option chain data" });
        return;
      }
      setState({ status: "ok", chain: summarise(symbol, json.data) });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    setState({ status: "loading" });
    fetchOnce();
    const id = setInterval(fetchOnce, refreshMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [symbol, refreshMs, fetchOnce]);

  return { state, refresh: fetchOnce };
}
