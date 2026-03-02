import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTeamAccess } from "./auth";

const customFieldValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("textarea"),
    v.literal("select"),
    v.literal("number")
  ),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
});

const autoSendShareOptionsValidator = v.object({
  burnAfterReading: v.boolean(),
  expiresInDays: v.optional(v.number()),
  password: v.optional(v.string()),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const create = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    slug: v.string(),
    instructions: v.string(),
    customFields: v.array(customFieldValidator),
    autoSendMediaId: v.optional(v.id("videos")),
    autoSendShareOptions: v.optional(autoSendShareOptionsValidator),
  },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId, "member");

    const normalizedSlug = slugify(args.slug);
    if (!normalizedSlug) {
      throw new Error("Slug must contain at least one alphanumeric character");
    }

    const existing = await ctx.db
      .query("intakeForms")
      .withIndex("by_slug", (q) => q.eq("slug", normalizedSlug))
      .unique();
    if (existing) {
      throw new Error("A form with this slug already exists");
    }

    return await ctx.db.insert("intakeForms", {
      teamId: args.teamId,
      name: args.name,
      slug: normalizedSlug,
      instructions: args.instructions,
      isActive: true,
      customFields: args.customFields,
      autoSendMediaId: args.autoSendMediaId,
      autoSendShareOptions: args.autoSendShareOptions,
    });
  },
});

export const update = mutation({
  args: {
    formId: v.id("intakeForms"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    instructions: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    customFields: v.optional(v.array(customFieldValidator)),
    autoSendMediaId: v.optional(v.union(v.id("videos"), v.null())),
    autoSendShareOptions: v.optional(
      v.union(autoSendShareOptionsValidator, v.null())
    ),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) throw new Error("Intake form not found");

    await requireTeamAccess(ctx, form.teamId, "member");

    const updates: Record<string, unknown> = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.instructions !== undefined) updates.instructions = args.instructions;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.customFields !== undefined) updates.customFields = args.customFields;

    if (args.autoSendMediaId !== undefined) {
      updates.autoSendMediaId = args.autoSendMediaId ?? undefined;
    }
    if (args.autoSendShareOptions !== undefined) {
      updates.autoSendShareOptions = args.autoSendShareOptions ?? undefined;
    }

    if (args.slug !== undefined) {
      const normalizedSlug = slugify(args.slug);
      if (!normalizedSlug) {
        throw new Error("Slug must contain at least one alphanumeric character");
      }
      const existing = await ctx.db
        .query("intakeForms")
        .withIndex("by_slug", (q) => q.eq("slug", normalizedSlug))
        .unique();
      if (existing && existing._id !== args.formId) {
        throw new Error("A form with this slug already exists");
      }
      updates.slug = normalizedSlug;
    }

    await ctx.db.patch(args.formId, updates);
  },
});

export const get = query({
  args: { formId: v.id("intakeForms") },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) return null;

    await requireTeamAccess(ctx, form.teamId);
    return form;
  },
});

export const list = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireTeamAccess(ctx, args.teamId);

    return await ctx.db
      .query("intakeForms")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const remove = mutation({
  args: { formId: v.id("intakeForms") },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) throw new Error("Intake form not found");

    await requireTeamAccess(ctx, form.teamId, "admin");

    const submissions = await ctx.db
      .query("intakeSubmissions")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .collect();
    for (const sub of submissions) {
      await ctx.db.delete(sub._id);
    }

    await ctx.db.delete(args.formId);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const form = await ctx.db
      .query("intakeForms")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!form || !form.isActive) return null;

    return {
      _id: form._id,
      name: form.name,
      slug: form.slug,
      customFields: form.customFields,
    };
  },
});
