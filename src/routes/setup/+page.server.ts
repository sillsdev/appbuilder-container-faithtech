import { fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { createFirstAdministrator, hasUsableAdministrator } from "$lib/server/administrators";
import { createPrisma } from "$lib/server/db";
import { requireEnv } from "$lib/server/platform";
import { newAdministratorSchema } from "$lib/validation";

export const load: PageServerLoad = async (event) => {
  const env = requireEnv(event);
  const prisma = createPrisma(env.DB);
  try {
    if (await hasUsableAdministrator(prisma)) {
      // Setup is a first-run-only flow; once an admin exists it is closed.
      throw redirect(302, "/login");
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
  return { form: await superValidate(valibot(newAdministratorSchema)) };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event.request, valibot(newAdministratorSchema));
    if (!form.valid) return fail(400, { form });

    const env = requireEnv(event);
    const prisma = createPrisma(env.DB);
    try {
      const result = await createFirstAdministrator(prisma, {
        email: form.data.email,
        password: form.data.password,
        displayName: form.data.displayName,
      });
      if (!result.ok) {
        return message(form, result.message, { status: 409 });
      }
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
    throw redirect(303, "/login");
  },
};
