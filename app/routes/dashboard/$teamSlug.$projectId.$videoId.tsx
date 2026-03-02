import { createFileRoute } from "@tanstack/react-router";
import MediaDetailPage from "./-media-detail";

export const Route = createFileRoute("/dashboard/$teamSlug/$projectId/$videoId")({
  component: MediaDetailPage,
});
