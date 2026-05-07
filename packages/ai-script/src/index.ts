// @lineupcast/ai-script — generate structured commentary scripts from match data

export type {
  ScriptInput,
  ScriptOutput,
  ScriptGenerationInput,
  ScriptGenerationOutput,
  ScriptLanguage,
  ScriptStyle,
  ScriptDuration,
  BilingualMode,
  MatchLineups,
  LineupTeam,
  LineupPlayer,
  PlayerCoordinates,
  GoalScorer,
  CardRisk,
  SourceRef,
  GroundingReport,
} from "./types.js";

export { generateScript, generateScriptWithLlm } from "./generateScript.js";

export {
  sanitizeForbiddenPhrases,
  detectForbiddenPhrases,
  hasModelSourceCitation,
  ensureModelSourceCitation,
  validateProbabilitiesInText,
  validateScript,
  FORBIDDEN_PHRASES,
  FORBIDDEN_REPLACEMENTS,
  MODEL_SOURCE_ZH,
  MODEL_SOURCE_EN,
} from "./forbidden.js";

export {
  SYSTEM_PROMPT,
  DURATION_PROMPTS,
  STYLE_PROMPTS,
  buildPrompt,
  PLAYER_INTRO_TEMPLATE,
  CARD_RISK_TEMPLATE,
  SCRIPT_TEMPLATES,
} from "./templates.js";

export { scriptOutputSchema } from "./schema.js";

export type { ValidationResult } from "./forbidden.js";

export { generateGroundingReport, splitIntoSentences, summarizeGrounding } from "./grounding.js";
