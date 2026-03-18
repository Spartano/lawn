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
import { Link2, Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react";

type ImportStatus = "idle" | "importing" | "success" | "error";

interface ImportVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
}

export function ImportVideoDialog({
  open,
  onOpenChange,
  projectId,
}: ImportVideoDialogProps) {
  const importFromUrl = useAction(api.importActions.importFromUrl);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const reset = useCallback(() => {
    setUrl("");
    setTitle("");
    setStatus("idle");
    setErrorMessage("");
  }, []);

  const isBusy = status === "importing";

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[#1a1a1a] font-black tracking-tight">
            Import video
          </DialogTitle>
          <DialogDescription className="text-[#888]">
            Paste an Instagram reel link or a direct .mp4 URL. The video will be
            downloaded and processed on our server.
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
              <span>Video imported — processing will begin shortly.</span>
            </div>
          )}

          {isBusy && (
            <div className="flex items-center gap-2 text-sm text-[#888]">
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>Importing...</span>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={() => void handleImport()}
              disabled={!url.trim() || isBusy || status === "success"}
              className="border-2 border-[#1a1a1a] bg-[#1a1a1a] text-[#f0f0e8] hover:bg-[#333] gap-1.5 w-full justify-center"
            >
              <Upload className="h-4 w-4" />
              Import
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
