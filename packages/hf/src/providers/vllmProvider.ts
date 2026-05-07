// @lineupcast/hf — vLLM adapter (OpenAI-compatible /v1/chat/completions)

import type {
  ChatMessage,
  GenerateTextRequest,
  GenerateTextResult,
  LlmProvider,
  TokenUsage,
} from "../types.js";

export interface VllmProviderOptions {
  /** vLLM server base URL (e.g. http://localhost:8000/v1). */
  baseUrl?: string;
  /** Model name served by vLLM. */
  model?: string;
  /** Optional API key for authenticated vLLM instances. */
  apiKey?: string;
}

export class VllmProvider implements LlmProvider {
  readonly type = "vllm" as const;
  readonly defaultModel: string;

  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor(options: VllmProviderOptions = {}) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.defaultModel = options.model ?? "vllm-model";
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const started = Date.now();
    if (!this.baseUrl) {
      throw new Error("vLLM base URL is not configured (set VLLM_BASE_URL)");
    }

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: request.model ?? this.defaultModel,
        messages: toMessages(request),
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`vLLM endpoint failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const text = extractChoiceText(json);

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

function toMessages(request: GenerateTextRequest): ChatMessage[] {
  if (request.messages?.length) return request.messages;
  const messages: ChatMessage[] = [];
  if (request.system) messages.push({ role: "system", content: request.system });
  messages.push({ role: "user", content: request.prompt ?? "" });
  return messages;
}

function extractChoiceText(json: Record<string, unknown>): string {
  const choices = json["choices"];
  if (!Array.isArray(choices)) {
    throw new Error("vLLM response did not include choices");
  }
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.["message"] as Record<string, unknown> | undefined;
  const content = message?.["content"];
  if (typeof content === "string") return content;
  const text = first?.["text"];
  if (typeof text === "string") return text;
  throw new Error("vLLM response did not include content");
}

function extractTokenUsage(json: Record<string, unknown>): TokenUsage | undefined {
  const usage = json["usage"];
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
