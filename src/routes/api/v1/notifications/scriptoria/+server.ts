import { error, json, type RequestHandler } from "@sveltejs/kit";
import * as v from "valibot";
import { AuthenticationError, verifySecret } from "$lib/server/auth";
import {
  ingestNotification,
  scriptoriaNotificationSchema,
} from "$lib/server/notification";
import { requireEnv } from "$lib/server/platform";

const MAX_BODY_BYTES = 256 * 1024;

export const POST: RequestHandler = async (event) => {
  const env = requireEnv(event);

  const contentLength = Number(event.request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw error(413, "Notification payload is too large");
  }

  try {
    await verifySecret(
      event.request.headers.get("authorization") ?? undefined,
      env.SCRIPTORIA_API_KEY,
    );
  } catch (cause) {
    if (cause instanceof AuthenticationError) {
      throw error(401, cause.message);
    }
    throw cause;
  }

  let payload: unknown;
  try {
    payload = await event.request.json();
  } catch {
    throw error(400, "Request body must be valid JSON");
  }

  let notification;
  try {
    notification = v.parse(scriptoriaNotificationSchema, payload);
  } catch (cause) {
    if (cause instanceof v.ValiError) {
      throw error(400, "Invalid notification payload");
    }
    throw cause;
  }

  const stored = await ingestNotification(env.DB, notification);
  return json(
    {
      packageId: stored.id,
      scriptoriaProductId: stored.scriptoriaProductId,
      status: stored.status,
      created: stored.created,
    },
    { status: stored.created ? 201 : 200 },
  );
};
