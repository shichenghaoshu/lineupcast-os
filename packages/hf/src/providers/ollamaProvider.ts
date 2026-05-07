// @lineupcast/hf — Ollama local LLM adapter (/api/generate)

import type {
  GenerateTextRequest,
  GenerateTextResult,
  LlmProvider,
  TokenUsage,
} from "../types.js";

export interface OllamaProviderOptions {
  /** Ollama server base URL. Default: http://localhost:11434 */
  baseUrl?: string;
  /** Model name to use (e.g. "llama3", "mistral"). */
  model?: string;
}

export class OllamaProvider implements LlmProvider {
  readonly type = "ollama" as const;
  readonly defaultModel: string;

  private readonly baseUrl: string;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.defaultModel = options.model ?? "llama3";
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResult> {
    const started = Date.now();
    const prompt = buildPrompt(request);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: request.model ?? this.defaultModel,
        prompt,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama endpoint failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const text = typeof json["response"] === "string" ? json["response"] : "";

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

function buildPrompt(request: GenerateTextRequest): string {
  if (request.messages?.length) {
    return request.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  }
  return [request.system, request.prompt].filter(Boolean).join("\n\n");
}

function extractTokenUsage(json: Record<string, unknown>): TokenUsage | undefined {
  const evalCount = json["eval_count"];
  const promptEvalCount = json["prompt_eval_count"];
  if (typeof evalCount !== "number" && typeof promptEvalCount !== "number") return undefined;
  return {
    promptTokens: typeof promptEvalCount === "number" ? promptEvalCount : undefined,
    completionTokens: typeof evalCount === "number" ? evalCount : undefined,
    totalTokens:
      typeof evalCount === "number" && typeof promptEvalCount === "number"
        ? evalCount + promptEvalCount
        : undefined,
  };
}
