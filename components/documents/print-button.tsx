"use client";

import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Triggers the browser print dialog, which also supports "Save as PDF" — this
 * is the Phase 1 PDF generation path (see DocumentPreview for the shared,
 * print-ready layout). Both Print and Download PDF use the same flow. */
export function PrintButton({ variant = "print" }: { variant?: "print" | "download" }) {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      {variant === "download" ? (
        <>
          <Download className="size-4" /> Download PDF
        </>
      ) : (
        <>
          <Printer className="size-4" /> Print
        </>
      )}
    </Button>
  );
}
