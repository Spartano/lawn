import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import SharePage from "./-share";

export const Route = createFileRoute("/share/$token")({
  head: () =>
    seoHead({
      title: "Shared media",
      description: "Review this shared content on Signum.",
      path: "/share",
      noIndex: true,
    }),
  component: SharePage,
});
