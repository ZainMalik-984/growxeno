import "server-only";

import type { OrderItemStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { serviceLabel } from "@/lib/services/label";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { parseYoutubeLink, studioAnalyticsUrl } from "@/lib/youtube/link";
import { assignedItemWhere, type AssignmentIdentity } from "./assignment";
import { sortWorkerTasks, WORKER_TASK_VIEW_STATUSES, WORKER_TASK_VIEWS, type WorkerTaskView } from "./worker-task-view";

/**
 * An External Worker's own tasks for the Orders page (owner request,
 * 2026-11-11). Queried as items, not orders, so they can be filtered and
 * sorted by the item's own status and assignment time. Only the worker's own
 * items, and nothing about the order beyond its number.
 */

export type WorkerTask = {
  id: string;
  orderId: string;
  orderNumber: number;
  serviceName: string;
  metricType: ServiceMetricType | null;
  status: OrderItemStatus;
  description: string | null;
  channelLink: string | null;
  /** Channel or video name read from YouTube, when known. */
  channelTitle: string | null;
  /** YouTube Studio analytics for a watch-hours item's channel. */
  studioUrl: string | null;
  assignedAt: Date | null;
  finishedAt: Date | null;
  deadline: Date | null;
  createdAt: Date;
  currentCount: number | null;
  targetCount: number | null;
  startingCount: number | null;
  workerCost: string | null;
  workerCostCurrency: string;
  /** Latest public YouTube numbers for the link, when read. */
  stats: { subscribers: number | null; views: number | null; likes: number | null; comments: number | null; at: Date } | null;
  links: { id: string; url: string; label: string | null }[];
};

const MAX_TASKS = 500;

function searchWhere(search: string | undefined): Prisma.OrderItemWhereInput | null {
  const q = search?.trim();
  if (!q) return null;
  const numeric = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : undefined;
  return {
    OR: [
      ...(numeric !== undefined ? [{ order: { orderNumber: numeric } }] : []),
      { service: { name: { contains: q, mode: "insensitive" as const } } },
      { category: { name: { contains: q, mode: "insensitive" as const } } },
      { channelLink: { contains: q, mode: "insensitive" as const } },
      { statsTitle: { contains: q, mode: "insensitive" as const } },
      { description: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

function bigToNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

/** The channel id for the Studio link: read from YouTube, or straight from a /channel/UC… link. */
function channelIdFor(item: { statsSourceKind: string | null; statsSourceId: string | null; channelLink: string | null }): string | null {
  if (item.statsSourceKind === "CHANNEL" && item.statsSourceId) return item.statsSourceId;
  if (!item.channelLink) return null;
  const parsed = parseYoutubeLink(item.channelLink);
  return parsed.ok && parsed.target.kind === "channel" ? parsed.target.channelId : null;
}

export async function listWorkerTasks(
  identity: AssignmentIdentity,
  /** `focusId`: a task opened from its accept link — loaded even when outside the tab or search (only if it's theirs). */
  options: { view: WorkerTaskView; search?: string; focusId?: string },
): Promise<{ tasks: WorkerTask[]; counts: Record<WorkerTaskView, number>; focus: WorkerTask | null }> {
  const mine = assignedItemWhere(identity);
  const search = searchWhere(options.search);
  const base: Prisma.OrderItemWhereInput = search ? { AND: [mine, search] } : mine;
  const inView: Prisma.OrderItemWhereInput = { AND: [base, { status: { in: [...WORKER_TASK_VIEW_STATUSES[options.view]] } }] };

  const [items, groups] = await Promise.all([
    prisma.orderItem.findMany({
      where: options.focusId ? { OR: [inView, { AND: [mine, { id: options.focusId }] }] } : inView,
      select: {
        id: true,
        orderId: true,
        status: true,
        description: true,
        channelLink: true,
        statsTitle: true,
        statsSourceId: true,
        statsSourceKind: true,
        assignedAt: true,
        finishedAt: true,
        deadline: true,
        createdAt: true,
        currentCount: true,
        targetCount: true,
        startingCount: true,
        workerCost: true,
        workerCostCurrency: true,
        order: { select: { orderNumber: true } },
        service: { select: { name: true, metricType: true } },
        category: { select: { name: true } },
        links: { select: { id: true, url: true, label: true }, orderBy: { createdAt: "asc" } },
        statSnapshots: {
          select: { sourceId: true, subscribers: true, views: true, likes: true, comments: true, takenAt: true },
          orderBy: { takenAt: "desc" },
          take: 1,
        },
      },
      take: MAX_TASKS,
    }),
    prisma.orderItem.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);

  const byStatus = new Map(groups.map((g) => [g.status, g._count._all]));
  const counts = Object.fromEntries(
    WORKER_TASK_VIEWS.map((view) => [view, WORKER_TASK_VIEW_STATUSES[view].reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0)]),
  ) as Record<WorkerTaskView, number>;

  const all = items.map((item): WorkerTask => {
    const metricType = item.service.metricType as ServiceMetricType | null;
    const snapshot = item.statSnapshots[0];
    const channelId = metricType === "WATCH_HOURS" ? channelIdFor(item) : null;
    return {
      id: item.id,
      orderId: item.orderId,
      orderNumber: item.order.orderNumber,
      serviceName: serviceLabel(item.service.name, item.category.name),
      metricType,
      status: item.status,
      description: item.description,
      channelLink: item.channelLink,
      channelTitle: item.statsTitle,
      studioUrl: channelId ? studioAnalyticsUrl(channelId) : null,
      assignedAt: item.assignedAt,
      finishedAt: item.finishedAt,
      deadline: item.deadline,
      createdAt: item.createdAt,
      currentCount: item.currentCount,
      targetCount: item.targetCount,
      startingCount: item.startingCount,
      workerCost: item.workerCost ? item.workerCost.toString() : null,
      workerCostCurrency: item.workerCostCurrency,
      stats:
        snapshot && snapshot.sourceId === item.statsSourceId
          ? {
              subscribers: bigToNumber(snapshot.subscribers),
              views: bigToNumber(snapshot.views),
              likes: bigToNumber(snapshot.likes),
              comments: bigToNumber(snapshot.comments),
              at: snapshot.takenAt,
            }
          : null,
      links: item.links,
    };
  });

  const viewStatuses = WORKER_TASK_VIEW_STATUSES[options.view];
  const focus = options.focusId ? (all.find((task) => task.id === options.focusId) ?? null) : null;
  // The focus task joins the list only when it belongs there anyway (right tab, matches the search).
  const tasks = all.filter(
    (task) =>
      viewStatuses.includes(task.status) &&
      (task.id !== options.focusId || !options.search?.trim() || matchesLoosely(task, options.search)),
  );
  return { tasks: sortWorkerTasks(tasks), counts, focus };
}

function matchesLoosely(task: WorkerTask, search: string): boolean {
  const q = search.trim().toLowerCase().replace(/^#/, "");
  return [task.serviceName, task.channelLink, task.channelTitle, task.description, String(task.orderNumber)].some((v) =>
    v?.toLowerCase().includes(q),
  );
}
