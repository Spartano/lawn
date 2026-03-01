"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/tanstack-react-start";
import { ReactNode, useEffect } from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL");
}

const convex = new ConvexReactClient(convexUrl);

function useAuthDebug() {
  const auth = useAuth();
  useEffect(() => {
    console.log("[DEBUG convex] useAuth() state:", {
      isLoaded: auth.isLoaded,
      isSignedIn: auth.isSignedIn,
      userId: auth.userId,
    });
    if (auth.isLoaded && auth.isSignedIn) {
      auth.getToken({ template: "convex" }).then((token) => {
        console.log("[DEBUG convex] getToken('convex'):", token ? `${token.slice(0, 20)}...` : null);
      }).catch((err) => {
        console.error("[DEBUG convex] getToken('convex') error:", err);
      });
    }
  }, [auth.isLoaded, auth.isSignedIn]);
  return auth;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuthDebug}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export { convex };
