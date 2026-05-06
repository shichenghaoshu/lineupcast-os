// @lineupcast/hf — Hugging Face endpoint and inference provider adapters

import type {
  GenerateTextRequest,
  GenerateTextResult,
  LlmProvider,
  LlmProviderType,
  TokenUsage,
} from "../types.js";

export interface HuggingFaceEndpointOptions {
  endpointUrl?: string;
  apiKey?: string;
  providerType?: Extract<
    LlmProviderType,
    "huggingface-inference-endpoint" | "huggingface-inference-provider"
  >;
}

export class HuggingFaceInferenceEndpointProvider implements LlmProvider {
  readonly type: Extract<
    LlmProviderType,
    "huggingface-inference-endpoint" | "huggingface-inference-provider"
  >;
  readonly defaultModel = "huggingface-endpoint";

  private readonly endpointUrl?: string;
  private readonly apiKey?: string;

  constructor(options: HuggingFaceEndpointOptions = {}) {
    this.endpointUrl = options.endpointUrl;
    this.apiKey = options.apiKey;
    this.type = options.providerType ?? "huggingface-inference-endpoint";
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const started = Date.now();
    if (!this.endpointUrl) {
      throw new Error("HF_ENDPOINT_URL is not configured");
    }

    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        inputs: messagesToPrompt(request),
        parameters: {
          max_new_tokens: request.maxTokens,
          temperature: request.temperature,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Hugging Face endpoint failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as unknown;
    const text = extractText(json);

    return {
      text,
      provider: this.type,
      model: request.model ?? this.defaultModel,
      latencyMs: Date.now() - started,
      tokenUsage: extractTokenUsage(json),
      fallback: false,
    };
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }
}

function messagesToPrompt(request: GenerateTextRequest): string {
  if (request.messages?.length) {
    return request.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  }
  return [request.system, request.prompt].filter(Boolean).join("\n\n");
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | undefined;
    const generatedText = first?.["generated_text"];
    if (typeof generatedText === "string") return generatedText;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["generated_text", "text", "output_text"]) {
      if (typeof object[key] === "string") return object[key];
    }
    const choices = object["choices"];
    if (Array.isArray(choices)) {
      const choice = choices[0] as Record<string, unknown> | undefined;
      const message = choice?.["message"] as Record<string, unknown> | undefined;
      if (typeof message?.["content"] === "string") return message["content"];
      if (typeof choice?.["text"] === "string") return choice["text"];
    }
  }
  throw new Error("Hugging Face response did not include generated text");
}

function extractTokenUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = (value as Record<string, unknown>)["usage"];
  if (!usage || typeof usage !== "object") return undefined;
  const object = usage as Record<string, unknown>;
  return {
    promptTokens: asNumber(object["prompt_tokens"]),
    completionTokens: asNumber(object["completion_tokens"]),
    totalTokens: asNumber(object["total_tokens"]),
  };
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
