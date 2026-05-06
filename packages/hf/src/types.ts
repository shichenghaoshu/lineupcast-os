// @lineupcast/hf — shared LLM provider contracts

export type LlmProviderType =
  | "local-transformers"
  | "huggingface-inference-endpoint"
  | "huggingface-inference-provider"
  | "openai-compatible"
  | "mock";

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateTextRequest {
  provider?: LlmProviderType;
  model?: string;
  prompt?: string;
  system?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  fallbackText?: string;
}

export interface GenerateTextResult {
  text: string;
  provider: LlmProviderType;
  model: string;
  latencyMs: number;
  tokenUsage?: TokenUsage;
  fallback: boolean;
  attemptedProvider?: LlmProviderType;
  error?: string;
}

export interface LlmProvider {
  readonly type: LlmProviderType;
  readonly defaultModel: string;
  generateText(request: GenerateTextRequest): Promise<GenerateTextResult>;
}

export interface HfClientOptions {
  provider?: LlmProviderType;
  model?: string;
  endpointUrl?: string;
  openAiCompatibleBaseUrl?: string;
  apiKey?: string;
}
