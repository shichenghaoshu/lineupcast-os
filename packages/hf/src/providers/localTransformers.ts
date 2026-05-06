// @lineupcast/hf — local Transformers.js adapter placeholder with safe fallback

import type { GenerateTextRequest, GenerateTextResult, LlmProvider } from "../types.js";

export class LocalTransformersProvider implements LlmProvider {
  readonly type = "local-transformers" as const;
  readonly defaultModel = "local-template";

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
