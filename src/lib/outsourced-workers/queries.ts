import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Read queries for outsourced workers — third parties with no application
 * account, tracked only as a cost-tracking contact for Order Items. See
 * `prisma/schema/orders.prisma`'s `OutsourcedWorker` doc comment.
 */

export type OutsourcedWorkerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  assignedItemCount: number;
};

export async function listOutsourcedWorkers(options: {
  includeInactive?: boolean;
} = {}): Promise<OutsourcedWorkerRow[]> {
  const workers = await prisma.outsourcedWorker.findMany({
    where: options.includeInactive ? {} : { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      _count: { select: { orderItems: true } },
    },
    orderBy: { name: "asc" },
  });

  return workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    email: worker.email,
    phone: worker.phone,
    isActive: worker.isActive,
    assignedItemCount: worker._count.orderItems,
  }));
}

/** id/name only, active only — for the worker picker on an Order Item. */
export async function listAssignableOutsourcedWorkers(): Promise<
  Array<{ id: string; name: string }>
> {
  return prisma.outsourcedWorker.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type OutsourcedWorkerDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  notes: string | null;
  isActive: boolean;
  assignedItemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function getOutsourcedWorkerDetail(id: string): Promise<OutsourcedWorkerDetail | null> {
  const worker = await prisma.outsourcedWorker.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsappNumber: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { orderItems: true } },
    },
  });

  if (!worker) return null;

  return {
    id: worker.id,
    name: worker.name,
    email: worker.email,
    phone: worker.phone,
    whatsappNumber: worker.whatsappNumber,
    notes: worker.notes,
    isActive: worker.isActive,
    assignedItemCount: worker._count.orderItems,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
}
