// @lineupcast/hf — resilient LLM provider client with mock fallback

import type {
  FallbackConfig,
  GenerateTextRequest,
  GenerateTextResult,
  HfClientOptions,
  LlmProvider,
  LlmProviderStatus,
  LlmProviderType,
} from "./types.js";
import { HuggingFaceInferenceEndpointProvider } from "./providers/inferenceEndpoint.js";
import { LmStudioProvider } from "./providers/lmstudioProvider.js";
import { LocalTransformersProvider } from "./providers/localTransformers.js";
import { OllamaProvider } from "./providers/ollamaProvider.js";
import { OpenAiCompatibleProvider } from "./providers/openaiCompatible.js";
import { VllmProvider } from "./providers/vllmProvider.js";

export class MockLlmProvider implements LlmProvider {
  readonly type = "mock" as const;
  readonly defaultModel = "lineupcast-template";

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const started = Date.now();
    return {
      text: request.fallbackText ?? request.prompt ?? "",
      provider: this.type,
      model: request.model ?? this.defaultModel,
      latencyMs: Date.now() - started,
      fallback: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Status tracker — keeps latency + last test result per provider
// ---------------------------------------------------------------------------

const providerStatuses = new Map<LlmProviderType, LlmProviderStatus>();

function recordStatus(
  provider: LlmProviderType,
  latencyMs: number,
  error?: string,
): void {
  providerStatuses.set(provider, {
    provider,
    available: !error,
    lastLatencyMs: latencyMs,
    lastError: error,
    lastTestedAt: new Date(),
  });
}

/** Return a snapshot of all known provider statuses. */
export function getProviderStatuses(): LlmProviderStatus[] {
  return [...providerStatuses.values()];
}

// ---------------------------------------------------------------------------
// HfClient — the main entry point
// ---------------------------------------------------------------------------

export class HfClient {
  private readonly options: HfClientOptions;

  constructor(options: HfClientOptions = {}) {
    this.options = options;
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const fallback = this.options.fallback;
    if (fallback?.chain?.length) {
      return this.runWithFallbackChain(request, fallback);
    }
    return this.runSingle(request, request.provider);
  }

  // ----- single-provider path (no explicit fallback chain) -----

  private async runSingle(
    request: GenerateTextRequest,
    requestedProvider?: LlmProviderType,
  ): Promise<GenerateTextResult> {
    const provider = this.createProvider(requestedProvider);
    try {
      const result = await provider.generateText({
        ...request,
        model: request.model ?? this.options.model,
      });
      recordStatus(provider.type, result.latencyMs);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      recordStatus(provider.type, 0, msg);
      return this.mockFallback(request, provider.type, error);
    }
  }

  // ----- explicit fallback chain -----

  private async runWithFallbackChain(
    request: GenerateTextRequest,
    config: FallbackConfig,
  ): Promise<GenerateTextResult> {
    const chain = [...config.chain];
    if (config.includeMockFallback !== false && !chain.includes("mock")) {
      chain.push("mock");
    }

    let lastError: unknown;
    for (const providerType of chain) {
      try {
        const provider = this.createProvider(providerType);
        const result = await provider.generateText({
          ...request,
          model: request.model ?? this.options.model,
        });
        recordStatus(providerType, result.latencyMs);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        recordStatus(providerType, 0, msg);
        lastError = error;
      }
    }

    // All providers in the chain failed — return mock result with error info.
    const attempted = chain.filter((p) => p !== "mock") as LlmProviderType[];
    return this.mockFallback(
      request,
      attempted[attempted.length - 1] ?? "mock",
      lastError,
    );
  }

  // ----- provider factory -----

  private createProvider(provider?: LlmProviderType): LlmProvider {
    const selected = provider ?? this.options.provider ?? selectProviderFromEnv();
    switch (selected) {
      case "openai-compatible":
      case "openai":
        return new OpenAiCompatibleProvider({
          baseUrl: this.options.openAiCompatibleBaseUrl ?? process.env["OPENAI_COMPATIBLE_BASE_URL"],
          apiKey: this.options.apiKey ?? process.env["OPENAI_COMPATIBLE_API_KEY"],
          model: this.options.model ?? process.env["OPENAI_COMPATIBLE_MODEL"],
        });
      case "huggingface-inference-endpoint":
        return new HuggingFaceInferenceEndpointProvider({
          endpointUrl: this.options.endpointUrl ?? process.env["HF_ENDPOINT_URL"],
          apiKey:
            this.options.apiKey ??
            process.env["HF_TOKEN"] ??
            process.env["HUGGINGFACEHUB_API_TOKEN"],
        });
      case "huggingface-inference-provider":
        return new HuggingFaceInferenceEndpointProvider({
          endpointUrl: this.options.endpointUrl ?? process.env["HF_ENDPOINT_URL"],
          apiKey:
            this.options.apiKey ??
            process.env["HF_TOKEN"] ??
            process.env["HUGGINGFACEHUB_API_TOKEN"],
          providerType: "huggingface-inference-provider",
        });
      case "ollama":
        return new OllamaProvider({
          baseUrl: this.options.ollamaBaseUrl ?? process.env["OLLAMA_BASE_URL"],
          model: this.options.model ?? process.env["OLLAMA_MODEL"],
        });
      case "vllm":
        return new VllmProvider({
          baseUrl: this.options.vllmBaseUrl ?? process.env["VLLM_BASE_URL"],
          apiKey: this.options.apiKey ?? process.env["VLLM_API_KEY"],
          model: this.options.model ?? process.env["VLLM_MODEL"],
        });
      case "lmstudio":
        return new LmStudioProvider({
          baseUrl: this.options.lmstudioBaseUrl ?? process.env["LMSTUDIO_BASE_URL"],
          model: this.options.model ?? process.env["LMSTUDIO_MODEL"],
        });
      case "local-transformers":
        return new LocalTransformersProvider();
      case "mock":
      default:
        return new MockLlmProvider();
    }
  }

  // ----- mock fallback helper -----

  private async mockFallback(
    request: GenerateTextRequest,
    attemptedProvider: LlmProviderType,
    error: unknown,
  ): Promise<GenerateTextResult> {
    const fallback = await new MockLlmProvider().generateText(request);
    return {
      ...fallback,
      attemptedProvider,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Environment-based provider selection
// ---------------------------------------------------------------------------

export function selectProviderFromEnv(): LlmProviderType {
  const explicit = process.env["LLM_PROVIDER"];
  if (explicit) {
    const normalised = explicit.toLowerCase().trim();
    // Validate against known types
    const known: LlmProviderType[] = [
      "mock",
      "huggingface-inference-endpoint",
      "huggingface-inference-provider",
      "openai-compatible",
      "openai",
      "ollama",
      "vllm",
      "lmstudio",
      "local-transformers",
    ];
    if ((known as string[]).includes(normalised)) {
      return normalised as LlmProviderType;
    }
    // Unknown value — fall through to auto-detect
  }

  // Auto-detect based on available configuration
  if (process.env["HF_ENDPOINT_URL"]) return "huggingface-inference-endpoint";
  if (process.env["OPENAI_COMPATIBLE_BASE_URL"]) return "openai-compatible";
  if (process.env["VLLM_BASE_URL"]) return "vllm";
  if (process.env["OLLAMA_BASE_URL"]) return "ollama";
  if (process.env["LMSTUDIO_BASE_URL"]) return "lmstudio";

  return "mock";
}
