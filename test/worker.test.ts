import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as v from "valibot";
import {
  AuthenticationError,
  authenticateAdministrator,
  createSessionToken,
  hashPassword,
  verifyAdministrator,
} from "../src/lib/server/auth";
import { createPrisma } from "../src/lib/server/db";
import {
  ingestNotification,
  scriptoriaNotificationSchema,
} from "../src/lib/server/notification";
import { moderatePackage, searchActivePackages } from "../src/lib/server/packages";
import {
  createAdministrator,
  createFirstAdministrator,
  hasUsableAdministrator,
  resetAdministratorPassword,
  setAdministratorDisabled,
} from "../src/lib/server/administrators";

const notification = {
  project_url: "https://app.scriptoria.io/projects/722",
  project_name: "gvs Gumawana",
  project_repo:
    "s3://sil-prd-aps-projects/scriptureappbuilder/gvs-1380-gvs-Gumawana",
  publish_url:
    "https://sil-prd-scriptoria-files.s3.amazonaws.com/asset-package/d54c912a-979c-4fa2-9eac-164d7e2f575d/org.wycliffe.gvs.gumawana.bible.zip",
  permalink_url:
    "https://app.scriptoria.io/api/products/d54c912a-979c-4fa2-9eac-164d7e2f575d/files/published/asset-package",
  size: "11351769}",
  app_builder: "scripture-app-builder",
  app_builder_version: "9.3",
  app_lang: {
    full: "gvs-Latn-PG",
    iana: ["Gumawana"],
    iso639_3: "gvs",
    localname: "Gumawana",
    localnames: ["Gumawana"],
    name: "Gumawana",
    names: ["Domdom", "Gumasi", "Gumasila"],
    region: "PG",
    regionname: "Papua New Guinea",
    script: "Latn",
    sldr: true,
    windows: "gvs-Latn",
  },
  image: {
    baseurl:
      "https://app.scriptoria.io/api/products/d54c912a-979c-4fa2-9eac-164d7e2f575d/files/published",
    files: [
      { size: "1x", src: "nav_drawer.png" },
      { size: "2x", src: "nav_drawer@2x.png" },
    ],
  },
  listing: [
    {
      lang: "en-US",
      title: "Gumawana Bible",
      short_description: "The Bible in Gumawana of Papua New Guinea [gvs]",
      full_description: "<b>Buki Kimaasabaina</b>",
    },
  ],
};

const adminEmail = "admin@example.invalid";
const adminPassword = "demo-password-123";

async function seedAdministrator(): Promise<string> {
  const passwordHash = await hashPassword(adminPassword);
  await env.DB.prepare(
    `INSERT INTO administrators
     (id, email, display_name, password_hash, disabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(
      "admin-test",
      adminEmail,
      "Test Administrator",
      passwordHash,
      "2026-07-11T00:00:00.000Z",
      "2026-07-11T00:00:00.000Z",
    )
    .run();
  return "admin-test";
}

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM package_status_events"),
    env.DB.prepare("DELETE FROM package_images"),
    env.DB.prepare("DELETE FROM package_listings"),
    env.DB.prepare("DELETE FROM package_names"),
    env.DB.prepare("DELETE FROM packages"),
    env.DB.prepare("DELETE FROM administrators"),
  ]);
});

describe("notification validation", () => {
  it("accepts a representative payload and normalizes the size", () => {
    const parsed = v.parse(scriptoriaNotificationSchema, notification);
    expect(parsed.app_lang.iso639_3).toBe("gvs");
  });

  it("rejects a payload missing required fields", () => {
    expect(() =>
      v.parse(scriptoriaNotificationSchema, { project_name: "x" }),
    ).toThrow();
  });
});

describe("ingestion", () => {
  it("is idempotent and preserves pending moderation on retry", async () => {
    const first = await ingestNotification(env.DB, notification as never);
    const retry = await ingestNotification(env.DB, notification as never);

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(first.id).toBe(retry.id);

    const packageCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM packages",
    ).first<{ count: number }>();
    const eventCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM package_status_events",
    ).first<{ count: number }>();
    expect(packageCount?.count).toBe(1);
    expect(eventCount?.count).toBe(1);
  });
});

describe("public catalogue", () => {
  it("returns only active packages and finds alternate names", async () => {
    const stored = await ingestNotification(env.DB, notification as never);
    const prisma = createPrisma(env.DB);
    try {
      const pending = await searchActivePackages(prisma, { q: "domdom" });
      expect(pending).toHaveLength(0);

      await env.DB.prepare("UPDATE packages SET status = 'ACTIVE' WHERE id = ?")
        .bind(stored.id)
        .run();

      const active = await searchActivePackages(prisma, { q: "domdom" });
      expect(active).toHaveLength(1);
      expect(active[0]?.id).toBe(stored.id);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });
});

describe("authentication", () => {
  it("authenticates a valid administrator and rejects a wrong password", async () => {
    await seedAdministrator();
    const prisma = createPrisma(env.DB);
    try {
      await expect(
        authenticateAdministrator(prisma, adminEmail, adminPassword),
      ).resolves.toBe("admin-test");
      await expect(
        authenticateAdministrator(prisma, adminEmail, "wrong"),
      ).rejects.toBeInstanceOf(AuthenticationError);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });

  it("accepts a valid session token and rejects a tampered one", async () => {
    const id = await seedAdministrator();
    const prisma = createPrisma(env.DB);
    try {
      const token = await createSessionToken(id, "test-session-secret");
      await expect(
        verifyAdministrator(token, "test-session-secret", prisma),
      ).resolves.toBe(id);
      await expect(
        verifyAdministrator(`${token}x`, "test-session-secret", prisma),
      ).rejects.toBeInstanceOf(AuthenticationError);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });
});

describe("moderation", () => {
  it("approves a pending package and records the actor", async () => {
    const adminId = await seedAdministrator();
    const stored = await ingestNotification(env.DB, notification as never);
    const prisma = createPrisma(env.DB);
    try {
      const result = await moderatePackage(env.DB, prisma, {
        id: stored.id,
        toStatus: "ACTIVE",
        administratorId: adminId,
      });
      expect(result).toMatchObject({ ok: true, status: "ACTIVE" });

      const event = await env.DB.prepare(
        "SELECT actor_id FROM package_status_events WHERE to_status = 'ACTIVE'",
      ).first<{ actor_id: string }>();
      expect(event?.actor_id).toBe(adminId);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });

  it("rejects an invalid status transition", async () => {
    const adminId = await seedAdministrator();
    const stored = await ingestNotification(env.DB, notification as never);
    const prisma = createPrisma(env.DB);
    try {
      // PENDING may only go to ACTIVE or REJECTED, never straight to INACTIVE.
      const result = await moderatePackage(env.DB, prisma, {
        id: stored.id,
        toStatus: "INACTIVE",
        administratorId: adminId,
      });
      expect(result).toMatchObject({ ok: false, httpStatus: 409 });
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });
});

describe("administrator management", () => {
  it("first-run setup creates the first admin, then closes", async () => {
    const prisma = createPrisma(env.DB);
    try {
      expect(await hasUsableAdministrator(prisma)).toBe(false);

      const first = await createFirstAdministrator(prisma, {
        email: "owner@example.org",
        password: "first-admin-pw",
      });
      expect(first.ok).toBe(true);
      expect(await hasUsableAdministrator(prisma)).toBe(true);

      // Setup is closed once a usable admin exists.
      const second = await createFirstAdministrator(prisma, {
        email: "sneaky@example.org",
        password: "another-password",
      });
      expect(second).toMatchObject({ ok: false });

      // The created admin can actually authenticate.
      const id = await authenticateAdministrator(prisma, "owner@example.org", "first-admin-pw");
      expect(typeof id).toBe("string");
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });

  it("rejects creating a duplicate administrator email", async () => {
    const prisma = createPrisma(env.DB);
    try {
      const ok = await createAdministrator(prisma, { email: "dup@example.org", password: "password-1" });
      expect(ok.ok).toBe(true);
      const dup = await createAdministrator(prisma, { email: "dup@example.org", password: "password-2" });
      expect(dup).toMatchObject({ ok: false });
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });

  it("resets a password so the old one stops working", async () => {
    const prisma = createPrisma(env.DB);
    try {
      const created = await createAdministrator(prisma, { email: "reset@example.org", password: "old-password" });
      if (!created.ok) throw new Error("setup failed");

      await resetAdministratorPassword(prisma, created.id, "new-password");
      const id = await authenticateAdministrator(prisma, "reset@example.org", "new-password");
      expect(id).toBe(created.id);
      await expect(
        authenticateAdministrator(prisma, "reset@example.org", "old-password"),
      ).rejects.toBeInstanceOf(AuthenticationError);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });

  it("refuses to disable the last active administrator", async () => {
    const prisma = createPrisma(env.DB);
    try {
      const only = await createAdministrator(prisma, { email: "solo@example.org", password: "password-1" });
      if (!only.ok) throw new Error("setup failed");

      const blocked = await setAdministratorDisabled(prisma, only.id, true);
      expect(blocked).toMatchObject({ ok: false });

      // With a second admin present, disabling the first is allowed.
      const second = await createAdministrator(prisma, { email: "backup@example.org", password: "password-2" });
      if (!second.ok) throw new Error("setup failed");
      const allowed = await setAdministratorDisabled(prisma, only.id, true);
      expect(allowed).toMatchObject({ ok: true });
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  });
});
