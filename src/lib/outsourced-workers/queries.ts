import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Read queries for outsourced workers — third parties tracked as a cost-
 * tracking contact for Order Items, optionally with portal access
 * (`OutsourcedWorker.userId`, added 2026-10-08 — see its doc comment in
 * `prisma/schema/orders.prisma`).
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

export type AssignableOutsourcedWorker = {
  id: string;
  name: string;
  /** This worker's rate per service, for auto-filling cost on assignment — see `src/lib/orders/service.ts`'s `assignOrderItemWorker`. */
  rates: Array<{ serviceId: string; rate: string; currency: string }>;
};

/** Active workers, with their rates — for the worker/cost picker on an Order Item. */
export async function listAssignableOutsourcedWorkers(): Promise<AssignableOutsourcedWorker[]> {
  const workers = await prisma.outsourcedWorker.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      rates: { select: { serviceId: true, rate: true, currency: true } },
    },
    orderBy: { name: "asc" },
  });

  return workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    rates: worker.rates.map((r) => ({ serviceId: r.serviceId, rate: r.rate.toString(), currency: r.currency })),
  }));
}

export type ServiceRateRow = { serviceId: string; serviceName: string; rate: string; currency: string };

export type OutsourcedWorkerDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  notes: string | null;
  isActive: boolean;
  assignedItemCount: number;
  rates: ServiceRateRow[];
  /** Whether this worker can log in — see `OutsourcedWorkerLoginControl`. */
  hasLogin: boolean;
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
      userId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { orderItems: true } },
      rates: {
        select: { serviceId: true, rate: true, currency: true, service: { select: { name: true } } },
        orderBy: { service: { name: "asc" } },
      },
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
    rates: worker.rates.map((r) => ({ serviceId: r.serviceId, serviceName: r.service.name, rate: r.rate.toString(), currency: r.currency })),
    hasLogin: worker.userId != null,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
}
