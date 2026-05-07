// @lineupcast/ai-script — deterministic script generation from structured match data

import type {
  ScriptGenerationInput,
  ScriptGenerationOutput,
  ScriptLanguage,
  ScriptSections,
  ScriptStyle,
} from "./types.js";
import {
  sanitizeForbiddenPhrases,
  ensureModelSourceCitation,
  validateScript,
} from "./forbidden.js";
import { generateGroundingReport } from "./grounding.js";
import { buildChineseSections } from "./templates/zh.js";
import { buildEnglishSections } from "./templates/en.js";
import { buildBilingualSections } from "./templates/bilingual.js";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a structured commentary script from match data.
 *
 * This function is purely deterministic — it assembles template strings from
 * input data. It NEVER invents probabilities or absolute claims.
 * All numeric predictions come directly from `input.prediction`.
 *
 * @throws {Error} if input data is invalid (missing required fields)
 */
export function generateScript(input: ScriptGenerationInput): ScriptGenerationOutput {
  validateInput(input);

  const language = resolveLanguage(input);
  const style = normalizeStyle(input.style);
  const duration = input.duration;

  const raw = buildScriptSections(input, language, style);

  // Sanitize every field for forbidden phrases
  const sanitized: ScriptGenerationOutput = {
    opening: sanitizeForbiddenPhrases(raw.opening),
    lineupIntro: sanitizeForbiddenPhrases(raw.lineupIntro),
    tacticalBattle: sanitizeForbiddenPhrases(raw.tacticalBattle),
    predictionBrief: sanitizeForbiddenPhrases(raw.predictionBrief),
    playerFocus: sanitizeForbiddenPhrases(raw.playerFocus),
    disciplineRisk: sanitizeForbiddenPhrases(raw.disciplineRisk),
    shortVideoCaption: sanitizeForbiddenPhrases(raw.shortVideoCaption),
    teleprompterText: sanitizeForbiddenPhrases(raw.teleprompterText),
    language,
    style,
    duration,
    audience: input.audience,
    bilingualMode: language === "bilingual" ? input.bilingualMode ?? "paragraph-by-paragraph" : undefined,
  };

  // Ensure model source citation in prediction-related fields
  sanitized.predictionBrief = ensureModelSourceCitation(sanitized.predictionBrief);
  sanitized.teleprompterText = ensureModelSourceCitation(sanitized.teleprompterText);

  // Validate final output
  const validation = validateScript(sanitized, input.prediction);
  if (!validation.valid) {
    // This should not happen if our templates are correct, but guard anyway
    const issues: string[] = [];
    if (validation.forbiddenFound.length > 0) {
      issues.push(`forbidden phrases: ${validation.forbiddenFound.join(", ")}`);
    }
    if (validation.missingModelCitation) {
      issues.push("missing model source citation");
    }
    if (validation.probabilityMismatches.length > 0) {
      issues.push(`probability mismatches: ${validation.probabilityMismatches.join(", ")}`);
    }
    throw new Error(`Script validation failed: ${issues.join("; ")}`);
  }

  // Generate grounding report for traceability
  sanitized.grounding = generateGroundingReport(sanitized, input);

  return sanitized;
}

// ── Optional LLM rewrite API ─────────────────────────────────────────────────

export async function generateScriptWithLlm(
  input: ScriptGenerationInput,
  client?: {
    generateText(request: {
      prompt?: string;
      system?: string;
      fallbackText?: string;
      temperature?: number;
      maxTokens?: number;
    }): Promise<{ text: string; provider: string; model: string; latencyMs: number; tokenUsage?: unknown }>;
  },
): Promise<ScriptGenerationOutput> {
  const fallback = generateScript(input);
  if (!client) return fallback;

  const result = await client.generateText({
    system:
      "Rewrite football commentary as JSON only. Do not invent probabilities, scores, injuries, red cards, or absolute claims.",
    prompt: JSON.stringify({ input, fallback }),
    fallbackText: JSON.stringify(fallback),
    temperature: 0.2,
    maxTokens: 900,
  });

  try {
    const parsed = JSON.parse(result.text) as Partial<ScriptGenerationOutput>;
    const candidate: ScriptGenerationOutput = {
      ...fallback,
      ...pickScriptFields(parsed),
      language: fallback.language,
      style: fallback.style,
      duration: fallback.duration,
      audience: fallback.audience,
      bilingualMode: fallback.bilingualMode,
    };
    const validation = validateScript(candidate, input.prediction);
    if (validation.valid && !hasInventedPercentages(candidate, input)) {
      // Regenerate grounding for the accepted LLM rewrite
      candidate.grounding = generateGroundingReport(candidate, input);
      return candidate;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function pickScriptFields(value: Partial<ScriptGenerationOutput>): Partial<ScriptSections> {
  return {
    opening: typeof value.opening === "string" ? value.opening : undefined,
    lineupIntro: typeof value.lineupIntro === "string" ? value.lineupIntro : undefined,
    tacticalBattle: typeof value.tacticalBattle === "string" ? value.tacticalBattle : undefined,
    predictionBrief: typeof value.predictionBrief === "string" ? value.predictionBrief : undefined,
    playerFocus: typeof value.playerFocus === "string" ? value.playerFocus : undefined,
    disciplineRisk: typeof value.disciplineRisk === "string" ? value.disciplineRisk : undefined,
    shortVideoCaption: typeof value.shortVideoCaption === "string" ? value.shortVideoCaption : undefined,
    teleprompterText: typeof value.teleprompterText === "string" ? value.teleprompterText : undefined,
  };
}

function hasInventedPercentages(output: ScriptSections, input: ScriptGenerationInput): boolean {
  const allowed = new Set<number>([
    Math.round(input.prediction.homeWin * 100),
    Math.round(input.prediction.draw * 100),
    Math.round(input.prediction.awayWin * 100),
    ...input.goalScorers.flatMap((p) => normalizedPercentCandidates(p.probability)),
    ...input.cardRisks.flatMap((p) => [
      ...normalizedPercentCandidates(p.yellowRisk),
      ...normalizedPercentCandidates(p.redRisk),
    ]),
  ]);
  const allText = Object.values(output).join(" ");
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
  let match: RegExpExecArray | null;
  while ((match = percentPattern.exec(allText)) !== null) {
    const found = Number.parseFloat(match[1] ?? "");
    const known = [...allowed].some((expected) => Math.abs(expected - found) <= 1);
    if (!known) return true;
  }
  return false;
}

function normalizedPercentCandidates(value: number): number[] {
  return value <= 1 ? [Math.round(value * 100), value] : [Math.round(value), value];
}

function resolveLanguage(input: ScriptGenerationInput): ScriptLanguage {
  if (input.language) return input.language;
  return input.style === "bilingual" ? "bilingual" : "zh";
}

function normalizeStyle(style: ScriptStyle): Exclude<ScriptStyle, "bilingual"> {
  return style === "bilingual" ? "professional" : style;
}

function buildScriptSections(
  input: ScriptGenerationInput,
  language: ScriptLanguage,
  style: Exclude<ScriptStyle, "bilingual">,
): ScriptSections {
  if (language === "en") {
    return buildEnglishSections(input, style);
  }
  if (language === "bilingual") {
    return buildBilingualSections(input, style, input.bilingualMode ?? "paragraph-by-paragraph");
  }
  return buildChineseSections(input, style);
}

/**
 * Validate that required fields are present in ScriptInput.
 */
function validateInput(input: ScriptGenerationInput): void {
  if (!input.match?.id) throw new Error("ScriptInput.match.id is required");
  if (!input.lineups?.home?.teamName) throw new Error("ScriptInput.lineups.home.teamName is required");
  if (!input.lineups?.away?.teamName) throw new Error("ScriptInput.lineups.away.teamName is required");
  if (!input.prediction) throw new Error("ScriptInput.prediction is required");
  if (input.prediction.homeWin == null) throw new Error("ScriptInput.prediction.homeWin is required");
  if (input.prediction.draw == null) throw new Error("ScriptInput.prediction.draw is required");
  if (input.prediction.awayWin == null) throw new Error("ScriptInput.prediction.awayWin is required");
  if (!input.style) throw new Error("ScriptInput.style is required");
  if (!input.duration) throw new Error("ScriptInput.duration is required");
  if (!Array.isArray(input.goalScorers)) throw new Error("ScriptInput.goalScorers must be an array");
  if (!Array.isArray(input.cardRisks)) throw new Error("ScriptInput.cardRisks must be an array");
}
