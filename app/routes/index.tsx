import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import Homepage from "./-home";

export const Route = createFileRoute("/")({
  head: () =>
    seoHead({
      title: "Signum — video review for coaching teams",
      description:
        "Video review for coaching teams. Slow-motion playback, timestamped feedback, unlimited seats, $5/month flat. The open source video review platform.",
      path: "/",
      ogImage: "/og/home.png",
    }),
  component: Homepage,
});
