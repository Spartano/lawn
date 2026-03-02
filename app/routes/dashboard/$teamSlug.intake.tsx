import { createFileRoute } from "@tanstack/react-router";
import IntakeDashboardPage from "./-intake-dashboard";

export const Route = createFileRoute("/dashboard/$teamSlug/intake")({
  component: IntakeDashboardPage,
});
