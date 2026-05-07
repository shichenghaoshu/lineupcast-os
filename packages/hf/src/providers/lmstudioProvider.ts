// @lineupcast/hf — LM Studio adapter (OpenAI-compatible /v1/chat/completions)

import type {
  ChatMessage,
  GenerateTextRequest,
  GenerateTextResult,
  LlmProvider,
  TokenUsage,
} from "../types.js";

export interface LmStudioProviderOptions {
  /** LM Studio server base URL. Default: http://localhost:1234/v1 */
  baseUrl?: string;
  /** Model name. If omitted LM Studio uses its currently loaded model. */
  model?: string;
}

export class LmStudioProvider implements LlmProvider {
  readonly type = "lmstudio" as const;
  readonly defaultModel: string;

  private readonly baseUrl: string;

  constructor(options: LmStudioProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:1234/v1").replace(/\/$/, "");
    this.defaultModel = options.model ?? "lm-studio";
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const started = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: request.model ?? this.defaultModel,
        messages: toMessages(request),
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio endpoint failed with HTTP ${response.status}`);
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
    throw new Error("LM Studio response did not include choices");
  }
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.["message"] as Record<string, unknown> | undefined;
  const content = message?.["content"];
  if (typeof content === "string") return content;
  const text = first?.["text"];
  if (typeof text === "string") return text;
  throw new Error("LM Studio response did not include content");
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
