import { describe, expect, it, vi } from "vitest";
import { apiUrl, generateScript } from "./api-client";

describe("web api client", () => {
  it("uses localhost API base when NEXT_PUBLIC_API_URL is absent", () => {
    expect(apiUrl("/api/matches/demo")).toBe("http://localhost:8000/api/matches/demo");
  });

  it("falls back from scripts/generate to the current script endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        Response.json({
          matchId: "demo",
          script: "Generated script",
          disclaimer: "demo only",
        }),
      );

    const result = await generateScript(
      "demo",
      {
        language: "zh",
        style: "professional",
        duration: "30s",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/api/matches/demo/scripts/generate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/api/matches/demo/script",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.fallback).toBe(true);
    expect(result.script).toBe("Generated script");
  });

  it("returns a local script fallback when both API script endpoints fail", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockRejectedValueOnce(new Error("network down"));

    const result = await generateScript(
      "demo",
      {
        language: "bilingual",
        style: "broadcast",
        duration: "30s",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.fallback).toBe(true);
    expect(result.provider).toBe("local-web-fallback");
    expect(result.script).toContain("Manchester Red");
    expect(result.script).toContain("Shanghai Harbor");
  });
});
