const SITE_URL = "https://signum-two.vercel.app";
const SITE_NAME = "Signum";
const TWITTER_HANDLE = "@theo";

type SeoOptions = {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  type?: string;
  noIndex?: boolean;
};

export function seoHead({
  title,
  description,
  path,
  ogImage,
  type = "website",
  noIndex = false,
}: SeoOptions) {
  const fullTitle = title.toLowerCase().includes("signum")
    ? title
    : `${title} | Signum`;
  const url = `${SITE_URL}${path}`;

  const meta: Array<Record<string, string>> = [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:site", content: TWITTER_HANDLE },
  ];

  if (ogImage) {
    const imageUrl = ogImage.startsWith("http")
      ? ogImage
      : `${SITE_URL}${ogImage}`;
    meta.push(
      { property: "og:image", content: imageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: imageUrl },
    );
  } else {
    meta.push({ name: "twitter:card", content: "summary" });
  }

  if (noIndex) {
    meta.push({ name: "robots", content: "noindex,nofollow" });
  }

  const links = [{ rel: "canonical", href: url }];

  return { meta, links };
}
