"use server";

import { getRevenueExpenseSeries, type RevenueRange } from "@/lib/services/dashboard";
import { requireAuth } from "@/lib/auth/session";

export async function getRevenueSeriesAction(range: RevenueRange) {
  await requireAuth();
  return getRevenueExpenseSeries(range);
}
