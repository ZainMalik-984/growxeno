"use client";

import { ArrowDown, ArrowUp, BarChart2, ListPlus, Table2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  bulkUpsertGigStatsAction,
  createGigStatAction,
  getGigStatsForRangeAction,
  updateGigStatAction,
} from "@/lib/fiverr-accounts/actions";
import type { GigStatRow, GigWithAccount } from "@/lib/fiverr-accounts/queries";
import { cn } from "@/lib/utils";

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const todayIso = () => new Date().toISOString().slice(0, 10);
const DETAILS_PAGE_SIZE = 10;

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** `null` when there is nothing to compare against (no previous entry, or it was 0 — a percentage from zero is meaningless). */
function percentChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Confirmed directly, 2026-09-27: green/red with an up/down arrow. */
function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-ink-faint">—</span>;
  if (pct === 0) return <span className="text-ink-faint">0.0%</span>;
  const up = pct > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap font-medium", up ? "text-emerald-600" : "text-red-600")}>
      <Icon aria-hidden="true" className="size-3" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** One gig's chart (Impressions, Clicks, Orders), with entry forms and history. */
export function GigStatsPanel({
  gig,
  initialStats,
  canManage,
  canManageStats,
}: {
  gig: GigWithAccount;
  initialStats: GigStatRow[];
  canManage: boolean;
  canManageStats: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);

  const chartData = initialStats.map((row) => ({
    label: dayFormat.format(new Date(`${row.date}T00:00:00.000Z`)),
    impressions: row.impressions,
    clicks: row.clicks,
    orders: row.orders,
  }));

  const latest = initialStats.at(-1);
  const previous = initialStats.at(-2);
  const impressionsPct = latest ? percentChange(latest.impressions, previous?.impressions) : null;
  const clicksPct = latest ? percentChange(latest.clicks, previous?.clicks) : null;
  const ordersPct = latest ? percentChange(latest.orders, previous?.orders) : null;

  const menuItems = [
    ...(canManageStats
      ? [
          { label: "Add log", icon: ListPlus, onSelect: () => setShowAddLog(true) },
          { label: "Bulk add / update", icon: Table2, onSelect: () => setShowBulk(true) },
          "separator" as const,
        ]
      : []),
    { label: `View details (${initialStats.length})`, icon: BarChart2, onSelect: () => setShowDetails(true) },
  ];

  return (
    <Section>
      {/* Header row: thumbnail + account/name + action menu */}
      <div className="mb-4 flex items-start gap-3">
        {/* Square thumbnail */}
        <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
          {gig.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gig.thumbnailUrl} alt={gig.name} className="h-auto w-full" />
          ) : null}
        </div>
        {/* Account + gig name */}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-zinc-500">{gig.fiverrAccountName}</p>
          <p className="mt-0.5 text-[13px] font-medium leading-snug text-zinc-900">{gig.name}</p>
        </div>
        {/* 3-dot menu */}
        <ActionMenu label={`Actions for ${gig.name}`} items={menuItems} />
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Impressions / clicks / orders per day</p>
        {latest ? (
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-ink-faint">
              Impressions <ChangeBadge pct={impressionsPct} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-faint">
              Clicks <ChangeBadge pct={clicksPct} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-faint">
              Orders <ChangeBadge pct={ordersPct} />
            </span>
          </div>
        ) : null}
      </div>
      {chartData.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No entries yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 3 }} />
            <Line type="linear" dataKey="impressions" name="Impressions" stroke="#18181b" strokeWidth={2} dot={false} />
            <Line type="linear" dataKey="clicks" name="Clicks" stroke="#a1a1aa" strokeWidth={2} dot={false} />
            <Line type="linear" dataKey="orders" name="Orders" stroke="#16a34a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {showAddLog ? (
        <AddLogModal gigId={gig.id} onClose={() => setShowAddLog(false)} />
      ) : null}

      {showDetails ? (
        <DetailsModal gigName={gig.name} stats={initialStats} canManage={canManageStats} onClose={() => setShowDetails(false)} />
      ) : null}

      {showBulk ? (
        <BulkModal gigId={gig.id} gigName={gig.name} onClose={() => setShowBulk(false)} />
      ) : null}
    </Section>
  );
}

function AddLogModal({ gigId, onClose }: { gigId: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayIso());
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [orders, setOrders] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await createGigStatAction({ gigId, statDate: date, impressions, clicks, orders: orders || "0" });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Modal open onClose={onClose} labelledBy="add-log-title">
      <h2 id="add-log-title" className="text-[15px] font-medium text-ink-strong">Add log</h2>
      <div className="mt-5 space-y-3">
        <Field label="Date" htmlFor={`gig-log-date-${gigId}`}>
          <Input id={`gig-log-date-${gigId}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Impressions" htmlFor={`gig-log-impressions-${gigId}`}>
          <Input id={`gig-log-impressions-${gigId}`} inputMode="numeric" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
        </Field>
        <Field label="Clicks" htmlFor={`gig-log-clicks-${gigId}`}>
          <Input id={`gig-log-clicks-${gigId}`} inputMode="numeric" value={clicks} onChange={(e) => setClicks(e.target.value)} />
        </Field>
        <Field label="Orders" htmlFor={`gig-log-orders-${gigId}`}>
          <Input id={`gig-log-orders-${gigId}`} inputMode="numeric" value={orders} onChange={(e) => setOrders(e.target.value)} placeholder="0" />
        </Field>
        {error ? <p role="alert" className="text-[13px] text-red-600">{error}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={pending || !impressions || !clicks}>
          {pending ? "Saving…" : "Add"}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bulk add / update modal
// ---------------------------------------------------------------------------

type BulkRow = { date: string; impressions: string; clicks: string; orders: string; existingId?: string };

function BulkModal({ gigId, gigName, onClose }: { gigId: string; gigName: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"range" | "table">("range");

  const defaultFrom = new Date();
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);
  const [from, setFrom] = useState(defaultFrom.toISOString().slice(0, 10));
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loadingRange, setLoadingRange] = useState(false);

  const loadRange = () => {
    if (!from || !to || from > to) {
      setError("Pick a valid date range.");
      return;
    }
    const dates = dateRange(from, to);
    if (dates.length > 90) {
      setError("Range cannot exceed 90 days.");
      return;
    }
    setError(undefined);
    setLoadingRange(true);

    startTransition(async () => {
      const result = await getGigStatsForRangeAction({ gigId, from, to });
      setLoadingRange(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const existingByDate = new Map(result.stats.map((s) => [s.date, s]));
      setRows(
        dates.map((date) => {
          const existing = existingByDate.get(date);
          return {
            date,
            impressions: existing ? String(existing.impressions) : "",
            clicks: existing ? String(existing.clicks) : "",
            orders: existing ? String(existing.orders) : "",
            existingId: existing?.id,
          };
        }),
      );
      setStep("table");
    });
  };

  const updateRow = (index: number, field: keyof Omit<BulkRow, "date" | "existingId">, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const save = () => {
    setError(undefined);
    // Only submit rows that have at least impressions filled in
    const filled = rows.filter((r) => r.impressions !== "" || r.clicks !== "" || r.orders !== "");
    if (filled.length === 0) {
      setError("Fill in at least one row.");
      return;
    }
    const entries = filled.map((r) => ({
      statDate: r.date,
      impressions: r.impressions || "0",
      clicks: r.clicks || "0",
      orders: r.orders || "0",
    }));

    startTransition(async () => {
      const result = await bulkUpsertGigStatsAction({ gigId, entries });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Modal open onClose={onClose} labelledBy="bulk-modal-title">
      <h2 id="bulk-modal-title" className="text-[15px] font-medium text-ink-strong">
        {gigName} — bulk add / update
      </h2>

      {step === "range" ? (
        <div className="mt-5 space-y-4">
          <p className="text-[13px] text-ink-muted">
            Pick a date range. Existing entries will be pre-filled and can be updated.
          </p>
          <div className="flex items-end gap-3">
            <Field label="From" htmlFor="bulk-from">
              <Input id="bulk-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To" htmlFor="bulk-to">
              <Input id="bulk-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          {error ? <p role="alert" className="text-[13px] text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button variant="primary" onClick={loadRange} disabled={pending || loadingRange}>
              {loadingRange ? "Loading…" : "Continue"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-3 text-[13px] text-ink-muted">
            {from === to ? dayFormat.format(new Date(`${from}T00:00:00.000Z`)) : `${dayFormat.format(new Date(`${from}T00:00:00.000Z`))} – ${dayFormat.format(new Date(`${to}T00:00:00.000Z`))}`}
            {" · "}{rows.length} day{rows.length !== 1 ? "s" : ""}
            {" · "}<button type="button" className="text-ink hover:underline" onClick={() => { setStep("range"); setRows([]); }}>Change range</button>
          </p>

          <div className="max-h-[50vh] overflow-y-auto">
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH className="text-right">Impressions</TH>
                    <TH className="text-right">Clicks</TH>
                    <TH className="text-right">Orders</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((row, index) => (
                    <TR key={row.date} className={row.existingId ? "bg-surface/50" : undefined}>
                      <TD className="whitespace-nowrap text-ink-muted">
                        {dayFormat.format(new Date(`${row.date}T00:00:00.000Z`))}
                        {row.existingId ? <span className="ml-1.5 text-[10px] text-ink-faint">existing</span> : null}
                      </TD>
                      <TD>
                        <Input
                          inputMode="numeric"
                          value={row.impressions}
                          onChange={(e) => updateRow(index, "impressions", e.target.value)}
                          className="h-7 w-24 text-right"
                          placeholder="0"
                        />
                      </TD>
                      <TD>
                        <Input
                          inputMode="numeric"
                          value={row.clicks}
                          onChange={(e) => updateRow(index, "clicks", e.target.value)}
                          className="h-7 w-24 text-right"
                          placeholder="0"
                        />
                      </TD>
                      <TD>
                        <Input
                          inputMode="numeric"
                          value={row.orders}
                          onChange={(e) => updateRow(index, "orders", e.target.value)}
                          className="h-7 w-20 text-right"
                          placeholder="0"
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </div>

          {error ? <p role="alert" className="mt-3 text-[13px] text-red-600">{error}</p> : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Details modal (single-row edit, paginated history)
// ---------------------------------------------------------------------------

function DetailsModal({
  gigName,
  stats,
  canManage,
  onClose,
}: {
  gigName: string;
  stats: readonly GigStatRow[];
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [editImpressions, setEditImpressions] = useState("");
  const [editClicks, setEditClicks] = useState("");
  const [editOrders, setEditOrders] = useState("");

  const withChange = stats.map((row, index) => ({
    ...row,
    impressionsChange: percentChange(row.impressions, stats[index - 1]?.impressions),
    clicksChange: percentChange(row.clicks, stats[index - 1]?.clicks),
    ordersChange: percentChange(row.orders, stats[index - 1]?.orders),
  }));
  const rows = [...withChange].reverse();
  const pageCount = Math.max(1, Math.ceil(rows.length / DETAILS_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * DETAILS_PAGE_SIZE, page * DETAILS_PAGE_SIZE);

  const startEdit = (row: GigStatRow) => {
    setEditing(row.id);
    setEditImpressions(String(row.impressions));
    setEditClicks(String(row.clicks));
    setEditOrders(String(row.orders));
  };

  const saveEdit = (statId: string) => {
    startTransition(async () => {
      const result = await updateGigStatAction({ statId, impressions: editImpressions, clicks: editClicks, orders: editOrders });
      if (result.ok) {
        toast.success(result.message);
        setEditing(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Modal open onClose={onClose} labelledBy="gig-log-details-title">
      <h2 id="gig-log-details-title" className="text-[15px] font-medium text-ink-strong">
        {gigName} — daily log
      </h2>

      <div className="mt-5">
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No entries yet.</p>
        ) : (
          <>
            <TableWrap>
              <Table>
                <caption className="sr-only">{gigName} daily stats</caption>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH className="text-right">Impressions</TH>
                    <TH className="text-right">Clicks</TH>
                    <TH className="text-right">Orders</TH>
                    {canManage ? <TH /> : null}
                  </TR>
                </THead>
                <TBody>
                  {pageRows.map((row) => (
                    <TR key={row.id}>
                      <TD className="text-ink-muted">{dayFormat.format(new Date(`${row.date}T00:00:00.000Z`))}</TD>
                      {editing === row.id ? (
                        <>
                          <TD>
                            <Input inputMode="numeric" value={editImpressions} onChange={(e) => setEditImpressions(e.target.value)} className="h-7 w-20 text-right" />
                          </TD>
                          <TD>
                            <Input inputMode="numeric" value={editClicks} onChange={(e) => setEditClicks(e.target.value)} className="h-7 w-20 text-right" />
                          </TD>
                          <TD>
                            <Input inputMode="numeric" value={editOrders} onChange={(e) => setEditOrders(e.target.value)} className="h-7 w-16 text-right" />
                          </TD>
                          <TD>
                            <Button variant="ghost" size="sm" onClick={() => saveEdit(row.id)} disabled={pending}>Save</Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={pending}>Cancel</Button>
                          </TD>
                        </>
                      ) : (
                        <>
                          <TD className="text-right text-ink">
                            <div className="flex items-center justify-end gap-2">
                              {row.impressions.toLocaleString()}
                              <ChangeBadge pct={row.impressionsChange} />
                            </div>
                          </TD>
                          <TD className="text-right text-ink">
                            <div className="flex items-center justify-end gap-2">
                              {row.clicks.toLocaleString()}
                              <ChangeBadge pct={row.clicksChange} />
                            </div>
                          </TD>
                          <TD className="text-right text-ink">
                            <div className="flex items-center justify-end gap-2">
                              {row.orders.toLocaleString()}
                              <ChangeBadge pct={row.ordersChange} />
                            </div>
                          </TD>
                          {canManage ? (
                            <TD>
                              <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>Edit</Button>
                            </TD>
                          ) : null}
                        </>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
              <p>
                Page {page} of {pageCount} · {rows.length} entr{rows.length === 1 ? "y" : "ies"}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="hover:text-ink hover:underline disabled:text-ink-faint disabled:no-underline"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="hover:text-ink hover:underline disabled:text-ink-faint disabled:no-underline"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
