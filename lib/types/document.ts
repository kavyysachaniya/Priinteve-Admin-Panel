import type { CompanySettings, Customer } from "@prisma/client";

export interface DocumentPreviewItem {
  name: string;
  description: string | null;
  quantity: number;
  ratePaise: number;
  discountPercent: number;
  gstRate: number;
  amountPaise: number;
}

export interface DocumentPreviewData {
  kind: "Quotation" | "Invoice";
  number: string;
  dateLabel: string;
  date: Date;
  secondaryDateLabel: string;
  secondaryDate: Date;
  customer: Customer;
  items: DocumentPreviewItem[];
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  notes: string | null;
  terms: string | null;
  company: CompanySettings;
  /** Invoice-only payment context. */
  amountPaidPaise?: number;
}
