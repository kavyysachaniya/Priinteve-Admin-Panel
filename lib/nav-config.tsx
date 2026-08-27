import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  ShoppingBag,
  ReceiptText,
  Wallet,
  Factory,
  Truck,
  LayoutList,
  Calendar,
  CheckSquare,
  StickyNote,
  PieChart,
  Receipt,
  Store,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Route prefixes (besides href) that should also mark this item active. */
  matchPrefixes?: string[];
}

export interface NavSection {
  label: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "SALES",
    items: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Products & Services", href: "/products", icon: Package },
      { label: "Quotations", href: "/quotations", icon: FileText },
      { label: "Orders", href: "/orders", icon: ShoppingBag },
      { label: "Invoices", href: "/invoices", icon: ReceiptText },
      { label: "Payments", href: "/payments", icon: Wallet },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Production", href: "/production", icon: Factory },
      { label: "Deliveries", href: "/deliveries", icon: Truck },
    ],
  },
  {
    label: "PLANNER",
    items: [
      { label: "Planner", href: "/planner", icon: LayoutList },
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Tasks", href: "/tasks", icon: CheckSquare },
      { label: "Notes", href: "/notes", icon: StickyNote },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { label: "Overview", href: "/finance", icon: PieChart },
      { label: "Expenses", href: "/expenses", icon: Receipt },
      { label: "Vendors", href: "/vendors", icon: Store },
    ],
  },
  {
    label: "OTHER",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export const QUICK_ACTIONS = [
  { label: "New Task", href: "/tasks/new" },
  { label: "New Note", href: "/notes/new" },
  { label: "New Order", href: "/orders/new" },
  { label: "Record Expense", href: "/expenses/new" },
  { label: "New Quotation", href: "/quotations/new" },
  { label: "New Invoice", href: "/invoices/new" },
  { label: "Record Payment", href: "/payments/new" },
];
