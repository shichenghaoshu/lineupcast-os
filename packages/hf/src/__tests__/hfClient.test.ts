import { describe, expect, it, vi } from "vitest";
import { HfClient, selectProviderFromEnv } from "../index.js";

describe("HfClient", () => {
  it("defaults to mock without secrets", async () => {
    const client = new HfClient({ provider: "mock" });
    const result = await client.generateText({ prompt: "ignored", fallbackText: "template" });
    expect(result.provider).toBe("mock");
    expect(result.model).toBe("lineupcast-template");
    expect(result.text).toBe("template");
    expect(result.fallback).toBe(true);
  });

  it("falls back to mock when configured endpoint fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const client = new HfClient({
      provider: "openai-compatible",
      openAiCompatibleBaseUrl: "https://llm.example.test/v1",
    });
    const result = await client.generateText({ prompt: "prompt", fallbackText: "safe fallback" });

    expect(result.provider).toBe("mock");
    expect(result.attemptedProvider).toBe("openai-compatible");
    expect(result.text).toBe("safe fallback");
    expect(result.error).toContain("network down");

    globalThis.fetch = originalFetch;
  });
});

describe("selectProviderFromEnv", () => {
  it("selects mock when provider env is absent", () => {
    const hf = process.env["HF_ENDPOINT_URL"];
    const openai = process.env["OPENAI_COMPATIBLE_BASE_URL"];
    delete process.env["HF_ENDPOINT_URL"];
    delete process.env["OPENAI_COMPATIBLE_BASE_URL"];

    expect(selectProviderFromEnv()).toBe("mock");

    if (hf) process.env["HF_ENDPOINT_URL"] = hf;
    if (openai) process.env["OPENAI_COMPATIBLE_BASE_URL"] = openai;
  });
});
