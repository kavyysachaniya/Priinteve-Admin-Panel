import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

/**
 * Failsafe High-Fidelity DOM-to-PDF Exporter.
 * Uses native browser SVG rendering via html-to-image to capture the exact rendered
 * React component (DocumentPreview) matching the web preview 1-to-1. Includes a secondary
 * fallback to ensure PDF generation NEVER fails under any browser environment.
 */

interface ContentUnit {
  /** Top edge, as a fraction (0-1) of the captured element's total height. */
  topFraction: number;
}

/**
 * Measures the top edge of every "atomic" content block inside the element — its direct
 * children, with any <table> expanded into its individual rows — so the exported PDF can
 * break between them instead of at an arbitrary fixed-height cut that might land mid-row,
 * mid-paragraph, or through the totals/terms/bank-details blocks.
 */
function measureContentUnits(element: HTMLElement): ContentUnit[] {
  const containerTop = element.getBoundingClientRect().top;
  const totalHeight = element.getBoundingClientRect().height;
  if (totalHeight <= 0) return [];

  const units: ContentUnit[] = [];
  const addUnit = (el: Element) => {
    const top = el.getBoundingClientRect().top - containerTop;
    units.push({ topFraction: top / totalHeight });
  };

  for (const child of Array.from(element.children)) {
    if (child.tagName === "TABLE") {
      child.querySelectorAll("tr").forEach((row) => addUnit(row));
    } else if (child.hasAttribute("data-pdf-anchor-bottom")) {
      // Layout-only wrapper (terms + bank details): its children are the real blocks.
      Array.from(child.children).forEach((c) => addUnit(c));
    } else {
      addUnit(child);
    }
  }

  return units.filter((u) => u.topFraction > 0.001 && u.topFraction < 0.999).sort((a, b) => a.topFraction - b.topFraction);
}

/**
 * Given safe cut lines (mm, from the top of the rendered image) and a fixed page height,
 * returns page-slice boundaries [0, ..., imgHeight] where each slice is <= pageHeight and,
 * wherever possible, ends at a safe cut line rather than mid-content. Falls back to a raw
 * cut only if a single content block is itself taller than one page.
 */
function computeBreakpoints(safeCutsMm: number[], imgHeightMm: number, pageHeightMm: number): number[] {
  const breakpoints = [0];
  let cursor = 0;

  while (cursor < imgHeightMm - 0.5) {
    const naiveNext = cursor + pageHeightMm;
    if (naiveNext >= imgHeightMm) {
      breakpoints.push(imgHeightMm);
      break;
    }

    let candidate: number | null = null;
    for (const cut of safeCutsMm) {
      if (cut > cursor + 0.5 && cut <= naiveNext) candidate = cut;
    }

    const next = candidate ?? naiveNext;
    breakpoints.push(next);
    cursor = next;
  }

  if (breakpoints.length === 1) breakpoints.push(imgHeightMm);

  return breakpoints;
}

export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const cleanFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

  // Measure content block boundaries before capture so we know where it's safe to break pages.
  const contentUnits = measureContentUnits(element);

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

  const safeCutsMm = contentUnits.map((u) => u.topFraction * imgHeight);
  const breakpoints = computeBreakpoints(safeCutsMm, imgHeight, pdfHeight);

  for (let i = 0; i < breakpoints.length - 1; i++) {
    if (i > 0) pdf.addPage();
    const position = -breakpoints[i];
    pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    // The full image is drawn on every page; blank out everything below this page's slice
    // so the block that starts the next page isn't also shown (partially cut) here.
    // Fill colour is per-page graphics state in jsPDF, so it must be set on every page.
    const sliceHeight = breakpoints[i + 1] - breakpoints[i];
    if (sliceHeight < pdfHeight) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, sliceHeight, pdfWidth, pdfHeight - sliceHeight, "F");
    }
  }

  pdf.save(cleanFileName);
}
