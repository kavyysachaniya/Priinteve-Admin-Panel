"use server";

import { requirePermission } from "@/lib/auth/session";
import { getCustomerStatement, getVendorStatement } from "@/lib/services/accounting/statements";

export async function fetchCustomerStatementAction(customerId: string, startDate?: string, endDate?: string) {
  await requirePermission("statements:view");
  return getCustomerStatement(customerId, { startDate, endDate });
}

export async function fetchVendorStatementAction(vendorId: string, startDate?: string, endDate?: string) {
  await requirePermission("statements:view");
  return getVendorStatement(vendorId, { startDate, endDate });
}
