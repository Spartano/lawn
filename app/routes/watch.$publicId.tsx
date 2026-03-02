import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import WatchPage from "./-watch";

export const Route = createFileRoute("/watch/$publicId")({
  head: ({ params }) =>
    seoHead({
      title: "Watch",
      description: "Watch and review on Signum.",
      path: `/watch/${params.publicId}`,
    }),
  component: WatchPage,
});
