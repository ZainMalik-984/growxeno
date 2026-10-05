import {
  Activity,
  Banknote,
  Bell,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Gauge,
  KeyRound,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Settings,
  ShieldCheck,
  Store,
  Tag,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type { NavIconName } from "@/lib/navigation/nav-tree";

/**
 * Maps the serialisable icon keys used in the navigation tree to Lucide
 * components.
 *
 * The tree is built on the server and handed to a Client Component, and React
 * components cannot cross that boundary, so the tree stores a string and this
 * module — which is only ever imported by client code — resolves it.
 */
export const NAV_ICONS: Record<NavIconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  dashboard: LayoutDashboard,
  bell: Bell,
  activity: Activity,
  orders: ClipboardList,
  customers: UserRound,
  fiverr: Store,
  workers: Users,
  stats: CalendarDays,
  performance: Gauge,
  payments: Banknote,
  services: Package,
  categories: Tag,
  finance: Wallet,
  communication: MessagesSquare,
  reports: ChartColumn,
  users: Users,
  roles: ShieldCheck,
  permissions: KeyRound,
  settings: Settings,
};

export const FALLBACK_NAV_ICON = Layers;
