"use client";

import Link from "next/link";
import { CheckSquare, Factory, Truck, Receipt, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/money";

export function OperationalWidgets({
  todayTasks = [],
  pendingProductionCount = 0,
  deliveriesTodayCount = 0,
  recentExpenses = [],
}: {
  todayTasks?: any[];
  pendingProductionCount?: number;
  deliveriesTodayCount?: number;
  recentExpenses?: any[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {/* Today Tasks Card */}
      <Card className="p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Today's Tasks</span>
            <CheckSquare className="size-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground">{todayTasks.length} Due Today</p>
          {todayTasks.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              Top: <span className="font-semibold text-foreground">{todayTasks[0].title}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">All tasks completed</p>
          )}
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 text-xs justify-between mt-3 px-0 text-primary">
          <Link href="/planner">
            Go to Daily Planner <ArrowRight className="size-3" />
          </Link>
        </Button>
      </Card>

      {/* Pending Production Card */}
      <Card className="p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Pending Production</span>
            <Factory className="size-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-foreground">{pendingProductionCount} Active Jobs</p>
          <p className="text-xs text-muted-foreground mt-1">Jobs currently in manufacturing</p>
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 text-xs justify-between mt-3 px-0 text-primary">
          <Link href="/production">
            View Kanban Board <ArrowRight className="size-3" />
          </Link>
        </Button>
      </Card>

      {/* Deliveries Today Card */}
      <Card className="p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Deliveries Today</span>
            <Truck className="size-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-foreground">{deliveriesTodayCount} Scheduled</p>
          <p className="text-xs text-muted-foreground mt-1">Orders out for dispatch</p>
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 text-xs justify-between mt-3 px-0 text-primary">
          <Link href="/deliveries">
            View Deliveries <ArrowRight className="size-3" />
          </Link>
        </Button>
      </Card>

      {/* Recent Expenses Card */}
      <Card className="p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Recent Expense</span>
            <Receipt className="size-4 text-rose-600" />
          </div>
          {recentExpenses.length > 0 ? (
            <div>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(recentExpenses[0].totalAmountPaise)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {recentExpenses[0].description}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">No recorded expenses</p>
          )}
        </div>
        <Button asChild size="sm" variant="ghost" className="h-7 text-xs justify-between mt-3 px-0 text-primary">
          <Link href="/expenses">
            View All Expenses <ArrowRight className="size-3" />
          </Link>
        </Button>
      </Card>
    </div>
  );
}

