import type { StockReport } from "@/lib/types";
import { Badge, Trend } from "./Badge";

export function PeersTab({ r }: { r: StockReport }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">How does it compare to its 3 closest competitors?</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Company</th>
                <th className="text-left py-2 pr-3">P/E</th>
                <th className="text-left py-2 pr-3">P/B</th>
                <th className="text-left py-2 pr-3">ROE</th>
                <th className="text-left py-2 pr-3">Rev growth</th>
                <th className="text-left py-2 pr-3">D/E</th>
                <th className="text-left py-2">Edge</th>
              </tr>
            </thead>
            <tbody>
              {r.peers.map((p, i) => (
                <tr key={i} className={`border-b border-border last:border-0 ${p.isYou ? "bg-secondary" : ""}`}>
                  <td className="py-2.5 pr-3 font-medium">{p.company}{p.isYou && <span className="text-muted-foreground ml-1 text-xs">◀ you</span>}</td>
                  <td className="py-2.5 pr-3">{p.pe}</td>
                  <td className="py-2.5 pr-3">{p.pb}</td>
                  <td className="py-2.5 pr-3">{p.roe}</td>
                  <td className="py-2.5 pr-3">{p.revGrowth}</td>
                  <td className="py-2.5 pr-3">{p.de}</td>
                  <td className="py-2.5 text-muted-foreground text-xs">{p.edge}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">Source: Screener.in, NSE filings (verify before use)</p>
      </div>

      {r.news && r.news.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-base font-semibold mb-3">Latest news — top {r.news.length} long-term relevant items</h3>
          <ul className="space-y-3">
            {r.news.map((n, i) => (
              <li key={i} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <div className="text-sm font-medium">{n.headline}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.why}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{n.date} · {n.source}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">Peer standing:</span>
          <Badge label={r.peerStanding} />
        </div>
        <p className="text-sm text-muted-foreground">{r.peerSummary}</p>
      </div>
    </div>
  );
}

export function OwnershipTab({ r }: { r: StockReport }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Who is backing this company — and are they buying or stepping away?</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Holder</th>
                <th className="text-left py-2 pr-3">Latest %</th>
                <th className="text-left py-2 pr-3">8Q trend</th>
                <th className="text-left py-2 pr-3">Signal</th>
                <th className="text-left py-2">What it means</th>
              </tr>
            </thead>
            <tbody>
              {r.ownership.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{row.holder}</td>
                  <td className="py-2.5 pr-3">{row.latest}</td>
                  <td className="py-2.5 pr-3"><Trend dir={row.trend} /></td>
                  <td className="py-2.5 pr-3"><Badge label={row.signal} /></td>
                  <td className="py-2.5 text-muted-foreground text-xs">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">Latest earnings call — {r.earningsCallQuarter}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3 w-1/2">What management said</th>
                <th className="text-left py-2">What it means for you</th>
              </tr>
            </thead>
            <tbody>
              {r.callNotes.map((c, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3">{c.said}</td>
                  <td className="py-2.5 text-muted-foreground text-xs">{c.means}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Management tone:</span>
          <Badge label={r.managementTone} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">Ownership signal:</span>
          <Badge label={r.ownershipSignal} />
        </div>
        <p className="text-sm text-muted-foreground">{r.ownershipSummary}</p>
      </div>
    </div>
  );
}

export function ViewTab({ r }: { r: StockReport }) {
  const tone = r.fundamentalQuality === "STRONG FUNDAMENTALS" ? "g" : r.fundamentalQuality === "WEAK FUNDAMENTALS" ? "r" : "a";
  const cardCls = tone === "g" ? "bg-g-fill border-g-border" : tone === "r" ? "bg-r-fill border-r-border" : "bg-a-fill border-a-border";
  const textCls = tone === "g" ? "text-g-text" : tone === "r" ? "text-r-text" : "text-a-text";
  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-5 ${cardCls}`}>
        <div className={`text-lg font-semibold mb-1 ${textCls}`}>{r.fundamentalQuality}</div>
        <div className={`text-sm ${textCls}`}>{r.viewSummary}</div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">What works for this stock</div>
        {r.strengths.map((s, i) => (
          <div key={i} className="flex gap-3 py-1.5 border-b border-border last:border-0 text-sm">
            <span className="text-g-accent font-semibold">✓</span><span>{s}</span>
          </div>
        ))}

        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 mt-4">What to watch</div>
        {r.watchPoints.map((s, i) => (
          <div key={i} className="flex gap-3 py-1.5 border-b border-border last:border-0 text-sm">
            <span className="text-a-accent font-semibold">⚠</span><span>{s}</span>
          </div>
        ))}

        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 mt-4">Track this going forward</div>
        <div className="flex gap-3 py-1.5 text-sm">
          <span className="text-b-accent font-semibold">→</span><span>{r.trackForward}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-g-border bg-g-fill p-5">
          <div className="text-sm font-semibold text-g-text mb-2">Opportunities</div>
          {r.opportunities.map((o, i) => (
            <div key={i} className="text-sm text-g-text py-1">+ {o}</div>
          ))}
        </div>
        <div className="rounded-xl border border-r-border bg-r-fill p-5">
          <div className="text-sm font-semibold text-r-text mb-2">Risks</div>
          {r.risks.map((o, i) => (
            <div key={i} className="text-sm text-r-text py-1">− {o}</div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-secondary p-4 text-xs text-muted-foreground italic">
        This is a VIEW based on fundamentals only. Not a buy/sell recommendation. The decision is always yours.
      </div>
    </div>
  );
}
