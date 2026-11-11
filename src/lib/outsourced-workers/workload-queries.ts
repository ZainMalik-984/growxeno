import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { ServiceMetricType } from "@/lib/services/metric-type";
import { EMPTY_WORKLOAD, summarizeWorkloads, type Workload } from "./workload";

/**
 * Current workload for the given outsourced workers (all active ones when no
 * ids are given): their pending, processing and refill tasks, summed per unit.
 * One flat query. See workload.ts.
 */
export async function getWorkloads(outsourcedWorkerIds?: readonly string[]): Promise<Map<string, Workload>> {
  if (outsourcedWorkerIds && outsourcedWorkerIds.length === 0) return new Map();
  const items = await prisma.orderItem.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING", "REFILL"] },
      outsourcedWorkerId: outsourcedWorkerIds ? { in: [...outsourcedWorkerIds] } : { not: null },
    },
    select: {
      outsourcedWorkerId: true,
      status: true,
      startingCount: true,
      currentCount: true,
      targetCount: true,
      service: { select: { metricType: true } },
    },
  });
  return summarizeWorkloads(
    items.map((item) => ({
      outsourcedWorkerId: item.outsourcedWorkerId!,
      status: item.status as "PENDING" | "PROCESSING" | "REFILL",
      metricType: item.service.metricType as ServiceMetricType | null,
      startingCount: item.startingCount,
      currentCount: item.currentCount,
      targetCount: item.targetCount,
    })),
  );
}

export async function getWorkload(outsourcedWorkerId: string): Promise<Workload> {
  return (await getWorkloads([outsourcedWorkerId])).get(outsourcedWorkerId) ?? EMPTY_WORKLOAD;
}
