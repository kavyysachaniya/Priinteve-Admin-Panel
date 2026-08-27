"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportElementToPdf } from "@/lib/pdf/exporter";

export function DownloadPdfButton({
  fileName,
  targetId = "document-preview-container",
}: {
  fileName: string;
  doc?: any; // kept for backwards compatibility
  targetId?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf() {
    setDownloading(true);
    const cleanFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

    try {
      const element = (document.getElementById(targetId) || document.querySelector(".document-page")) as HTMLElement | null;
      if (!element) {
        toast.error("Document element not found for PDF generation.");
        setDownloading(false);
        return;
      }

      await exportElementToPdf(element, cleanFileName);
      toast.success(`PDF downloaded: ${cleanFileName}`);
    } catch (err) {
      toast.error("Failed to generate PDF document.");
      console.error("PDF generation error:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading}>
      {downloading ? (
        <>
          <Loader2 className="size-4 mr-1.5 animate-spin" /> Generating PDF…
        </>
      ) : (
        <>
          <Download className="size-4 mr-1.5" /> Download PDF
        </>
      )}
    </Button>
  );
}
