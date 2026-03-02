"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  Lock,
  ExternalLink,
  Globe,
  Flame,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/utils";

function formatGracePeriod(ms: number | undefined): string {
  if (ms === undefined) return "tab close";
  if (ms <= 60_000) return "1 min";
  if (ms <= 30 * 60_000) return "30 min";
  if (ms <= 60 * 60_000) return "1 hr";
  if (ms <= 24 * 60 * 60_000) return "1 day";
  return "7 days";
}

interface ShareDialogProps {
  videoId: Id<"videos">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ videoId, open, onOpenChange }: ShareDialogProps) {
  const video = useQuery(api.videos.get, { videoId });
  const shareLinks = useQuery(api.shareLinks.list, { videoId });
  const createShareLink = useMutation(api.shareLinks.create);
  const deleteShareLink = useMutation(api.shareLinks.remove);
  const setVisibility = useMutation(api.videos.setVisibility);

  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [newLinkOptions, setNewLinkOptions] = useState({
    expiresInDays: undefined as number | undefined,
    password: undefined as string | undefined,
    burnAfterReading: false,
    burnGraceMs: undefined as number | undefined,
  });

  const hasActiveBurnTimer = shareLinks?.some(
    (l) => l.burnAfterReading && l.firstViewedAt && l.burnGraceMs !== undefined && !l.isExpired,
  );

  useEffect(() => {
    if (!hasActiveBurnTimer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasActiveBurnTimer]);

  const handleCreateLink = async () => {
    setIsCreating(true);
    try {
      await createShareLink({
        videoId,
        expiresInDays: newLinkOptions.expiresInDays,
        allowDownload: false,
        password: newLinkOptions.password,
        burnAfterReading: newLinkOptions.burnAfterReading || undefined,
        burnGraceMs: newLinkOptions.burnAfterReading ? newLinkOptions.burnGraceMs : undefined,
      });
      setNewLinkOptions({
        expiresInDays: undefined,
        password: undefined,
        burnAfterReading: false,
        burnGraceMs: undefined,
      });
    } catch (error) {
      console.error("Failed to create share link:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetVisibility = async (visibility: "public" | "private") => {
    if (!video || isUpdatingVisibility || video.visibility === visibility) return;
    setIsUpdatingVisibility(true);
    try {
      await setVisibility({ videoId, visibility });
    } catch (error) {
      console.error("Failed to update visibility:", error);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyPublicLink = () => {
    if (!video?.publicId) return;
    const url = `${window.location.origin}/watch/${video.publicId}`;
    navigator.clipboard.writeText(url);
    setCopiedId("public");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLink = async (linkId: Id<"shareLinks">) => {
    if (!confirm("Are you sure you want to delete this share link?")) return;
    try {
      await deleteShareLink({ linkId });
    } catch (error) {
      console.error("Failed to delete share link:", error);
    }
  };

  const publicWatchPath = video?.publicId ? `/watch/${video.publicId}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            Choose how others can access this content. Signed-in users can leave comments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-2 border-[#1a1a1a] p-4 bg-[#e8e8e0] overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#1a1a1a]">Open link</h3>
              <p className="text-xs text-[#666]">
                A permanent URL anyone can view — no password, no expiration.
              </p>
            </div>
            <Badge variant={video?.visibility === "public" ? "success" : "secondary"}>
              {video?.visibility === "public" ? "On" : "Off"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={video?.visibility === "public" ? "default" : "outline"}
              disabled={isUpdatingVisibility || video === undefined}
              onClick={() => void handleSetVisibility("public")}
            >
              <Globe className="mr-2 h-4 w-4" />
              Enable
            </Button>
            <Button
              variant={video?.visibility === "private" ? "default" : "outline"}
              disabled={isUpdatingVisibility || video === undefined}
              onClick={() => void handleSetVisibility("private")}
            >
              <Lock className="mr-2 h-4 w-4" />
              Disable
            </Button>
          </div>

          {publicWatchPath ? (
            <div className="p-3 border-2 border-[#1a1a1a] bg-[#f0f0e8] space-y-2 overflow-hidden">
              <code className="block text-sm bg-[#e8e8e0] px-2 py-1 font-mono truncate min-w-0">
                {publicWatchPath}
              </code>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handleCopyPublicLink}
                  disabled={video?.visibility !== "public"}
                >
                  {copiedId === "public" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy
                </Button>
                <Button
                  variant="outline"
                  disabled={video?.visibility !== "public"}
                  onClick={() => window.open(publicWatchPath, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 border-2 border-[#1a1a1a] p-4 bg-[#e8e8e0]">
          <h3 className="font-bold text-sm text-[#1a1a1a]">Private link</h3>
          <p className="text-xs text-[#666] -mt-2">
            Generate a unique link with password, expiration, or burn-after-reading controls.
          </p>

          <div>
            <label className="text-sm text-[#888]">Expiration</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between mt-1">
                  {newLinkOptions.expiresInDays
                    ? `${newLinkOptions.expiresInDays} days`
                    : "Never"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() =>
                    setNewLinkOptions((o) => ({ ...o, expiresInDays: undefined }))
                  }
                >
                  Never
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setNewLinkOptions((o) => ({ ...o, expiresInDays: 1 }))
                  }
                >
                  1 day
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setNewLinkOptions((o) => ({ ...o, expiresInDays: 7 }))
                  }
                >
                  7 days
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setNewLinkOptions((o) => ({ ...o, expiresInDays: 30 }))
                  }
                >
                  30 days
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div>
            <label className="text-sm text-[#888]">Password (optional)</label>
            <Input
              type="password"
              placeholder="Leave empty for no password"
              value={newLinkOptions.password || ""}
              onChange={(e) =>
                setNewLinkOptions((o) => ({
                  ...o,
                  password: e.target.value || undefined,
                }))
              }
              className="mt-1"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={newLinkOptions.burnAfterReading}
              onChange={(e) =>
                setNewLinkOptions((o) => ({
                  ...o,
                  burnAfterReading: e.target.checked,
                  burnGraceMs: e.target.checked ? o.burnGraceMs : undefined,
                }))
              }
              className="h-4 w-4 border-2 border-[#1a1a1a] accent-[#2d5a2d]"
            />
            <div>
              <span className="text-sm font-bold text-[#1a1a1a]">Burn after reading</span>
              <p className="text-xs text-[#888]">Link expires after the viewer leaves or the grace period ends</p>
            </div>
          </label>

          {newLinkOptions.burnAfterReading && (
            <div>
              <label className="text-sm text-[#888]">Burn grace period</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between mt-1">
                    {newLinkOptions.burnGraceMs === undefined
                      ? "On tab close only"
                      : newLinkOptions.burnGraceMs === 60_000
                        ? "1 minute"
                        : newLinkOptions.burnGraceMs === 30 * 60_000
                          ? "30 minutes"
                          : newLinkOptions.burnGraceMs === 60 * 60_000
                            ? "1 hour"
                            : newLinkOptions.burnGraceMs === 24 * 60 * 60_000
                              ? "1 day"
                              : newLinkOptions.burnGraceMs === 7 * 24 * 60 * 60_000
                                ? "7 days"
                                : "On tab close only"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setNewLinkOptions((o) => ({ ...o, burnGraceMs: undefined }))}>
                    On tab close only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNewLinkOptions((o) => ({ ...o, burnGraceMs: 60_000 }))}>
                    1 minute
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNewLinkOptions((o) => ({ ...o, burnGraceMs: 30 * 60_000 }))}>
                    30 minutes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNewLinkOptions((o) => ({ ...o, burnGraceMs: 60 * 60_000 }))}>
                    1 hour
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNewLinkOptions((o) => ({ ...o, burnGraceMs: 24 * 60 * 60_000 }))}>
                    1 day
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setNewLinkOptions((o) => ({ ...o, burnGraceMs: 7 * 24 * 60 * 60_000 }))}>
                    7 days
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="text-xs text-[#888] mt-1">
                {newLinkOptions.burnGraceMs === undefined
                  ? "Link will burn when the viewer closes or leaves the tab."
                  : "Link will expire this long after it is first opened."}
              </p>
            </div>
          )}

          <Button onClick={handleCreateLink} disabled={isCreating} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? "Creating..." : "Create private link"}
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="font-bold text-sm text-[#1a1a1a]">Private links</h3>
          {shareLinks === undefined ? (
            <p className="text-sm text-[#888]">Loading...</p>
          ) : shareLinks.length === 0 ? (
            <p className="text-sm text-[#888]">No share links yet</p>
          ) : (
            <div className="space-y-2">
              {shareLinks.map((link) => {
                let burnExpired = link.isExpired;
                let burnLabel = "";
                if (link.burnAfterReading) {
                  if (link.firstViewedAt && link.burnGraceMs !== undefined) {
                    const expiresAt = link.firstViewedAt + link.burnGraceMs;
                    burnExpired = burnExpired || expiresAt <= now;
                    if (expiresAt <= now) {
                      burnLabel = "Burned";
                    } else {
                      const secsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
                      const m = Math.floor(secsLeft / 60);
                      const s = secsLeft % 60;
                      burnLabel = `Burns in ${m}:${String(s).padStart(2, "0")}`;
                    }
                  } else if (link.firstViewedAt) {
                    burnLabel = "Burned";
                  } else {
                    burnLabel = `Burns after ${formatGracePeriod(link.burnGraceMs)}`;
                  }
                }
                const isExpired = burnExpired;

                return (
                <div
                  key={link._id}
                  className="p-3 border-2 border-[#1a1a1a] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-[#e8e8e0] px-2 py-0.5 font-mono break-all">
                      /share/{link.token}
                    </code>
                    {isExpired ? (
                      <Badge variant="destructive" className="flex-shrink-0">Expired</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#888]">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {link.viewCount} views
                      </span>
                      {link.hasPassword ? (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Protected
                        </span>
                      ) : null}
                      {link.burnAfterReading ? (
                        <span className="flex items-center gap-1 text-[#dc2626]">
                          <Flame className="h-3 w-3" />
                          {burnLabel}
                        </span>
                      ) : null}
                      {link.expiresAt ? (
                        <span>
                          Expires {formatRelativeTime(link.expiresAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-0 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopyLink(link.token)}
                      >
                        {copiedId === link.token ? (
                          <Check className="h-3.5 w-3.5 text-[#2d5a2d]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(`/share/${link.token}`, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#dc2626] hover:text-[#dc2626]"
                        onClick={() => handleDeleteLink(link._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
        <Separator />

        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="flex items-center justify-between w-full text-sm font-bold text-[#1a1a1a] hover:text-[#2d5a2d] transition-colors py-1"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            How sharing works
          </span>
          {showHelp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showHelp && (
          <div className="space-y-4 border-2 border-[#1a1a1a] p-4 bg-[#e8e8e0] text-sm">
            <div>
              <h4 className="font-bold text-[#1a1a1a]">Open link</h4>
              <p className="text-[#666] mt-1">
                A permanent URL that works for anyone — no login, no password, no expiration. Enable it to let anyone with the link view the content. Disable it to turn off public access. Private links still work either way.
              </p>
            </div>

            <div className="border-t border-[#1a1a1a]/10 pt-3">
              <h4 className="font-bold text-[#1a1a1a]">Private links</h4>
              <p className="text-[#666] mt-1">
                Unique links you generate for specific people. Each one can have its own password, expiration, and burn settings. You can track views, revoke access anytime, and create as many as you need.
              </p>
            </div>

            <div className="border-t border-[#1a1a1a]/10 pt-3">
              <h4 className="font-bold text-[#1a1a1a]">Password</h4>
              <p className="text-[#666] mt-1">
                Require a password before the recipient can view. After 5 wrong attempts, the link locks for 10 minutes.
              </p>
            </div>

            <div className="border-t border-[#1a1a1a]/10 pt-3">
              <h4 className="font-bold text-[#1a1a1a]">Expiration</h4>
              <p className="text-[#666] mt-1">
                Set the link to stop working after 1, 7, or 30 days from creation. After that, the link is permanently dead.
              </p>
            </div>

            <div className="border-t border-[#1a1a1a]/10 pt-3">
              <h4 className="font-bold text-[#1a1a1a]">Burn after reading</h4>
              <p className="text-[#666] mt-1">
                The link self-destructs after being opened. Set a grace period (e.g. 1 minute, 1 hour) — the countdown starts the moment someone opens the link, and it expires when the time is up. Choose "On tab close only" to keep it alive until the viewer leaves.
              </p>
            </div>

            <div className="border-t border-[#1a1a1a]/10 pt-3">
              <h4 className="font-bold text-[#1a1a1a]">Comments</h4>
              <p className="text-[#666] mt-1">
                Signed-in users can leave comments on any shared content — open or private links. Video comments are pinned to a point in the timeline. Image comments are general.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
