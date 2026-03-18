"use client";

import { useState, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
} from "lucide-react";

type ImportStatus =
  | "idle"
  | "importing"
  | "resolving"
  | "resolved"
  | "downloading"
  | "success"
  | "error";

interface ImportVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  onFilesSelected?: (files: File[]) => void;
}

export function ImportVideoDialog({
  open,
  onOpenChange,
  projectId,
  onFilesSelected,
}: ImportVideoDialogProps) {
  const importFromUrl = useAction(api.importActions.importFromUrl);
  const resolveVideoUrl = useAction(api.importActions.resolveVideoUrl);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState("");

  const reset = useCallback(() => {
    setUrl("");
    setTitle("");
    setStatus("idle");
    setErrorMessage("");
    setResolvedVideoUrl("");
  }, []);

  const isBusy =
    status === "importing" ||
    status === "resolving" ||
    status === "downloading";

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isBusy) return;
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, isBusy],
  );

  const handleImport = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setStatus("importing");
    setErrorMessage("");

    try {
      await importFromUrl({
        projectId,
        url: trimmedUrl,
        title: title.trim() || undefined,
      });
      setStatus("success");
      setTimeout(() => {
        handleOpenChange(false);
      }, 1500);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Import failed");
    }
  }, [url, title, projectId, importFromUrl, handleOpenChange]);

  const handleResolveLink = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setStatus("resolving");
    setErrorMessage("");
    setResolvedVideoUrl("");

    try {
      // For Instagram URLs, try the local dev proxy first (runs on your machine,
      // avoids cloud IP blocking). Falls back to Convex for non-Instagram URLs
      // or if the proxy isn't available (production).
      const isInstagram = /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\//.test(trimmedUrl);
      let videoUrl: string;

      if (isInstagram) {
        const proxyResp = await fetch(
          `/api/instagram-embed?url=${encodeURIComponent(trimmedUrl)}`,
        );
        const data = await proxyResp.json();
        if (!proxyResp.ok || !data.videoUrl) {
          throw new Error(data.error ?? "Could not resolve video URL");
        }
        videoUrl = data.videoUrl;
      } else {
        const result = await resolveVideoUrl({ url: trimmedUrl });
        videoUrl = result.videoUrl;
      }

      setResolvedVideoUrl(videoUrl);
      setStatus("resolved");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Could not resolve video URL",
      );
    }
  }, [url, resolveVideoUrl]);

  const handleDownloadLocal = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setStatus("resolving");
    setErrorMessage("");

    try {
      const { videoUrl } = await resolveVideoUrl({ url: trimmedUrl });

      setStatus("downloading");

      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      const file = new File(
        [blob],
        title.trim() ? `${title.trim()}.mp4` : "imported-video.mp4",
        { type: blob.type || "video/mp4" },
      );

      if (onFilesSelected) {
        onFilesSelected([file]);
        setStatus("success");
        setTimeout(() => {
          handleOpenChange(false);
        }, 1500);
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        setStatus("success");
        setTimeout(() => {
          handleOpenChange(false);
        }, 1500);
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Download failed");
    }
  }, [url, title, resolveVideoUrl, onFilesSelected, handleOpenChange]);

  const statusLabel =
    status === "importing"
      ? "Importing via server..."
      : status === "resolving"
        ? "Resolving video URL..."
        : status === "downloading"
          ? "Downloading in browser..."
          : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[#1a1a1a] font-black tracking-tight">
            Import video
          </DialogTitle>
          <DialogDescription className="text-[#888]">
            Paste an Instagram reel link or a direct link to any .mp4 file. Use
            {" "}<strong className="text-[#1a1a1a] font-semibold">Download & upload</strong> to
            fetch the video in your browser and upload it through the normal pipeline (no size limit).
            {" "}<strong className="text-[#1a1a1a] font-semibold">Import (server)</strong> downloads
            and processes entirely on our server — faster, but limited to 100 MB.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="import-url"
              className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider"
            >
              Video URL
            </label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888]" />
              <Input
                id="import-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/..."
                disabled={isBusy}
                className="pl-9 border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] placeholder:text-[#aaa]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim()) {
                    void handleImport();
                  }
                }}
                autoFocus
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="import-title"
              className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider"
            >
              Title <span className="font-normal text-[#888]">(optional)</span>
            </label>
            <Input
              id="import-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My imported video"
              disabled={isBusy}
              className="border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] placeholder:text-[#aaa]"
            />
          </div>

          {status === "error" && (
            <div className="flex items-start gap-2 rounded border-2 border-[#dc2626]/30 bg-[#dc2626]/5 px-3 py-2.5 text-sm text-[#dc2626]">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center gap-2 rounded border-2 border-[#2d5a2d]/30 bg-[#2d5a2d]/5 px-3 py-2.5 text-sm text-[#2d5a2d]">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>
                {onFilesSelected
                  ? "Video downloaded — uploading now."
                  : "Video imported — processing will begin shortly."}
              </span>
            </div>
          )}

          {status === "resolved" && resolvedVideoUrl && (
            <div className="flex flex-col gap-2 rounded border-2 border-[#2d5a2d] bg-[#2d5a2d]/5 px-4 py-3">
              <span className="text-xs font-semibold text-[#2d5a2d] uppercase tracking-wider">
                Direct video link
              </span>
              <a
                href={resolvedVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#1a1a1a] underline underline-offset-2 break-all font-mono leading-relaxed hover:text-[#2d5a2d]"
              >
                {resolvedVideoUrl.length > 120
                  ? resolvedVideoUrl.substring(0, 120) + "…"
                  : resolvedVideoUrl}
              </a>
              <span className="text-xs text-[#888]">
                Right-click &rarr; Save link as, or click to open and save from there.
              </span>
            </div>
          )}

          {isBusy && statusLabel && (
            <div className="flex items-center gap-2 text-sm text-[#888]">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>{statusLabel}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={() => void handleResolveLink()}
              disabled={!url.trim() || isBusy || status === "success" || status === "resolved"}
              className="border-2 border-[#2d5a2d] bg-[#2d5a2d] text-[#f0f0e8] hover:bg-[#3a6a3a] gap-1.5 w-full justify-center"
            >
              <Link2 className="h-4 w-4" />
              Get download link
            </Button>
            <Button
              onClick={() => void handleDownloadLocal()}
              disabled={!url.trim() || isBusy || status === "success"}
              className="border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#e0e0d8] gap-1.5 w-full justify-center"
            >
              <Download className="h-4 w-4" />
              {onFilesSelected ? "Download & upload" : "Download to device"}
            </Button>
            <Button
              onClick={() => void handleImport()}
              disabled={!url.trim() || isBusy || status === "success"}
              className="border-2 border-[#1a1a1a] bg-[#1a1a1a] text-[#f0f0e8] hover:bg-[#333] gap-1.5 w-full justify-center"
            >
              <Upload className="h-4 w-4" />
              Import (server, max 100 MB)
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isBusy}
              className="border-2 border-[#1a1a1a] bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-[#f0f0e8] w-full justify-center"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
