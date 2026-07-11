import * as v from "valibot";

export const packageStatuses = [
  "PENDING",
  "ACTIVE",
  "REJECTED",
  "INACTIVE",
] as const;

export type PackageStatus = (typeof packageStatuses)[number];

export const credentialsSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(320)),
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(1_000)),
});

// A settable administrator password. Minimum length is enforced here (unlike
// the login credential, which only checks presence) so weak passwords cannot
// be created through the setup or management UI.
const administratorPassword = v.pipe(
  v.string(),
  v.minLength(8, "Password must be at least 8 characters"),
  v.maxLength(1_000),
);

export const newAdministratorSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(320)),
  displayName: v.optional(
    v.pipe(v.string(), v.trim(), v.maxLength(200)),
  ),
  password: administratorPassword,
});

export const passwordResetSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  password: administratorPassword,
});

export const administratorToggleSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  disabled: v.pipe(
    v.union([v.string(), v.boolean()]),
    v.transform((value) => value === true || value === "true"),
    v.boolean(),
  ),
});

const reasonSchema = v.optional(
  v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2_000)),
);

export const moderationSchema = v.object({
  status: v.picklist(packageStatuses),
  reason: reasonSchema,
});

export const moderationActionSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  status: v.picklist(packageStatuses),
  reason: reasonSchema,
});

export const searchSchema = v.object({
  q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
  limit: v.optional(
    v.pipe(
      v.union([v.string(), v.number()]),
      v.transform(Number),
      v.number(),
      v.integer(),
      v.minValue(1),
      v.maxValue(100),
    ),
    25,
  ),
});
