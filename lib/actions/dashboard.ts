"use server";

import { getRevenueExpenseSeries, type RevenueRange } from "@/lib/services/dashboard";

export async function getRevenueSeriesAction(range: RevenueRange) {
  return getRevenueExpenseSeries(range);
}
