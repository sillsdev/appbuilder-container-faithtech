import { hashPassword } from "./auth";
import type { DatabaseClient } from "./db";

export type AdministratorSummary = {
  id: string;
  email: string;
  displayName: string | null;
  disabled: boolean;
  createdAt: Date;
};

type Result<T = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

/**
 * A "usable" administrator is one whose password hash is a real credential
 * (the app hash format), as opposed to the seed placeholder. This gates the
 * first-run setup flow: setup stays open until a real administrator exists,
 * and locks afterward, so it is never an open admin-creation endpoint.
 */
export async function hasUsableAdministrator(
  prisma: DatabaseClient,
): Promise<boolean> {
  const count = await prisma.administrator.count({
    where: { passwordHash: { startsWith: "pbkdf2$" }, disabled: false },
  });
  return count > 0;
}

export async function listAdministrators(
  prisma: DatabaseClient,
): Promise<AdministratorSummary[]> {
  return prisma.administrator.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      disabled: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Create a new administrator. Fails (rather than overwriting) if the email is
 * already taken — resetting a password is a separate, explicit action.
 */
export async function createAdministrator(
  prisma: DatabaseClient,
  input: { email: string; password: string; displayName?: string },
): Promise<Result<{ id: string }>> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.administrator.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "An administrator with that email already exists" };
  }
  const created = await prisma.administrator.create({
    data: {
      email,
      displayName: input.displayName?.trim() || null,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

/**
 * First-run creation of the very first administrator. Refuses once a real
 * administrator exists. Upserts by email so it also converts the seed
 * placeholder row into a usable account if that email is reused.
 */
export async function createFirstAdministrator(
  prisma: DatabaseClient,
  input: { email: string; password: string; displayName?: string },
): Promise<Result<{ id: string }>> {
  if (await hasUsableAdministrator(prisma)) {
    return { ok: false, message: "Setup has already been completed" };
  }
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const displayName = input.displayName?.trim() || null;
  const admin = await prisma.administrator.upsert({
    where: { email },
    update: { passwordHash, displayName, disabled: false },
    create: { email, displayName, passwordHash },
    select: { id: true },
  });
  return { ok: true, id: admin.id };
}

export async function resetAdministratorPassword(
  prisma: DatabaseClient,
  id: string,
  password: string,
): Promise<Result> {
  const admin = await prisma.administrator.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!admin) return { ok: false, message: "Administrator not found" };
  await prisma.administrator.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });
  return { ok: true };
}

/**
 * Enable or disable an administrator. Refuses to disable the last remaining
 * usable administrator, so an operator cannot lock everyone out.
 */
export async function setAdministratorDisabled(
  prisma: DatabaseClient,
  id: string,
  disabled: boolean,
): Promise<Result> {
  const admin = await prisma.administrator.findUnique({
    where: { id },
    select: { id: true, disabled: true, passwordHash: true },
  });
  if (!admin) return { ok: false, message: "Administrator not found" };

  if (disabled && !admin.disabled) {
    const otherUsable = await prisma.administrator.count({
      where: {
        id: { not: id },
        disabled: false,
        passwordHash: { startsWith: "pbkdf2$" },
      },
    });
    if (otherUsable === 0) {
      return { ok: false, message: "Cannot disable the last active administrator" };
    }
  }

  await prisma.administrator.update({ where: { id }, data: { disabled } });
  return { ok: true };
}
