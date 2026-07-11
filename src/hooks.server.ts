import type { Handle } from "@sveltejs/kit";
import { sessionCookieName, verifyAdministrator } from "$lib/server/auth";
import { createPrisma } from "$lib/server/db";

export const handle: Handle = async ({ event, resolve }) => {
  const requestId =
    event.request.headers.get("x-request-id") ?? crypto.randomUUID();
  event.locals.requestId = requestId;
  event.locals.administratorId = null;

  const sessionCookie = event.cookies.get(sessionCookieName);
  if (sessionCookie && event.platform) {
    const prisma = createPrisma(event.platform.env.DB);
    try {
      event.locals.administratorId = await verifyAdministrator(
        sessionCookie,
        event.platform.env.SESSION_SECRET,
        prisma,
      );
    } catch {
      event.locals.administratorId = null;
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  }

  const response = await resolve(event);
  response.headers.set("x-request-id", requestId);
  return response;
};
