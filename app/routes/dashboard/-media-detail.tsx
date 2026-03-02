
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Id } from "@convex/_generated/dataModel";
import { useVideoData } from "./-video.data";
import VideoPage from "./-video";
import ImagePage from "./-image";

export default function MediaDetailPage() {
  const params = useParams({ strict: false });
  const navigate = useNavigate({});
  const pathname = useLocation().pathname;
  const teamSlug = typeof params.teamSlug === "string" ? params.teamSlug : "";
  const projectId = params.projectId as Id<"projects">;
  const videoId = params.videoId as Id<"videos">;

  const {
    context,
    resolvedTeamSlug,
    resolvedProjectId,
    resolvedVideoId,
    video,
    comments,
    commentsThreaded,
  } = useVideoData({ teamSlug, projectId, videoId });

  const shouldCanonicalize =
    !!context && !context.isCanonical && pathname !== context.canonicalPath;

  useEffect(() => {
    if (shouldCanonicalize && context) {
      navigate({ to: context.canonicalPath, replace: true });
    }
  }, [shouldCanonicalize, context, navigate]);

  if (context === undefined || video === undefined || shouldCanonicalize) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#888]">Loading...</div>
      </div>
    );
  }

  if (context === null || video === null || !resolvedProjectId || !resolvedVideoId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#888]">Not found</div>
      </div>
    );
  }

  const mediaType = (video as { mediaType?: string }).mediaType;
  const projectName = context?.project?.name ?? "project";

  if (mediaType === "image") {
    return (
      <ImagePage
        resolvedTeamSlug={resolvedTeamSlug}
        resolvedProjectId={resolvedProjectId}
        resolvedVideoId={resolvedVideoId}
        video={video}
        comments={comments}
        commentsThreaded={commentsThreaded}
        projectName={projectName}
      />
    );
  }

  return <VideoPage />;
}
