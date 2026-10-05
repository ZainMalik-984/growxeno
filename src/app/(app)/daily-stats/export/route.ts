import { NextResponse, type NextRequest } from "next/server";

import { getCurrentActor } from "@/lib/auth/session";
import { resolveScope } from "@/lib/permissions/scope";
import { listDailyStatsForExport, type DailyStatScope } from "@/lib/daily-stats/queries";

/**
 * CSV export of Daily Statistics (specification Section 53), scoped and
 * filtered exactly like the `/daily-stats` list. A Route Handler, not a
 * server action, because a file download needs a real HTTP response with
 * `Content-Disposition` — see the auth callback route for why `redirect()`
 * from `next/navigation` cannot be used here either.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const actor = await getCurrentActor();
  if (!actor || !actor.user.isActive || !actor.permissions.has("daily_stats.export")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const scopeResult = resolveScope(actor.permissions, "daily_stats.view");
  const scope: DailyStatScope = scopeResult === "ALL" ? { mode: "ALL" } : { mode: "OWN", userId: actor.user.id };

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user") ?? undefined;
  const dateFrom = searchParams.get("from") ? new Date(`${searchParams.get("from")}T00:00:00.000Z`) : undefined;
  const dateTo = searchParams.get("to") ? new Date(`${searchParams.get("to")}T00:00:00.000Z`) : undefined;

  const rows = await listDailyStatsForExport({ userId, dateFrom, dateTo }, scope);

  const header = ["Date", "User", "Orders", "Completed", "Pending", "Revenue", "Currency", "Notes"];
  const csvEscape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.statDate.toISOString().slice(0, 10),
        row.userName,
        String(row.orders),
        String(row.completed),
        String(row.pending),
        row.revenue,
        row.revenueCurrency,
        row.notes ?? "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daily-statistics-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
