import { useState } from "react";
import { cn } from "@/lib/utils";

export function PdfExportButton({
  onExport,
  disabled,
}: {
  onExport: (mode: "compact" | "detailed") => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-full border border-border text-xs hover:border-foreground/40 transition-colors disabled:opacity-50"
      >
        ⬇ Download PDF
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onExport("compact");
              }}
              className={cn(
                "w-full text-left p-3 rounded-lg hover:bg-secondary transition-colors",
              )}
            >
              <div className="text-sm font-medium">Compact table</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                One-page sortable table of all 20 picks.
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onExport("detailed");
              }}
              className="w-full text-left p-3 rounded-lg hover:bg-secondary transition-colors"
            >
              <div className="text-sm font-medium">Detailed cards</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Full report with metrics, thesis & strategy.
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
