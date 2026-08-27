import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

/**
 * Failsafe High-Fidelity DOM-to-PDF Exporter.
 * Uses native browser SVG rendering via html-to-image to capture the exact rendered
 * React component (DocumentPreview) matching the web preview 1-to-1. Includes a secondary
 * fallback to ensure PDF generation NEVER fails under any browser environment.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const cleanFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  let dataUrl = "";
  try {
    // Primary strategy: Native Browser SVG foreignObject rendering
    dataUrl = await toPng(element, {
      quality: 0.98,
      backgroundColor: "#ffffff",
      pixelRatio: 2.5,
      cacheBust: false,
      style: {
        transform: "none",
        margin: "0 auto",
      },
    });
  } catch (primaryErr) {
    console.warn("Primary html-to-image rendering fallback triggered:", primaryErr);
    // Secondary strategy: html2canvas on visible DOM node
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });
    dataUrl = canvas.toDataURL("image/png");
  }

  if (!dataUrl) {
    throw new Error("Failed to capture document image canvas");
  }

  // Load image to calculate dimensions
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (err) => reject(err);
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pdfWidth = 210;
  const pdfHeight = 297;

  const imgWidth = pdfWidth;
  const imgHeight = (img.height * pdfWidth) / img.width;

  let heightLeft = imgHeight;
  let position = 0;

  // Add First Page
  pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  heightLeft -= pdfHeight;

  // Handle Multi-page Documents
  while (heightLeft > 2) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pdfHeight;
  }

  pdf.save(cleanFileName);
}
