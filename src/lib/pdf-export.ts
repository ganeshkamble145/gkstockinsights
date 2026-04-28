// PDF export for ranked stock lists.
// Two modes: compact (single sortable table) or detailed (one card per stock).

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfRow {
  rank: number;
  badge: string;
  symbol: string;
  sector?: string;
  cmp?: string;
  changePct?: string;
  score: number;
  recommendation: string;
  extra?: Record<string, string | undefined>;
}

export interface PdfDetailedStock extends PdfRow {
  thesis?: string;
  catalysts?: string[];
  risks?: string[];
  metrics?: Array<{ label: string; value: string }>;
  strategy?: { name: string; strikes?: string; rr?: string };
}

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(subtitle, 14, 21);
  doc.setTextColor(0);
}

function footer(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `GK Stock Insights · Educational only · Page ${i} of ${total}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.setTextColor(0);
  }
}

export function exportCompactPdf({
  title,
  subtitle,
  rows,
  columns,
  filename,
}: {
  title: string;
  subtitle: string;
  rows: PdfRow[];
  columns: Array<{ header: string; key: keyof PdfRow | string }>;
  filename: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  header(doc, title, subtitle);

  const head = [columns.map((c) => c.header)];
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = (r as unknown as Record<string, unknown>)[c.key as string] ?? r.extra?.[c.key as string];
      return v == null ? "—" : String(v);
    }),
  );

  autoTable(doc, {
    head,
    body,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 10, right: 10 },
  });

  footer(doc);
  doc.save(filename);
}

export function exportDetailedPdf({
  title,
  subtitle,
  stocks,
  filename,
}: {
  title: string;
  subtitle: string;
  stocks: PdfDetailedStock[];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  header(doc, title, subtitle);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 28;

  for (const s of stocks) {
    // Estimate space needed
    const needed = 50 + (s.thesis ? 14 : 0) + (s.metrics?.length ?? 0) * 4;
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = 18;
    }

    // Card box
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.roundedRect(10, y, pageW - 20, needed, 2, 2);

    // Header line
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${s.badge}  ${s.symbol}`, 14, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (s.sector) doc.text(s.sector, 14, y + 12);
    doc.setFontSize(10);
    doc.text(`Score: ${s.score}/100   ${s.recommendation}`, pageW - 14, y + 7, { align: "right" });
    if (s.cmp) {
      doc.setFontSize(9);
      doc.text(`${s.cmp}  ${s.changePct ?? ""}`, pageW - 14, y + 12, { align: "right" });
    }

    let ly = y + 18;

    if (s.metrics && s.metrics.length) {
      doc.setFontSize(8);
      const cols = 4;
      const colW = (pageW - 28) / cols;
      s.metrics.forEach((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 14 + col * colW;
        const yy = ly + row * 6;
        doc.setTextColor(120);
        doc.text(m.label, x, yy);
        doc.setTextColor(0);
        doc.text(m.value, x, yy + 3);
      });
      ly += Math.ceil(s.metrics.length / cols) * 6 + 3;
    }

    if (s.strategy) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Strategy: ${s.strategy.name}`, 14, ly);
      doc.setFont("helvetica", "normal");
      ly += 4;
      if (s.strategy.strikes) {
        doc.text(`Strikes: ${s.strategy.strikes}`, 14, ly);
        ly += 4;
      }
      if (s.strategy.rr) {
        doc.text(`R:R ${s.strategy.rr}`, 14, ly);
        ly += 4;
      }
    }

    if (s.thesis) {
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(s.thesis, pageW - 28);
      doc.text(lines, 14, ly);
      ly += lines.length * 3.5 + 1;
    }

    y += needed + 4;
  }

  footer(doc);
  doc.save(filename);
}
