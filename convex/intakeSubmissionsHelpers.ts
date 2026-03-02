import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireTeamAccess } from "./auth";
import { generateUniqueToken } from "./security";

export const getFormById = internalQuery({
  args: { formId: v.id("intakeForms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.formId);
  },
});

export const getSubmissionInternal = internalQuery({
  args: { submissionId: v.id("intakeSubmissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.submissionId);
  },
});

export const createSubmission = internalMutation({
  args: {
    formId: v.id("intakeForms"),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    formData: v.optional(v.any()),
    chatHistory: v.array(
      v.object({
        role: v.union(v.literal("assistant"), v.literal("user")),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("intakeSubmissions", {
      formId: args.formId,
      status: "chatting",
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      formData: args.formData,
      chatHistory: args.chatHistory,
      createdAt: args.createdAt,
    });
  },
});

export const updateSubmission = internalMutation({
  args: {
    submissionId: v.id("intakeSubmissions"),
    chatHistory: v.array(
      v.object({
        role: v.union(v.literal("assistant"), v.literal("user")),
        content: v.string(),
        timestamp: v.number(),
      })
    ),
    status: v.union(
      v.literal("chatting"),
      v.literal("qualified"),
      v.literal("rejected")
    ),
    aiDecision: v.optional(v.string()),
    shareLinkToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      chatHistory: args.chatHistory,
      status: args.status,
    };
    if (args.aiDecision !== undefined) {
      updates.aiDecision = args.aiDecision;
    }
    if (args.shareLinkToken !== undefined) {
      updates.shareLinkToken = args.shareLinkToken;
    }
    await ctx.db.patch(args.submissionId, updates);
  },
});

export const createAutoShareLink = internalMutation({
  args: {
    videoId: v.id("videos"),
    burnAfterReading: v.boolean(),
    expiresInDays: v.optional(v.number()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Media not found for auto-send");

    const token = await generateUniqueToken(
      32,
      async (candidate) =>
        (await ctx.db
          .query("shareLinks")
          .withIndex("by_token", (q) => q.eq("token", candidate))
          .unique()) !== null,
      5
    );

    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
      : undefined;

    await ctx.db.insert("shareLinks", {
      videoId: args.videoId,
      token,
      createdByClerkId: "system",
      createdByName: "Intake Bot",
      expiresAt,
      allowDownload: false,
      password: undefined,
      passwordHash: undefined,
      failedAccessAttempts: 0,
      lockedUntil: undefined,
      viewCount: 0,
      burnAfterReading: args.burnAfterReading,
      firstViewedAt: undefined,
    });

    return { token };
  },
});

export const listByForm = query({
  args: { formId: v.id("intakeForms") },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.formId);
    if (!form) return [];

    await requireTeamAccess(ctx, form.teamId);

    return await ctx.db
      .query("intakeSubmissions")
      .withIndex("by_form", (q) => q.eq("formId", args.formId))
      .order("desc")
      .collect();
  },
});

export const getSubmission = query({
  args: { submissionId: v.id("intakeSubmissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.submissionId);
  },
});
