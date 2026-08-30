import type { UserRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Permission definitions
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // Customers
  "customers:view": "View customers",
  "customers:create": "Create customers",
  "customers:edit": "Edit customers",
  "customers:delete": "Delete customers",
  // Products
  "products:view": "View products",
  "products:create": "Create products",
  "products:edit": "Edit products",
  "products:delete": "Delete products",
  // Quotations
  "quotations:view": "View quotations",
  "quotations:create": "Create quotations",
  "quotations:edit": "Edit quotations",
  "quotations:convert": "Convert quotations",
  "quotations:delete": "Delete quotations",
  // Orders
  "orders:view": "View orders",
  "orders:create": "Create orders",
  "orders:edit": "Edit orders",
  "orders:update_status": "Update order status",
  "orders:delete": "Delete orders",
  // Invoices
  "invoices:view": "View invoices",
  "invoices:create": "Create invoices",
  "invoices:edit": "Edit invoices",
  "invoices:delete": "Delete invoices",
  // Payments
  "payments:view": "View payments",
  "payments:record": "Record payments",
  "payments:delete": "Delete payments",
  // Production
  "production:view": "View production jobs",
  "production:create": "Create production jobs",
  "production:update_assigned": "Update assigned production jobs",
  "production:update_any": "Update any production job",
  // Deliveries
  "deliveries:view": "View deliveries",
  "deliveries:create": "Create deliveries",
  "deliveries:update_status": "Update delivery status",
  // Expenses
  "expenses:view": "View expenses",
  "expenses:create": "Create expenses",
  "expenses:edit": "Edit expenses",
  "expenses:delete": "Delete expenses",
  // Vendors
  "vendors:view": "View vendors",
  "vendors:create": "Create vendors",
  "vendors:edit": "Edit vendors",
  // Finance
  "finance:view": "View finance overview",
  // Tasks
  "tasks:view": "View tasks",
  "tasks:create": "Create tasks",
  "tasks:edit": "Edit tasks",
  "tasks:delete": "Delete tasks",
  // Notes
  "notes:view": "View notes",
  "notes:create": "Create notes",
  "notes:edit": "Edit notes",
  "notes:delete": "Delete notes",
  // Calendar
  "calendar:view": "View calendar",
  "calendar:create": "Create calendar events",
  // Settings
  "settings:view": "View settings",
  "settings:edit": "Edit settings",
  // Users
  "users:manage": "Manage users",
  // Accounting & Reports
  "accounting:view": "View accounting overview and balances",
  "accounting:manage": "Manage chart of accounts and periods",
  "journal:view": "View journal entries and ledger",
  "journal:create": "Create manual journal entries and reversals",
  "tax:view": "View GST and tax reports",
  "reports:view": "View Profit & Loss, Balance Sheet, Cash Flow",
  "statements:view": "View customer and vendor statements",
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ---------------------------------------------------------------------------
// Role → Permission mapping
// ---------------------------------------------------------------------------

const ADMIN_PERMISSIONS: Permission[] = Object.keys(PERMISSIONS) as Permission[];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  "customers:view",
  "customers:create",
  "customers:edit",
  "products:view",
  "quotations:view",
  "quotations:create",
  "quotations:edit",
  "quotations:convert",
  "orders:view",
  "orders:create",
  "orders:edit",
  "orders:update_status",
  "invoices:view",
  "payments:view",
  "production:view",
  "production:update_assigned",
  "deliveries:view",
  "deliveries:create",
  "deliveries:update_status",
  "tasks:view",
  "tasks:create",
  "tasks:edit",
  "tasks:delete",
  "notes:view",
  "notes:create",
  "notes:edit",
  "notes:delete",
  "calendar:view",
  "calendar:create",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
};

/**
 * Check if a role has a specific permission.
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
