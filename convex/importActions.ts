"use node";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { createMuxAssetFromInputUrl } from "./mux";
import { BUCKET_NAME, getS3Client } from "./s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const INSTAGRAM_URL_PATTERN = /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\//;
const MAX_IMPORT_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

function isInstagramUrl(url: string): boolean {
  return INSTAGRAM_URL_PATTERN.test(url);
}

function validateImportUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }
  return parsed;
}

async function extractInstagramVideoUrl(pageUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let html: string;
  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Instagram returned HTTP ${response.status}`);
    }

    html = await response.text();
  } catch (err: unknown) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : "unknown";
    throw new Error(`Failed to fetch Instagram page: ${msg}`);
  }

  const videoUrl = extractVideoUrlFromHtml(html);
  if (videoUrl) {
    return videoUrl;
  }

  throw new Error(
    `Could not extract video URL from Instagram. ` +
    `The post may be private or images-only.`,
  );
}

function extractVideoUrlFromHtml(html: string): string | null {
  // Instagram/Facebook CDN .mp4 URLs (URLs use \/ for slashes in JSON contexts)
  const cdnMatch = html.match(/https?:\\?\/\\?\/[^"'\s]*?(?:cdninstagram\.com|fbcdn\.net|fbcdn\.com|instagram\.com)[^"'\s]*?\.mp4[^"'\s]*/);
  if (cdnMatch) {
    return unescapeInstagramUrl(cdnMatch[0]);
  }

  // Fallback: any https .mp4 URL
  const anyMp4Match = html.match(/https?:\\?\/\\?\/[^"'\s]+\.mp4[^"'\s]*/);
  if (anyMp4Match) {
    return unescapeInstagramUrl(anyMp4Match[0]);
  }

  return null;
}

function unescapeInstagramUrl(raw: string): string {
  let url = raw;
  // Collapse doubled backslashes iteratively, then remove JSON slash escaping
  let prev = "";
  while (prev !== url) {
    prev = url;
    url = url.replace(/\\\\/g, "\\");
  }
  return url
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\u0025/g, "%");
}

async function downloadVideoToBuffer(
  videoUrl: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_IMPORT_SIZE_BYTES) {
    throw new Error("Video is too large to import (max 100 MB)");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMPORT_SIZE_BYTES) {
    throw new Error("Video is too large to import (max 100 MB)");
  }

  const rawContentType = response.headers.get("content-type") ?? "video/mp4";
  const contentType = rawContentType.split(";")[0].trim().toLowerCase();

  return { buffer: Buffer.from(arrayBuffer), contentType };
}

async function requireProjectMemberAccess(
  ctx: ActionCtx,
  projectId: Id<"projects">,
) {
  const project = await ctx.runQuery(api.projects.get, { projectId });
  if (!project || project.role === "viewer") {
    throw new Error("Requires member role or higher");
  }
  return project;
}

export const importFromUrl = action({
  args: {
    projectId: v.id("projects"),
    url: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.object({
    videoId: v.id("videos"),
  }),
  handler: async (ctx, args): Promise<{ videoId: Id<"videos"> }> => {
    await requireProjectMemberAccess(ctx, args.projectId);
    const parsedUrl = validateImportUrl(args.url);

    // Resolve the actual video download URL
    let videoDownloadUrl: string;
    let sourceLabel: string;

    if (isInstagramUrl(args.url)) {
      videoDownloadUrl = await extractInstagramVideoUrl(args.url);
      sourceLabel = "Instagram";
    } else {
      videoDownloadUrl = parsedUrl.toString();
      sourceLabel = parsedUrl.hostname;
    }

    // Download the video
    const { buffer, contentType } = await downloadVideoToBuffer(videoDownloadUrl);
    const fileSize = buffer.byteLength;

    const effectiveContentType = contentType.startsWith("video/")
      ? contentType
      : "video/mp4";

    // Derive a title
    const title =
      args.title?.trim() ||
      `Import from ${sourceLabel} — ${new Date().toLocaleDateString()}`;

    // Create the video record
    const videoId: Id<"videos"> = await ctx.runMutation(api.videos.create, {
      projectId: args.projectId,
      title,
      fileSize,
      contentType: effectiveContentType,
    });

    try {
      // Upload to S3
      const s3 = getS3Client();
      const ext = effectiveContentType === "video/quicktime" ? "mov" : "mp4";
      const key = `videos/${videoId}/${Date.now()}.${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: effectiveContentType,
        }),
      );

      // Record the S3 key on the video
      await ctx.runMutation(internal.videos.setUploadInfo, {
        videoId,
        s3Key: key,
        fileSize,
        contentType: effectiveContentType,
      });

      // Kick off Mux processing (same flow as normal uploads)
      await ctx.runMutation(internal.videos.markAsProcessing, { videoId });

      const ingestUrl = await buildSignedS3Url(key);
      const asset = await createMuxAssetFromInputUrl(videoId, ingestUrl);
      if (asset.id) {
        await ctx.runMutation(internal.videos.setMuxAssetReference, {
          videoId,
          muxAssetId: asset.id,
        });
      }
    } catch (error) {
      await ctx.runMutation(internal.videos.markAsFailed, {
        videoId,
        uploadError:
          error instanceof Error ? error.message : "Import failed",
      });
      throw error;
    }

    return { videoId };
  },
});

async function buildSignedS3Url(key: string): Promise<string> {
  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn: 60 * 60 * 24 });
}
