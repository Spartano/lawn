import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teams: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerClerkId: v.string(),
    plan: v.union(
      v.literal("basic"),
      v.literal("pro"),
      v.literal("free"),
      v.literal("team")
    ),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    billingStatus: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerClerkId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_stripe_subscription_id", ["stripeSubscriptionId"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userClerkId: v.string(),
    userEmail: v.string(),
    userName: v.string(),
    userAvatarUrl: v.optional(v.string()),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userClerkId"])
    .index("by_team_and_user", ["teamId", "userClerkId"])
    .index("by_team_and_email", ["teamId", "userEmail"]),

  teamInvites: defineTable({
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer")
    ),
    invitedByClerkId: v.string(),
    invitedByName: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"]),

  projects: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    description: v.optional(v.string()),
  }).index("by_team", ["teamId"]),

  videos: defineTable({
    projectId: v.id("projects"),
    uploadedByClerkId: v.string(),
    uploaderName: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("public"), v.literal("private")),
    publicId: v.string(),
    mediaType: v.optional(v.union(v.literal("video"), v.literal("image"))),
    // Mux video references
    muxUploadId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    muxPlaybackId: v.optional(v.string()),
    muxAssetStatus: v.optional(
      v.union(
        v.literal("preparing"),
        v.literal("ready"),
        v.literal("errored")
      )
    ),
    // Metadata
    s3Key: v.optional(v.string()),
    duration: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    contentType: v.optional(v.string()),
    uploadError: v.optional(v.string()),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    workflowStatus: v.union(
      v.literal("review"),
      v.literal("rework"),
      v.literal("done"),
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_public_id", ["publicId"])
    .index("by_mux_upload_id", ["muxUploadId"])
    .index("by_mux_asset_id", ["muxAssetId"])
    .index("by_mux_playback_id", ["muxPlaybackId"]),

  comments: defineTable({
    videoId: v.id("videos"),
    userClerkId: v.string(),
    userName: v.string(),
    userAvatarUrl: v.optional(v.string()),
    text: v.string(),
    timestampSeconds: v.number(),
    parentId: v.optional(v.id("comments")),
    resolved: v.boolean(),
  })
    .index("by_video", ["videoId"])
    .index("by_video_and_timestamp", ["videoId", "timestampSeconds"])
    .index("by_parent", ["parentId"]),

  shareLinks: defineTable({
    videoId: v.id("videos"),
    token: v.string(),
    createdByClerkId: v.string(),
    createdByName: v.string(),
    expiresAt: v.optional(v.number()),
    allowDownload: v.boolean(),
    password: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    failedAccessAttempts: v.optional(v.number()),
    lockedUntil: v.optional(v.number()),
    viewCount: v.number(),
    burnAfterReading: v.optional(v.boolean()),
    burnGraceMs: v.optional(v.number()),
    firstViewedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_video", ["videoId"]),

  shareAccessGrants: defineTable({
    shareLinkId: v.id("shareLinks"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_share_link", ["shareLinkId"]),

  intakeForms: defineTable({
    teamId: v.id("teams"),
    name: v.string(),
    slug: v.string(),
    instructions: v.string(),
    isActive: v.boolean(),
    autoSendMediaId: v.optional(v.id("videos")),
    autoSendShareOptions: v.optional(
      v.object({
        burnAfterReading: v.boolean(),
        expiresInDays: v.optional(v.number()),
        password: v.optional(v.string()),
      })
    ),
    customFields: v.array(
      v.object({
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
      })
    ),
  })
    .index("by_team", ["teamId"])
    .index("by_slug", ["slug"]),

  intakeSubmissions: defineTable({
    formId: v.id("intakeForms"),
    status: v.union(
      v.literal("chatting"),
      v.literal("qualified"),
      v.literal("rejected")
    ),
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
    aiDecision: v.optional(v.string()),
    shareLinkToken: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_form", ["formId"])
    .index("by_form_and_status", ["formId", "status"]),
});
