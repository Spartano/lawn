import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import WatchPage from "./-watch";

export const Route = createFileRoute("/watch/$publicId")({
  head: ({ params }) =>
    seoHead({
      title: "Watch video",
      description: "Watch and review this video on Signum.",
      path: `/watch/${params.publicId}`,
    }),
  component: WatchPage,
});
