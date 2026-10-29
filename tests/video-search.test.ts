import { describe, it, expect, vi } from "vitest";
import { normalizeVideoResults, searchYouTube } from "../src/video-search";
describe("You.com video search", () => {
  it("keeps only actual YouTube videos, canonicalizes links, and removes duplicates", () => {
    const result = normalizeVideoResults({
      results: {
        web: [
          {
            title: "Worked fraction example",
            url: "https://www.youtube.com/watch?v=abcdefghijk&tracking=x",
            snippets: ["Rename both fractions."],
          },
          { title: "Duplicate", url: "https://youtu.be/abcdefghijk" },
          { title: "Channel", url: "https://youtube.com/@math" },
          {
            title: "Fake host",
            url: "https://youtube.com.evil.example/watch?v=abcdefghijk",
          },
          { title: "Unsafe scheme", url: "javascript:alert(1)" },
          { title: "Another", url: "https://youtu.be/12345678901" },
        ],
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(result[0].description).toBe("Rename both fractions.");
  });
  it("uses the You.com API with a generic topic query and no classroom payload", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ results: { web: [] } }));
    expect(
      await searchYouTube("equivalent fractions", "test-key", fetcher),
    ).toEqual([]);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("https://ydc-index.io/v1/search");
    expect(request.headers["X-API-Key"]).toBe("test-key");
    expect(JSON.parse(request.body)).toEqual({
      query:
        "site:youtube.com/watch grade 5 math equivalent fractions worked example",
      count: 10,
    });
  });
  it("handles provider throttling and malformed payloads without inventing videos", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 429 }));
    await expect(
      searchYouTube("fractions", "test-key", fetcher),
    ).rejects.toThrow(/busy/i);
    expect(() => normalizeVideoResults({ unexpected: [] })).toThrow(
      /unexpected/i,
    );
  });
});
