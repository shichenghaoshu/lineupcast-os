// @lineupcast/hf — resilient LLM provider client with mock fallback

import type {
  GenerateTextRequest,
  GenerateTextResult,
  HfClientOptions,
  LlmProvider,
  LlmProviderType,
} from "./types.js";
import { HuggingFaceInferenceEndpointProvider } from "./providers/inferenceEndpoint.js";
import { LocalTransformersProvider } from "./providers/localTransformers.js";
import { OpenAiCompatibleProvider } from "./providers/openaiCompatible.js";

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

export class HfClient {
  private readonly options: HfClientOptions;

  constructor(options: HfClientOptions = {}) {
    this.options = options;
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const provider = this.createProvider(request.provider);
    try {
      return await provider.generateText({
        ...request,
        model: request.model ?? this.options.model,
      });
    } catch (error) {
      return this.mockFallback(request, provider.type, error);
    }
  }

  private createProvider(provider?: LlmProviderType): LlmProvider {
    const selected = provider ?? this.options.provider ?? selectProviderFromEnv();
    if (selected === "openai-compatible") {
      return new OpenAiCompatibleProvider({
        baseUrl: this.options.openAiCompatibleBaseUrl ?? process.env["OPENAI_COMPATIBLE_BASE_URL"],
        apiKey: this.options.apiKey ?? process.env["OPENAI_COMPATIBLE_API_KEY"],
        model: this.options.model ?? process.env["OPENAI_COMPATIBLE_MODEL"],
      });
    }
    if (selected === "huggingface-inference-endpoint") {
      return new HuggingFaceInferenceEndpointProvider({
        endpointUrl: this.options.endpointUrl ?? process.env["HF_ENDPOINT_URL"],
        apiKey:
          this.options.apiKey ??
          process.env["HF_TOKEN"] ??
          process.env["HUGGINGFACEHUB_API_TOKEN"],
      });
    }
    if (selected === "huggingface-inference-provider") {
      return new HuggingFaceInferenceEndpointProvider({
        endpointUrl: this.options.endpointUrl ?? process.env["HF_ENDPOINT_URL"],
        apiKey:
          this.options.apiKey ??
          process.env["HF_TOKEN"] ??
          process.env["HUGGINGFACEHUB_API_TOKEN"],
        providerType: "huggingface-inference-provider",
      });
    }
    if (selected === "local-transformers") {
      return new LocalTransformersProvider();
    }
    return new MockLlmProvider();
  }

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

export function selectProviderFromEnv(): LlmProviderType {
  if (process.env["HF_ENDPOINT_URL"]) return "huggingface-inference-endpoint";
  if (process.env["OPENAI_COMPATIBLE_BASE_URL"]) return "openai-compatible";
  return "mock";
}
