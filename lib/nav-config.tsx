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
  BookOpen,
  FileSpreadsheet,
  Percent,
  BarChart3,
  Receipt,
  Store,
  Settings,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Route prefixes (besides href) that should also mark this item active. */
  matchPrefixes?: string[];
  requiredPermission?: Permission;
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
      { label: "Customers", href: "/customers", icon: Users, requiredPermission: "customers:view" },
      { label: "Products & Services", href: "/products", icon: Package, requiredPermission: "products:view" },
      { label: "Quotations", href: "/quotations", icon: FileText, requiredPermission: "quotations:view" },
      { label: "Orders", href: "/orders", icon: ShoppingBag, requiredPermission: "orders:view" },
      { label: "Invoices", href: "/invoices", icon: ReceiptText, requiredPermission: "invoices:view" },
      { label: "Payments", href: "/payments", icon: Wallet, requiredPermission: "payments:view" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Production", href: "/production", icon: Factory, requiredPermission: "production:view" },
      { label: "Deliveries", href: "/deliveries", icon: Truck, requiredPermission: "deliveries:view" },
    ],
  },
  {
    label: "PLANNER",
    items: [
      { label: "Planner", href: "/planner", icon: LayoutList, requiredPermission: "tasks:view" },
      { label: "Calendar", href: "/calendar", icon: Calendar, requiredPermission: "calendar:view" },
      { label: "Tasks", href: "/tasks", icon: CheckSquare, requiredPermission: "tasks:view" },
      { label: "Notes", href: "/notes", icon: StickyNote, requiredPermission: "notes:view" },
    ],
  },
  {
    label: "FINANCE & ACCOUNTS",
    items: [
      { label: "Overview", href: "/finance", icon: PieChart, requiredPermission: "finance:view" },
      { label: "Accounts", href: "/accounts", icon: BookOpen, requiredPermission: "accounting:view" },
      { label: "Journal", href: "/accounting/journal", icon: FileSpreadsheet, requiredPermission: "journal:view" },
      { label: "Tax", href: "/finance/tax", icon: Percent, requiredPermission: "tax:view" },
      { label: "Reports", href: "/reports/profit-loss", icon: BarChart3, requiredPermission: "reports:view" },
      { label: "Expenses", href: "/expenses", icon: Receipt, requiredPermission: "expenses:view" },
      { label: "Vendors", href: "/vendors", icon: Store, requiredPermission: "vendors:view" },
    ],
  },
  {
    label: "OTHER",
    items: [
      { label: "Users", href: "/users", icon: UserCheck, requiredPermission: "users:manage" },
      { label: "Settings", href: "/settings", icon: Settings, requiredPermission: "settings:view" },
    ],
  },
];

export const QUICK_ACTIONS = [
  { label: "New Task", href: "/tasks/new", requiredPermission: "tasks:create" as Permission },
  { label: "New Note", href: "/notes/new", requiredPermission: "notes:create" as Permission },
  { label: "New Order", href: "/orders/new", requiredPermission: "orders:create" as Permission },
  { label: "Record Expense", href: "/expenses/new", requiredPermission: "expenses:create" as Permission },
  { label: "New Quotation", href: "/quotations/new", requiredPermission: "quotations:create" as Permission },
  { label: "New Invoice", href: "/invoices/new", requiredPermission: "invoices:create" as Permission },
  { label: "Record Payment", href: "/payments/new", requiredPermission: "payments:record" as Permission },
];
