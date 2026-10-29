export type VideoResult = {
  id: string;
  title: string;
  url: string;
  description: string;
  thumbnail: string;
};
export function normalizeVideoResults(payload: unknown): VideoResult[] {
  const web = (payload as { results?: { web?: unknown[] } })?.results?.web;
  if (!Array.isArray(web))
    throw new Error("You.com returned an unexpected search response.");
  const seen = new Set<string>(),
    videos: VideoResult[] = [];
  for (const entry of web) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.url !== "string" || typeof row.title !== "string") continue;
    try {
      const url = new URL(row.url);
      if (url.protocol !== "https:") continue;
      const id =
        url.hostname === "youtu.be"
          ? url.pathname.slice(1)
          : ["www.youtube.com", "youtube.com", "m.youtube.com"].includes(
                url.hostname,
              ) && url.pathname === "/watch"
            ? url.searchParams.get("v")
            : null;
      if (!id || !/^[-\w]{11}$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      const snippet = Array.isArray(row.snippets)
        ? row.snippets.find((s) => typeof s === "string")
        : undefined;
      videos.push({
        id,
        title: row.title.slice(0, 200),
        url: `https://www.youtube.com/watch?v=${id}`,
        description: String(
          snippet ??
            (typeof row.description === "string" ? row.description : ""),
        ).slice(0, 400),
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      });
    } catch {
      /* Ignore malformed/non-video URLs from search results. */
    }
  }
  return videos.slice(0, 6);
}
export async function searchYouTube(
  topic: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher("https://ydc-index.io/v1/search", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `site:youtube.com/watch grade 5 math ${topic} worked example`,
      count: 10,
    }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "You.com search is busy. Please wait before trying again."
        : "You.com search could not complete. Please try again shortly.",
    );
  return normalizeVideoResults(await response.json());
}
