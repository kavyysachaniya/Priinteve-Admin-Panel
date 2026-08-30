"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { exportElementToPdf } from "@/lib/pdf/exporter";

export function ReportExportButtons({ reportName }: { reportName: string }) {
  const [loading, setLoading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handlePdfDownload = async () => {
    const el = document.getElementById("report-container");
    if (!el) {
      toast.error("Report container not found");
      return;
    }
    setLoading(true);
    try {
      const fileName = `${reportName}_${new Date().toISOString().slice(0, 10)}`;
      await exportElementToPdf(el, fileName);
      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading}>
        <Printer className="size-3.5 mr-1" /> Print Report
      </Button>
      <Button size="sm" onClick={handlePdfDownload} disabled={loading}>
        <Download className="size-3.5 mr-1" /> Export PDF
      </Button>
    </div>
  );
}
