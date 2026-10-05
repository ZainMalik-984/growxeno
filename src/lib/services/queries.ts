import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { ServiceMetricType } from "./metric-type";

/**
 * Read queries for services (specification Section 50).
 *
 * `basePrice` is serialised to a string at this boundary — `Prisma.Decimal` is
 * not serialisable across the Server -> Client Component boundary (see
 * docs/ARCHITECTURE.md §2.4).
 */

export const SERVICES_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type ServiceListRow = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  basePrice: string | null;
  currency: string;
  metricType: ServiceMetricType | null;
  isActive: boolean;
};

export type ServiceListResult = {
  rows: ServiceListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function listServices(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  includeInactive?: boolean;
}): Promise<ServiceListResult> {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(options.pageSize ?? SERVICES_PAGE_SIZE)),
  );
  const search = options.search?.trim();

  const where = {
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [total, services] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      select: {
        id: true,
        name: true,
        basePrice: true,
        currency: true,
        metricType: true,
        isActive: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: services.map((service) => ({
      id: service.id,
      name: service.name,
      categoryId: service.category.id,
      categoryName: service.category.name,
      basePrice: service.basePrice ? service.basePrice.toString() : null,
      currency: service.currency,
      metricType: service.metricType,
      isActive: service.isActive,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type ServiceDetail = {
  id: string;
  name: string;
  description: string | null;
  basePrice: string | null;
  currency: string;
  metricType: ServiceMetricType | null;
  isActive: boolean;
  category: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export async function getServiceDetail(serviceId: string): Promise<ServiceDetail | null> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      currency: true,
      metricType: true,
      isActive: true,
      category: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!service) return null;

  return {
    id: service.id,
    name: service.name,
    description: service.description,
    basePrice: service.basePrice ? service.basePrice.toString() : null,
    currency: service.currency,
    metricType: service.metricType,
    isActive: service.isActive,
    category: service.category,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

/** All active services, for pickers. */
export async function listAssignableServices(): Promise<
  Array<{ id: string; name: string; categoryName: string }>
> {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return services.map((service) => ({
    id: service.id,
    name: service.name,
    categoryName: service.category.name,
  }));
}

export type ServicePickerRow = {
  id: string;
  name: string;
  categoryName: string;
  basePrice: string | null;
  currency: string;
  /** Drives which structured fields the Order Item form shows — see src/lib/services/metric-type.ts. */
  metricType: ServiceMetricType | null;
};

/** All active services, for the Order Item picker. */
export async function listServicesForOrderPicker(): Promise<ServicePickerRow[]> {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      basePrice: true,
      currency: true,
      metricType: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return services.map((service) => ({
    id: service.id,
    name: service.name,
    categoryName: service.category.name,
    basePrice: service.basePrice ? service.basePrice.toString() : null,
    currency: service.currency,
    metricType: service.metricType,
  }));
}
