"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { bulkUpsertDailyStatsAction, copyPreviousDayAction } from "@/lib/daily-stats/actions";
import type { DailyStatRow } from "@/lib/daily-stats/queries";
import { CURRENCIES } from "@/lib/finance/money";

type UserOption = { id: string; label: string };
type RowState = { orders: string; completed: string; pending: string; revenue: string; revenueCurrency: string };

const emptyRow: RowState = { orders: "0", completed: "0", pending: "0", revenue: "0", revenueCurrency: "USD" };

/**
 * One row per active user for a chosen date, entered in one table and saved
 * together (specification Section 53's "Bulk entry", Section 54: "enter
 * statistics for multiple users without opening many separate pages").
 */
export function BulkEntryForm({
  users,
  existing,
}: {
  users: readonly UserOption[];
  existing: ReadonlyMap<string, DailyStatRow>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const initialRows = useMemo(() => {
    const map = new Map<string, RowState>();
    for (const user of users) {
      const row = existing.get(user.id);
      map.set(
        user.id,
        row
          ? {
              orders: String(row.orders),
              completed: String(row.completed),
              pending: String(row.pending),
              revenue: row.revenue,
              revenueCurrency: row.revenueCurrency,
            }
          : emptyRow,
      );
    }
    return map;
  }, [users, existing]);
  const [rows, setRows] = useState(initialRows);
  // Only a row someone actually edited (or that already had a saved entry)
  // is submitted — otherwise "Save all" would create a real zero-value row
  // for every OTHER active user just because their input showed "0" by
  // default, which nobody asked for.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set(existing.keys()));

  const changeDate = (value: string) => {
    setDate(value);
    router.push(`/daily-stats?bulkDate=${value}#bulk-entry`);
  };

  const setField = (userId: string, field: keyof RowState, value: string) => {
    setRows((current) => {
      const next = new Map(current);
      next.set(userId, { ...(next.get(userId) ?? emptyRow), [field]: value });
      return next;
    });
    setTouched((current) => new Set(current).add(userId));
  };

  const saveAll = () => {
    startTransition(async () => {
      const entries = users
        .filter((user) => touched.has(user.id))
        .map((user) => ({ userId: user.id, ...(rows.get(user.id) ?? emptyRow) }));
      if (entries.length === 0) {
        toast.error("Change at least one row before saving.");
        return;
      }
      const result = await bulkUpsertDailyStatsAction({ statDate: date, entries });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const copyPreviousDay = () => {
    startTransition(async () => {
      const result = await copyPreviousDayAction({ statDate: date });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div id="bulk-entry">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-ink-muted">
          Date
          <Input type="date" className="h-8 w-40" value={date} onChange={(event) => changeDate(event.target.value)} />
        </label>
        <Button variant="secondary" size="sm" onClick={copyPreviousDay} disabled={pending}>
          Copy previous day
        </Button>
      </div>

      <TableWrap>
        <Table>
          <caption className="sr-only">Bulk daily statistics entry</caption>
          <THead>
            <TR>
              <TH>User</TH>
              <TH className="text-right">Orders</TH>
              <TH className="text-right">Completed</TH>
              <TH className="text-right">Pending</TH>
              <TH className="text-right">Revenue</TH>
              <TH>Currency</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((user) => {
              const row = rows.get(user.id) ?? emptyRow;
              return (
                <TR key={user.id}>
                  <TD className="font-medium text-ink">{user.label}</TD>
                  <TD>
                    <Input
                      inputMode="numeric"
                      className="h-7 w-20 text-right"
                      aria-label={`${user.label} orders`}
                      value={row.orders}
                      onChange={(event) => setField(user.id, "orders", event.target.value)}
                    />
                  </TD>
                  <TD>
                    <Input
                      inputMode="numeric"
                      className="h-7 w-20 text-right"
                      aria-label={`${user.label} completed`}
                      value={row.completed}
                      onChange={(event) => setField(user.id, "completed", event.target.value)}
                    />
                  </TD>
                  <TD>
                    <Input
                      inputMode="numeric"
                      className="h-7 w-20 text-right"
                      aria-label={`${user.label} pending`}
                      value={row.pending}
                      onChange={(event) => setField(user.id, "pending", event.target.value)}
                    />
                  </TD>
                  <TD>
                    <Input
                      inputMode="decimal"
                      className="h-7 w-24 text-right"
                      aria-label={`${user.label} revenue`}
                      value={row.revenue}
                      onChange={(event) => setField(user.id, "revenue", event.target.value)}
                    />
                  </TD>
                  <TD>
                    <Select
                      className="h-7 w-16"
                      aria-label={`${user.label} revenue currency`}
                      value={row.revenueCurrency}
                      onChange={(event) => setField(user.id, "revenueCurrency", event.target.value)}
                    >
                      {CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </Select>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableWrap>

      <Button variant="primary" className="mt-4" onClick={saveAll} disabled={pending || users.length === 0}>
        {pending ? "Saving…" : "Save all"}
      </Button>
    </div>
  );
}
