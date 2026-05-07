import { describe, expect, it, vi } from "vitest";
import {
  HfClient,
  MockLlmProvider,
  OllamaProvider,
  VllmProvider,
  LmStudioProvider,
  selectProviderFromEnv,
  getProviderStatuses,
} from "../index.js";

// ---------------------------------------------------------------------------
// Helper: save & restore env vars between tests
// ---------------------------------------------------------------------------

function withCleanEnv(fn: () => void | Promise<void>) {
  return async () => {
    const saved: Record<string, string | undefined> = {};
    const keys = [
      "LLM_PROVIDER",
      "HF_ENDPOINT_URL",
      "OPENAI_COMPATIBLE_BASE_URL",
      "VLLM_BASE_URL",
      "OLLAMA_BASE_URL",
      "LMSTUDIO_BASE_URL",
      "HF_TOKEN",
      "HUGGINGFACEHUB_API_TOKEN",
      "OPENAI_COMPATIBLE_API_KEY",
      "VLLM_API_KEY",
      "OLLAMA_MODEL",
      "LMSTUDIO_MODEL",
    ];
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    try {
      await fn();
    } finally {
      for (const k of keys) {
        if (saved[k] !== undefined) {
          process.env[k] = saved[k];
        } else {
          delete process.env[k];
        }
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Mock provider tests
// ---------------------------------------------------------------------------

describe("MockLlmProvider", () => {
  it("returns fallbackText when provided", async () => {
    const provider = new MockLlmProvider();
    const result = await provider.generateText({
      prompt: "hello",
      fallbackText: "safe fallback",
    });
    expect(result.text).toBe("safe fallback");
    expect(result.provider).toBe("mock");
    expect(result.fallback).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns prompt when no fallbackText", async () => {
    const provider = new MockLlmProvider();
    const result = await provider.generateText({ prompt: "hello" });
    expect(result.text).toBe("hello");
  });

  it("returns empty string when neither prompt nor fallbackText", async () => {
    const provider = new MockLlmProvider();
    const result = await provider.generateText({});
    expect(result.text).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Provider selection from env
// ---------------------------------------------------------------------------

describe("selectProviderFromEnv", () => {
  it(
    "returns mock when no env vars set",
    withCleanEnv(() => {
      expect(selectProviderFromEnv()).toBe("mock");
    }),
  );

  it(
    "respects explicit LLM_PROVIDER env var",
    withCleanEnv(() => {
      process.env["LLM_PROVIDER"] = "ollama";
      expect(selectProviderFromEnv()).toBe("ollama");
    }),
  );

  it(
    "falls back to auto-detect when LLM_PROVIDER is unknown",
    withCleanEnv(() => {
      process.env["LLM_PROVIDER"] = "totally-unknown";
      process.env["HF_ENDPOINT_URL"] = "https://hf.example.com";
      expect(selectProviderFromEnv()).toBe("huggingface-inference-endpoint");
    }),
  );

  it(
    "auto-detects huggingface-inference-endpoint",
    withCleanEnv(() => {
      process.env["HF_ENDPOINT_URL"] = "https://hf.example.com";
      expect(selectProviderFromEnv()).toBe("huggingface-inference-endpoint");
    }),
  );

  it(
    "auto-detects openai-compatible",
    withCleanEnv(() => {
      process.env["OPENAI_COMPATIBLE_BASE_URL"] = "https://api.openai.com/v1";
      expect(selectProviderFromEnv()).toBe("openai-compatible");
    }),
  );

  it(
    "auto-detects vllm",
    withCleanEnv(() => {
      process.env["VLLM_BASE_URL"] = "http://localhost:8000/v1";
      expect(selectProviderFromEnv()).toBe("vllm");
    }),
  );

  it(
    "auto-detects ollama",
    withCleanEnv(() => {
      process.env["OLLAMA_BASE_URL"] = "http://localhost:11434";
      expect(selectProviderFromEnv()).toBe("ollama");
    }),
  );

  it(
    "auto-detects lmstudio",
    withCleanEnv(() => {
      process.env["LMSTUDIO_BASE_URL"] = "http://localhost:1234/v1";
      expect(selectProviderFromEnv()).toBe("lmstudio");
    }),
  );

  it(
    "is case-insensitive for explicit provider",
    withCleanEnv(() => {
      process.env["LLM_PROVIDER"] = "Ollama";
      expect(selectProviderFromEnv()).toBe("ollama");
    }),
  );
});

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

describe("HfClient fallback chain", () => {
  it("falls back through the chain and eventually hits mock", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connection refused");
    }) as unknown as typeof fetch;

    const client = new HfClient({
      fallback: {
        chain: ["ollama", "vllm", "lmstudio"],
        includeMockFallback: true,
      },
      ollamaBaseUrl: "http://localhost:11434",
      vllmBaseUrl: "http://localhost:8000/v1",
      lmstudioBaseUrl: "http://localhost:1234/v1",
    });

    const result = await client.generateText({
      prompt: "test prompt",
      fallbackText: "safe fallback",
    });

    // Should have tried all providers and fallen back to mock
    expect(result.provider).toBe("mock");
    expect(result.text).toBe("safe fallback");
    expect(result.fallback).toBe(true);
    expect(result.attemptedProvider).toBe("lmstudio");
    expect(result.error).toContain("connection refused");

    globalThis.fetch = originalFetch;
  });

  it("returns first successful result in the chain", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      callCount++;
      const urlStr = typeof url === "string" ? url : url.toString();
      // First provider (ollama) fails, second (vllm) succeeds
      if (urlStr.includes("/api/generate")) {
        throw new Error("ollama down");
      }
      // vLLM succeeds
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "vllm response" } }],
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const client = new HfClient({
      fallback: {
        chain: ["ollama", "vllm"],
        includeMockFallback: false,
      },
      ollamaBaseUrl: "http://localhost:11434",
      vllmBaseUrl: "http://localhost:8000/v1",
    });

    const result = await client.generateText({ prompt: "test" });

    expect(result.provider).toBe("vllm");
    expect(result.text).toBe("vllm response");
    expect(result.fallback).toBe(false);
    expect(callCount).toBe(2); // ollama + vllm

    globalThis.fetch = originalFetch;
  });
});

// ---------------------------------------------------------------------------
// Missing token / graceful handling
// ---------------------------------------------------------------------------

describe("Missing configuration", () => {
  it(
    "HfClient defaults to mock when no provider configured",
    withCleanEnv(async () => {
      const client = new HfClient();
      const result = await client.generateText({
        prompt: "hello",
        fallbackText: "fallback",
      });
      expect(result.provider).toBe("mock");
      expect(result.text).toBe("fallback");
      expect(result.fallback).toBe(true);
    }),
  );

  it("OllamaProvider gracefully throws on connection failure", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const provider = new OllamaProvider({ baseUrl: "http://localhost:11434" });
    await expect(provider.generateText({ prompt: "test" })).rejects.toThrow("ECONNREFUSED");

    globalThis.fetch = originalFetch;
  });

  it("VllmProvider throws when baseUrl is missing", async () => {
    const provider = new VllmProvider();
    await expect(provider.generateText({ prompt: "test" })).rejects.toThrow(
      "vLLM base URL is not configured",
    );
  });

  it("LmStudioProvider gracefully throws on HTTP error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as unknown as typeof fetch;

    const provider = new LmStudioProvider({ baseUrl: "http://localhost:1234/v1" });
    await expect(provider.generateText({ prompt: "test" })).rejects.toThrow("HTTP 500");

    globalThis.fetch = originalFetch;
  });

  it(
    "HfClient catches missing-token errors and falls back to mock",
    withCleanEnv(async () => {
      const client = new HfClient({ provider: "huggingface-inference-endpoint" });
      // No HF_ENDPOINT_URL set — should throw internally and fall back to mock
      const result = await client.generateText({
        prompt: "test",
        fallbackText: "mock result",
      });
      expect(result.provider).toBe("mock");
      expect(result.text).toBe("mock result");
      expect(result.attemptedProvider).toBe("huggingface-inference-endpoint");
      expect(result.error).toBeDefined();
    }),
  );
});

// ---------------------------------------------------------------------------
// Provider status tracking
// ---------------------------------------------------------------------------

describe("Provider status tracking", () => {
  it(
    "records status after successful generation",
    withCleanEnv(async () => {
      const client = new HfClient({ provider: "mock" });
      await client.generateText({ prompt: "test" });

      const statuses = getProviderStatuses();
      const mockStatus = statuses.find((s) => s.provider === "mock");
      expect(mockStatus).toBeDefined();
      expect(mockStatus!.available).toBe(true);
      expect(mockStatus!.lastLatencyMs).toBeGreaterThanOrEqual(0);
      expect(mockStatus!.lastTestedAt).toBeInstanceOf(Date);
    }),
  );

  it(
    "records error status on failure",
    withCleanEnv(async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        throw new Error("network error");
      }) as unknown as typeof fetch;

      const client = new HfClient({
        provider: "ollama",
        ollamaBaseUrl: "http://localhost:11434",
      });
      await client.generateText({ prompt: "test", fallbackText: "ok" });

      const statuses = getProviderStatuses();
      const ollamaStatus = statuses.find((s) => s.provider === "ollama");
      expect(ollamaStatus).toBeDefined();
      expect(ollamaStatus!.available).toBe(false);
      expect(ollamaStatus!.lastError).toContain("network error");

      globalThis.fetch = originalFetch;
    }),
  );
});
