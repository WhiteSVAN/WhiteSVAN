/** In-app notifications (inbox activity). Best-effort: a failure never blocks the action. */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface NotifyOptions {
  /**
   * Collapse into an existing *unread* notification with the same kind + href
   * (refreshing its title and time) instead of adding another row — keeps a
   * busy conversation from flooding the inbox.
   */
  collapse?: boolean;
}

export async function notify(
  userId: string,
  kind: string,
  title: string,
  href?: string,
  options: NotifyOptions = {},
) {
  const safeTitle = title.slice(0, 200);
  try {
    if (options.collapse && href) {
      const existing = await prisma.appNotification.findFirst({
        where: { userId, kind, href, readAt: null },
        select: { id: true },
      });
      if (existing) {
        await prisma.appNotification.update({
          where: { id: existing.id },
          data: { title: safeTitle, createdAt: new Date() },
        });
        return;
      }
    }
    await prisma.appNotification.create({ data: { userId, kind, title: safeTitle, href } });
  } catch (error) {
    logger.warn("notify.failed", { userId, kind, error: String(error) });
  }
}

export function unreadCount(userId: string) {
  return prisma.appNotification.count({ where: { userId, readAt: null } });
}

/**
 * Mark a user's unread notifications as read. Always scoped to `userId` (the
 * caller passes the session user). `before` limits it to what the user has
 * actually seen; `href` limits it to one destination (e.g. a single thread).
 * Returns how many rows changed.
 */
export async function markNotificationsRead(
  userId: string,
  filter: { before?: Date; href?: string } = {},
): Promise<number> {
  const { count } = await prisma.appNotification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(filter.before ? { createdAt: { lte: filter.before } } : {}),
      ...(filter.href ? { href: filter.href } : {}),
    },
    data: { readAt: new Date() },
  });
  return count;
}
