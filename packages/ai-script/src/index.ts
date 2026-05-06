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
} from "./types";

export { generateScript, generateScriptWithLlm } from "./generateScript";

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
} from "./forbidden";

export {
  SYSTEM_PROMPT,
  DURATION_PROMPTS,
  STYLE_PROMPTS,
  buildPrompt,
  PLAYER_INTRO_TEMPLATE,
  CARD_RISK_TEMPLATE,
  SCRIPT_TEMPLATES,
} from "./templates";

export { scriptOutputSchema } from "./schema";

export type { ValidationResult } from "./forbidden";
