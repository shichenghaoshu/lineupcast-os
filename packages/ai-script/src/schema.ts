// @lineupcast/ai-script — JSON schema for ScriptOutput validation

/**
 * JSON Schema (draft-07) for the ScriptOutput structure.
 * Can be used by API consumers or AI/LLM pipelines to validate generated scripts.
 */
export const scriptOutputSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ScriptOutput",
  description:
    "Structured commentary script output. AI/LLM rewrites must not invent probabilities or absolute claims. All outputs include disclaimer and grounding references.",
  type: "object",
  required: [
    "opening",
    "lineupIntro",
    "tacticalBattle",
    "predictionBrief",
    "playerFocus",
    "disciplineRisk",
    "shortVideoCaption",
    "teleprompterText",
    "language",
    "style",
    "duration",
    "disclaimer",
  ],
  properties: {
    opening: {
      type: "string",
      description: "Opening line for the broadcast or video.",
    },
    lineupIntro: {
      type: "string",
      description: "Introduction of both team lineups and formations.",
    },
    tacticalBattle: {
      type: "string",
      description: "Tactical analysis of the matchup.",
    },
    predictionBrief: {
      type: "string",
      description: "Model prediction summary with probabilities sourced from input data only.",
    },
    playerFocus: {
      type: "string",
      description: "Spotlight on key players to watch.",
    },
    disciplineRisk: {
      type: "string",
      description: "Card risk and discipline analysis.",
    },
    shortVideoCaption: {
      type: "string",
      description: "Short-form caption for social media / short video platforms.",
    },
    teleprompterText: {
      type: "string",
      description: "Full teleprompter-ready script combining all sections.",
    },
    language: {
      type: "string",
      enum: ["zh", "en", "bilingual"],
      description: "Output language.",
    },
    style: {
      type: "string",
      enum: ["professional", "short-video", "passionate", "neutral", "broadcast"],
      description: "Script tone and delivery style.",
    },
    duration: {
      type: "string",
      enum: ["15s", "30s", "1min", "3min"],
      description: "Target script duration.",
    },
    audience: {
      type: "string",
      description: "Optional target audience label.",
    },
    bilingualMode: {
      type: "string",
      enum: ["separate", "paragraph-by-paragraph"],
      description: "How bilingual scripts are arranged.",
    },
    disclaimer: {
      type: "string",
      description: "Disclaimer text. AI narrates, never directly predicts outcomes. Not betting advice.",
    },
    grounding: {
      type: "array",
      description: "Grounding report: traceability for each sentence back to input data sources.",
      items: {
        type: "object",
        properties: {
          sentenceIndex: { type: "number" },
          sentence: { type: "string" },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                provider: { type: "string" },
                sourceType: { type: "string", enum: ["prediction", "lineup", "stats", "form"] },
                sourcePath: { type: "string" },
                confidence: { type: "number" },
              },
            },
          },
          confidence: { type: "number" },
        },
      },
    },
  },
  additionalProperties: false,
} as const;
