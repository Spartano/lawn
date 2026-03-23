
import { useConvex, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CommentList } from "@/components/comments/CommentList";
import { CommentInput } from "@/components/comments/CommentInput";
import { ShareDialog } from "@/components/ShareDialog";
import {
  VideoWorkflowStatusControl,
  type VideoWorkflowStatus,
} from "@/components/videos/VideoWorkflowStatusControl";
import { useVideoPresence } from "@/lib/useVideoPresence";
import { VideoWatchers } from "@/components/presence/VideoWatchers";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  Edit2,
  Check,
  X,
  Link as LinkIcon,
  MessageSquare,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Id } from "@convex/_generated/dataModel";
import { projectPath, teamHomePath } from "@/lib/routes";
import { useRoutePrewarmIntent } from "@/lib/useRoutePrewarmIntent";
import { prewarmProject } from "./-project.data";
import { prewarmTeam } from "./-team.data";

interface ImagePageProps {
  resolvedTeamSlug: string;
  resolvedProjectId: Id<"projects">;
  resolvedVideoId: Id<"videos">;
  video: {
    _id: Id<"videos">;
    title: string;
    status: string;
    uploaderName?: string;
    muxPlaybackId?: string;
    workflowStatus: string;
    role: string;
    s3Key?: string;
    [key: string]: unknown;
  };
  comments?: Array<{ _id: Id<"comments">; timestampSeconds: number; resolved: boolean; [key: string]: unknown }>;
  commentsThreaded?: unknown;
  projectName: string;
}

export default function ImagePage({
  resolvedTeamSlug,
  resolvedProjectId,
  resolvedVideoId,
  video,
  comments,
  commentsThreaded,
  projectName,
}: ImagePageProps) {
  const convex = useConvex();
  const updateVideo = useMutation(api.videos.update);
  const updateVideoWorkflowStatus = useMutation(api.videos.updateWorkflowStatus);
  const getPlaybackSession = useAction(api.videoActions.getPlaybackSession);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [highlightedCommentId, setHighlightedCommentId] = useState<Id<"comments"> | undefined>();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [mobileCommentsOpen, setMobileCommentsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const prewarmTeamIntentHandlers = useRoutePrewarmIntent(() =>
    prewarmTeam(convex, { teamSlug: resolvedTeamSlug }),
  );
  const prewarmProjectIntentHandlers = useRoutePrewarmIntent(() =>
    prewarmProject(convex, {
      teamSlug: resolvedTeamSlug,
      projectId: resolvedProjectId,
    }),
  );
  const { watchers } = useVideoPresence({
    videoId: resolvedVideoId,
    enabled: true,
  });

  useEffect(() => {
    if (video.status !== "ready") {
      setImageUrl(null);
      setIsLoadingImage(false);
      return;
    }

    let cancelled = false;
    setIsLoadingImage(true);

    void getPlaybackSession({ videoId: resolvedVideoId })
      .then((session) => {
        if (cancelled) return;
        setImageUrl(session.url);
      })
      .catch(() => {
        if (cancelled) return;
        setImageUrl(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getPlaybackSession, resolvedVideoId, video.status]);

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) return;
    try {
      await updateVideo({ videoId: resolvedVideoId, title: editedTitle.trim() });
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  const handleUpdateWorkflowStatus = useCallback(
    async (workflowStatus: VideoWorkflowStatus) => {
      try {
        await updateVideoWorkflowStatus({ videoId: resolvedVideoId, workflowStatus });
      } catch (error) {
        console.error("Failed to update review status:", error);
      }
    },
    [resolvedVideoId, updateVideoWorkflowStatus],
  );

  const startEditingTitle = () => {
    setEditedTitle(video.title);
    setIsEditingTitle(true);
  };

  const canEdit = video.role !== "viewer";

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader paths={[
        {
          label: resolvedTeamSlug,
          href: teamHomePath(resolvedTeamSlug),
          prewarmIntentHandlers: prewarmTeamIntentHandlers,
        },
        {
          label: projectName,
          href: projectPath(resolvedTeamSlug, resolvedProjectId),
          prewarmIntentHandlers: prewarmProjectIntentHandlers,
        },
        {
          label: isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-40 sm:w-64 h-8 text-base font-black tracking-tighter uppercase font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setIsEditingTitle(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="truncate max-w-[150px] sm:max-w-[300px]">{video.title}</span>
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={startEditingTitle}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
              {video.status !== "ready" && (
                <Badge
                  variant={video.status === "failed" ? "destructive" : "secondary"}
                  title={
                    video.status === "failed" && video.uploadError
                      ? video.uploadError
                      : undefined
                  }
                >
                  {video.status === "uploading" && "Uploading"}
                  {video.status === "failed" && "Failed"}
                </Badge>
              )}
            </div>
          )
        }
      ]}>
        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-[#888]">
          <span className="truncate max-w-[100px]">{video.uploaderName}</span>
          <VideoWatchers watchers={watchers} />
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0 border-l-2 border-[#1a1a1a]/20 pl-3 ml-1">
          <VideoWorkflowStatusControl
            status={video.workflowStatus}
            size="lg"
            disabled={!canEdit}
            onChange={(workflowStatus) => {
              void handleUpdateWorkflowStatus(workflowStatus);
            }}
          />
          <Button variant="outline" onClick={() => setShareDialogOpen(true)}>
            <LinkIcon className="mr-1.5 h-4 w-4" />
            Share
          </Button>
          <Button
            variant="outline"
            className="lg:hidden"
            onClick={() => setMobileCommentsOpen(true)}
          >
            <MessageSquare className="h-4 w-4" />
            {comments && comments.length > 0 && (
              <span className="ml-1 text-xs">{comments.length}</span>
            )}
          </Button>
        </div>

        {/* Mobile actions */}
        <div className="flex sm:hidden items-center gap-2">
          <VideoWorkflowStatusControl
            status={video.workflowStatus}
            size="lg"
            disabled={!canEdit}
            onChange={(workflowStatus) => {
              void handleUpdateWorkflowStatus(workflowStatus);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setShareDialogOpen(true)}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMobileCommentsOpen(true)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Comments{comments && comments.length > 0 ? ` (${comments.length})` : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DashboardHeader>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image viewer */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-black">
          {imageUrl ? (
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              <img
                src={imageUrl}
                alt={video.title}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                {video.status === "uploading" && (
                  <p className="text-white/60">Uploading...</p>
                )}
                {video.status === "ready" && (
                  <div className="flex flex-col items-center gap-3 text-white">
                    {isLoadingImage && (
                      <>
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                        <p className="text-sm font-medium text-white/85">Loading image...</p>
                      </>
                    )}
                  </div>
                )}
                {video.status === "failed" && (
                  <div className="max-w-md px-4 text-center space-y-2">
                    <p className="text-[#dc2626] font-medium">Processing failed</p>
                    {video.uploadError ? (
                      <p className="text-xs font-mono text-white/75 break-words whitespace-pre-wrap">
                        {video.uploadError}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Comments sidebar — desktop */}
        <aside className="hidden lg:flex w-80 xl:w-96 border-l-2 border-[#1a1a1a] flex-col bg-[#f0f0e8]">
          <div className="flex-shrink-0 px-5 py-4 border-b border-[#1a1a1a]/10 flex items-center justify-between">
            <h2 className="font-semibold text-sm tracking-tight flex items-center gap-2 text-[#1a1a1a]">
              Discussion
            </h2>
            {comments && comments.length > 0 && (
              <span className="text-[11px] font-medium text-[#888] bg-[#1a1a1a]/5 px-2 py-0.5 rounded-full">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <CommentList
              videoId={resolvedVideoId}
              comments={commentsThreaded as Parameters<typeof CommentList>[0]["comments"]}
              highlightedCommentId={highlightedCommentId}
              canResolve={canEdit}
              hideTimestamps
            />
          </div>
          <div className="flex-shrink-0 border-t-2 border-[#1a1a1a] bg-[#f0f0e8]">
            <CommentInput
              videoId={resolvedVideoId}
              timestampSeconds={0}
              showTimestamp={false}
              variant="seamless"
            />
          </div>
        </aside>
      </div>

      {/* Comments overlay — mobile */}
      {mobileCommentsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-[#f0f0e8]">
          <div className="flex-shrink-0 px-5 py-4 border-b-2 border-[#1a1a1a] flex items-center justify-between">
            <h2 className="font-semibold text-sm tracking-tight flex items-center gap-2 text-[#1a1a1a]">
              Discussion
              {comments && comments.length > 0 && (
                <span className="text-[11px] font-medium text-[#888] bg-[#1a1a1a]/5 px-2 py-0.5 rounded-full">
                  {comments.length}
                </span>
              )}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileCommentsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <CommentList
              videoId={resolvedVideoId}
              comments={commentsThreaded as Parameters<typeof CommentList>[0]["comments"]}
              highlightedCommentId={highlightedCommentId}
              canResolve={canEdit}
              hideTimestamps
            />
          </div>
          <div className="flex-shrink-0 border-t-2 border-[#1a1a1a] bg-[#f0f0e8]">
            <CommentInput
              videoId={resolvedVideoId}
              timestampSeconds={0}
              showTimestamp={false}
              variant="seamless"
            />
          </div>
        </div>
      )}

      <ShareDialog
        videoId={resolvedVideoId}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </div>
  );
}
