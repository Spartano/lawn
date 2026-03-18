import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";

function instagramProxyPlugin(): Plugin {
  return {
    name: "instagram-proxy",
    configureServer(server) {
      server.middlewares.use("/api/instagram-embed", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const pageUrl = url.searchParams.get("url");
        if (!pageUrl || !/^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\//.test(pageUrl)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid Instagram URL" }));
          return;
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);
          const response = await fetch(pageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
              Accept: "text/html,application/xhtml+xml",
              "Accept-Language": "en-US,en;q=0.5",
            },
            redirect: "follow",
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Instagram returned HTTP ${response.status}` }));
            return;
          }

          const html = await response.text();
          const videoUrl = extractVideoUrl(html);
          if (videoUrl) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ videoUrl }));
            return;
          }
        } catch (err) {
          console.log(`[ig-proxy] Fetch error: ${err instanceof Error ? err.message : err}`);
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Could not extract video URL. The post may be private or images-only." }));
      });
    },
  };
}

function unescapeIgUrl(raw: string): string {
  let url = raw;
  let prev = "";
  while (prev !== url) { prev = url; url = url.replace(/\\\\/g, "\\"); }
  return url
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/\\u0025/g, "%")
    .replace(/&amp;/g, "&");
}

function extractVideoUrl(html: string): string | null {
  const cdnMatch = html.match(/https?:\\?\/\\?\/[^"'\s\\]*?(?:cdninstagram\.com|fbcdn\.net|fbcdn\.com)[^"'\s\\]*?\.mp4[^"'\s\\]*/);
  if (cdnMatch) return unescapeIgUrl(cdnMatch[0]);

  const anyMp4Match = html.match(/https?:\\?\/\\?\/[^"'\s\\]+\.mp4[^"'\s\\]*/);
  if (anyMp4Match) return unescapeIgUrl(anyMp4Match[0]);

  return null;
}

export default defineConfig({
  plugins: [
    instagramProxyPlugin(),
    tsconfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      srcDirectory: "app",
      spa: {
        enabled: true,
        maskPath: "/mono",
        prerender: {
          outputPath: "/_shell",
          crawlLinks: false,
        },
      },
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
      },
      pages: [
        { path: "/" },
        { path: "/compare/frameio" },
        { path: "/compare/wipster" },
        { path: "/for/video-editors" },
        { path: "/for/agencies" },
        { path: "/pricing" },
      ],
    }),
    viteReact(),
  ],
});
