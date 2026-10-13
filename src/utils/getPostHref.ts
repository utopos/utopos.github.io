import type { CollectionEntry } from "astro:content";
import { getPostUrl } from "./getPostPaths";

/** Returns the link target for a post: its external URL if it has one, else its local page. */
export function getPostHref(
  { id, filePath, data }: CollectionEntry<"posts">,
  locale?: string
) {
  return data.externalUrl ?? getPostUrl(id, filePath, locale);
}

/** Returns the bare host of an external post, e.g. "curiosum.com". */
export function getExternalHost(post: CollectionEntry<"posts">) {
  return post.data.externalUrl
    ? new URL(post.data.externalUrl).hostname.replace(/^www\./, "")
    : undefined;
}
