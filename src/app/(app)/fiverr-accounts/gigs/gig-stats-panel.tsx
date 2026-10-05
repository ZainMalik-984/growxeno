"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Section } from "@/components/ui/page";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createGigStatAction, updateGigStatAction } from "@/lib/fiverr-accounts/actions";
import type { GigStatRow, GigWithAccount } from "@/lib/fiverr-accounts/queries";
import { cn } from "@/lib/utils";

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const todayIso = () => new Date().toISOString().slice(0, 10);
const DETAILS_PAGE_SIZE = 10;

/** `null` when there is nothing to compare against (no previous entry, or it was 0 — a percentage from zero is meaningless). */
function percentChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Confirmed directly, 2026-09-27: green/red with an up/down arrow, in both the chart and the details table. */
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

/** One gig's chart (Impressions, Clicks), with its daily-entry form and its full history kept out of the way in dialogs. */
export function GigStatsPanel({
  gig,
  initialStats,
  canManage,
}: {
  gig: GigWithAccount;
  initialStats: GigStatRow[];
  canManage: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const chartData = initialStats.map((row) => ({
    label: dayFormat.format(new Date(`${row.date}T00:00:00.000Z`)),
    impressions: row.impressions,
    clicks: row.clicks,
  }));

  // Latest entry vs the one before it — the trend a glance at the chart should confirm.
  const latest = initialStats.at(-1);
  const previous = initialStats.at(-2);
  const impressionsPct = latest ? percentChange(latest.impressions, previous?.impressions) : null;
  const clicksPct = latest ? percentChange(latest.clicks, previous?.clicks) : null;

  return (
    <Section title={gig.name} description={gig.fiverrAccountName}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Impressions / clicks per day</p>
        {latest ? (
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-ink-faint">
              Impressions <ChangeBadge pct={impressionsPct} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-faint">
              Clicks <ChangeBadge pct={clicksPct} />
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
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-4 flex items-center gap-2">
        {canManage ? <AddLogDropdown gigId={gig.id} /> : null}
        <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>
          View details ({initialStats.length})
        </Button>
      </div>

      {showDetails ? (
        <DetailsModal gigName={gig.name} stats={initialStats} canManage={canManage} onClose={() => setShowDetails(false)} />
      ) : null}
    </Section>
  );
}

/**
 * Anchored dropdown, not a popup dialog (confirmed directly, 2026-09-27) —
 * same click-outside/Escape pattern as `UserMenu` and `CustomerPicker`,
 * rather than the shared `Modal`.
 */
function AddLogDropdown({ gigId }: { gigId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [error, setError] = useState<string | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await createGigStatAction({ gigId, statDate: date, impressions, clicks });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setImpressions("");
        setClicks("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Add log
      </Button>

      {open ? (
        <div className="absolute left-0 z-40 mt-1 w-64 border border-line bg-canvas p-4 shadow-sm">
          <div className="space-y-3">
            <Field label="Date" htmlFor={`gig-log-date-${gigId}`}>
              <Input id={`gig-log-date-${gigId}`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Impressions" htmlFor={`gig-log-impressions-${gigId}`}>
              <Input
                id={`gig-log-impressions-${gigId}`}
                inputMode="numeric"
                value={impressions}
                onChange={(event) => setImpressions(event.target.value)}
              />
            </Field>
            <Field label="Clicks" htmlFor={`gig-log-clicks-${gigId}`}>
              <Input id={`gig-log-clicks-${gigId}`} inputMode="numeric" value={clicks} onChange={(event) => setClicks(event.target.value)} />
            </Field>

            {error ? (
              <p role="alert" className="text-[13px] text-red-600">
                {error}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={pending || !impressions || !clicks}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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

  // Change is computed against the chronologically previous entry, in ascending
  // order, BEFORE reversing for display — pagination must never shift what a
  // row is compared against.
  const withChange = stats.map((row, index) => ({
    ...row,
    impressionsChange: percentChange(row.impressions, stats[index - 1]?.impressions),
    clicksChange: percentChange(row.clicks, stats[index - 1]?.clicks),
  }));
  const rows = [...withChange].reverse();
  const pageCount = Math.max(1, Math.ceil(rows.length / DETAILS_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * DETAILS_PAGE_SIZE, page * DETAILS_PAGE_SIZE);

  const startEdit = (row: GigStatRow) => {
    setEditing(row.id);
    setEditImpressions(String(row.impressions));
    setEditClicks(String(row.clicks));
  };

  const saveEdit = (statId: string) => {
    startTransition(async () => {
      const result = await updateGigStatAction({ statId, impressions: editImpressions, clicks: editClicks });
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
                            <Input
                              inputMode="numeric"
                              value={editImpressions}
                              onChange={(event) => setEditImpressions(event.target.value)}
                              className="h-7 w-20 text-right"
                            />
                          </TD>
                          <TD>
                            <Input inputMode="numeric" value={editClicks} onChange={(event) => setEditClicks(event.target.value)} className="h-7 w-20 text-right" />
                          </TD>
                          <TD>
                            <Button variant="ghost" size="sm" onClick={() => saveEdit(row.id)} disabled={pending}>
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                              Cancel
                            </Button>
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
                          {canManage ? (
                            <TD>
                              <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                                Edit
                              </Button>
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
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
