import { fail, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import type { Actions, PageServerLoad } from "./$types";
import {
  createAdministrator,
  listAdministrators,
  resetAdministratorPassword,
  setAdministratorDisabled,
} from "$lib/server/administrators";
import { createPrisma } from "$lib/server/db";
import { requireEnv } from "$lib/server/platform";
import {
  administratorToggleSchema,
  newAdministratorSchema,
  passwordResetSchema,
} from "$lib/validation";

export const load: PageServerLoad = async (event) => {
  const env = requireEnv(event);
  const prisma = createPrisma(env.DB);
  try {
    return {
      administrators: await listAdministrators(prisma),
      currentAdministratorId: event.locals.administratorId,
    };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
};

function parse<T>(schema: v.GenericSchema<unknown, T>, data: FormData): T | null {
  try {
    return v.parse(schema, Object.fromEntries(data));
  } catch (cause) {
    if (cause instanceof v.ValiError) return null;
    throw cause;
  }
}

export const actions: Actions = {
  create: async (event) => {
    if (!event.locals.administratorId) throw redirect(302, "/login");
    const input = parse(newAdministratorSchema, await event.request.formData());
    if (!input) return fail(400, { action: "create", error: "Invalid administrator details" });

    const env = requireEnv(event);
    const prisma = createPrisma(env.DB);
    try {
      const result = await createAdministrator(prisma, input);
      if (!result.ok) return fail(409, { action: "create", error: result.message });
      return { success: true, message: `Administrator ${input.email} created.` };
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  },

  reset: async (event) => {
    if (!event.locals.administratorId) throw redirect(302, "/login");
    const input = parse(passwordResetSchema, await event.request.formData());
    if (!input) return fail(400, { action: "reset", error: "Invalid password" });

    const env = requireEnv(event);
    const prisma = createPrisma(env.DB);
    try {
      const result = await resetAdministratorPassword(prisma, input.id, input.password);
      if (!result.ok) return fail(404, { action: "reset", error: result.message });
      return { success: true, message: "Password reset." };
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  },

  toggle: async (event) => {
    if (!event.locals.administratorId) throw redirect(302, "/login");
    const input = parse(administratorToggleSchema, await event.request.formData());
    if (!input) return fail(400, { action: "toggle", error: "Invalid request" });

    const env = requireEnv(event);
    const prisma = createPrisma(env.DB);
    try {
      const result = await setAdministratorDisabled(prisma, input.id, input.disabled);
      if (!result.ok) return fail(409, { action: "toggle", error: result.message });
      return {
        success: true,
        message: input.disabled ? "Administrator disabled." : "Administrator enabled.",
      };
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  },
};
