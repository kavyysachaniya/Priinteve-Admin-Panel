import { cn } from "@/lib/utils";
import type {
  CustomerStatus,
  InvoiceStatus,
  PaymentMethod,
  ProductStatus,
  QuotationStatus,
  TaskStatus,
  TaskPriority,
  OrderStatus,
  OrderPriority,
  ProductionStatus,
  DeliveryStatus,
  ExpenseStatus,
  VendorStatus,
} from "@prisma/client";

const toneClasses = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-primary/10 text-primary border-transparent",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-transparent",
  warning: "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-transparent",
  destructive: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-transparent",
  purple: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-transparent",
} as const;

type Tone = keyof typeof toneClasses;

function Badge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone]
      )}
    >
      {label}
    </span>
  );
}

const QUOTATION_STATUS_CONFIG: Record<QuotationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "info" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Rejected", tone: "destructive" },
  EXPIRED: { label: "Expired", tone: "warning" },
  CONVERTED: { label: "Converted", tone: "info" },
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  const cfg = QUOTATION_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SENT: { label: "Sent", tone: "info" },
  PARTIALLY_PAID: { label: "Partially Paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  OVERDUE: { label: "Overdue", tone: "destructive" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = INVOICE_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const CUSTOMER_STATUS_CONFIG: Record<CustomerStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const cfg = CUSTOMER_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const PRODUCT_STATUS_CONFIG: Record<ProductStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const cfg = PRODUCT_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card",
  OTHER: "Other",
};

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return <Badge tone="neutral" label={PAYMENT_METHOD_LABEL[method] ?? method} />;
}

export function paymentMethodLabel(method: PaymentMethod) {
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

/* Phase 2 Badges */

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; tone: Tone }> = {
  TODO: { label: "Todo", tone: "neutral" },
  IN_PROGRESS: { label: "In Progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const cfg = TASK_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "info" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "destructive" },
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = TASK_PRIORITY_CONFIG[priority] ?? { label: priority, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  CONFIRMED: { label: "Confirmed", tone: "info" },
  IN_PRODUCTION: { label: "In Production", tone: "purple" },
  READY: { label: "Ready", tone: "warning" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = ORDER_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const ORDER_PRIORITY_CONFIG: Record<OrderPriority, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "info" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "destructive" },
};

export function OrderPriorityBadge({ priority }: { priority: OrderPriority }) {
  const cfg = ORDER_PRIORITY_CONFIG[priority] ?? { label: priority, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const PRODUCTION_STATUS_CONFIG: Record<ProductionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  IN_PROGRESS: { label: "In Progress", tone: "purple" },
  QUALITY_CHECK: { label: "Quality Check", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  ON_HOLD: { label: "On Hold", tone: "destructive" },
};

export function ProductionStatusBadge({ status }: { status: ProductionStatus }) {
  const cfg = PRODUCTION_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", tone: "purple" },
  DELIVERED: { label: "Delivered", tone: "success" },
  FAILED: { label: "Failed", tone: "destructive" },
  RETURNED: { label: "Returned", tone: "warning" },
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const cfg = DELIVERY_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const EXPENSE_STATUS_CONFIG: Record<ExpenseStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  RECORDED: { label: "Recorded", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const cfg = EXPENSE_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}

const VENDOR_STATUS_CONFIG: Record<VendorStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  const cfg = VENDOR_STATUS_CONFIG[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={cfg.tone} label={cfg.label} />;
}
