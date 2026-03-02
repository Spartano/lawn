import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import IntakePage from "./-intake";

export const Route = createFileRoute("/intake/$slug")({
  head: () =>
    seoHead({
      title: "Get Started",
      description: "Fill out this form to get started.",
      path: "/intake",
      noIndex: true,
    }),
  component: IntakePage,
});
