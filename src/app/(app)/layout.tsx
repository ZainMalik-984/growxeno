import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { requireActor } from "@/lib/auth/authorize";
import { getNavigationFor } from "@/lib/navigation/nav-tree";
import { getUnreadNotificationCount, listNotifications } from "@/lib/notifications/queries";

/**
 * Every route beneath this layout is per-user and must never be prerendered.
 *
 * This is not belt-and-braces: without it, a build run on a machine with no
 * Supabase environment (CI, a fresh clone) resolves the actor to null WITHOUT
 * ever reading cookies, so Next.js sees no dynamic API, marks these pages
 * static, and bakes the "redirect to /login" result into the output — which
 * would then be served to signed-in users in production.
 *
 * Segment config on a layout applies to every segment below it.
 */
export const dynamic = "force-dynamic";

/**
 * Authenticated application shell.
 *
 * Resolves the actor once (the resolution is request-memoised, so the pages
 * below reuse it rather than querying again) and renders the navigation that
 * this particular person is allowed to see.
 *
 * The filtered sidebar is a convenience. Every page inside this layout still
 * performs its own `requirePermission` check.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requireActor();
  const sections = getNavigationFor(actor.permissions);
  const [unreadCount, recentNotifications] = await Promise.all([
    getUnreadNotificationCount(actor.user.id),
    listNotifications(actor.user.id, { limit: 8 }),
  ]);

  return (
    <div className="min-h-dvh">
      <Sidebar sections={sections} />

      <div className="lg:pl-sidebar">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-line px-6 lg:px-gutter">
          <GlobalSearch />
          <NotificationBell
            initialUnreadCount={unreadCount}
            items={recentNotifications.map((n) => ({
              id: n.id,
              title: n.title,
              message: n.message,
              isRead: n.isRead,
              actionUrl: n.actionUrl,
              createdAt: n.createdAt.toISOString(),
            }))}
          />
          <UserMenu
            fullName={actor.user.displayName ?? actor.user.fullName}
            email={actor.user.email}
            roleNames={actor.user.roleNames}
          />
        </header>

        <main className="px-6 py-8 lg:px-gutter lg:py-10">{children}</main>
      </div>
    </div>
  );
}
