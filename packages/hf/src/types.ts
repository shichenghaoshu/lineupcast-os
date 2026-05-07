// @lineupcast/hf — shared LLM provider contracts

export type LlmProviderType =
  | "local-transformers"
  | "huggingface-inference-endpoint"
  | "huggingface-inference-provider"
  | "openai-compatible"
  | "openai"
  | "ollama"
  | "vllm"
  | "lmstudio"
  | "mock";

/** All supported provider types as a readonly array for runtime iteration. */
export const LLM_PROVIDER_TYPES: readonly LlmProviderType[] = [
  "local-transformers",
  "huggingface-inference-endpoint",
  "huggingface-inference-provider",
  "openai-compatible",
  "openai",
  "ollama",
  "vllm",
  "lmstudio",
  "mock",
] as const;

/** Health / status snapshot for a single provider. */
export interface LlmProviderStatus {
  provider: LlmProviderType;
  available: boolean;
  lastLatencyMs?: number;
  lastError?: string;
  lastTestedAt?: Date;
}

/** Configuration for automatic fallback between providers. */
export interface FallbackConfig {
  /** Ordered list of providers to try. First success wins. */
  chain: LlmProviderType[];
  /** If true, always end with mock as a last resort. Default true. */
  includeMockFallback?: boolean;
}

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
  /** Ollama base URL (default http://localhost:11434). */
  ollamaBaseUrl?: string;
  /** vLLM base URL. */
  vllmBaseUrl?: string;
  /** LM Studio base URL (default http://localhost:1234/v1). */
  lmstudioBaseUrl?: string;
  /** Explicit fallback chain configuration. */
  fallback?: FallbackConfig;
}
