// @lineupcast/ai-script — forbidden phrase blocking and cautious language enforcement

import type { ScriptSections } from "./types.js";

/**
 * Phrases that must never appear in generated scripts.
 * AI/LLM rewrites must not invent probabilities or absolute claims.
 * Includes Chinese and English forbidden phrases.
 */
const FORBIDDEN_PHRASES: readonly string[] = [
  // Chinese forbidden phrases
  "稳赢",
  "必进",
  "一定红牌",
  "必胜",
  "肯定进球",
  "稳赚",
  "包中",
  "确定进球",
  // English forbidden phrases
  "guaranteed",
  "guaranteed win",
  "sure bet",
  "must score",
  "certain red card",
  "definite goal",
  "100% win",
] as const;

/**
 * Mapping of forbidden phrases to cautious replacements.
 */
const FORBIDDEN_REPLACEMENTS: Readonly<Record<string, string>> = {
  // Chinese
  稳赢: "概率上占优",
  必进: "更值得关注的得分点",
  一定红牌: "风险偏高",
  必胜: "更被看好",
  肯定进球: "有较高概率破门",
  稳赚: "模型认为有优势",
  包中: "概率较高",
  确定进球: "破门概率较高",
  // English
  guaranteed: "model-estimated",
  "guaranteed win": "model-estimated higher probability",
  "sure bet": "model-favored outcome",
  "must score": "higher scoring probability",
  "certain red card": "elevated discipline risk",
  "definite goal": "model-predicted scoring opportunity",
  "100% win": "model-estimated probability",
};

/**
 * Gambling-adjacent phrases that must never appear in generated scripts.
 * These terms imply financial advice or betting recommendations.
 */
const GAMBLING_ADJACENT_PHRASES: readonly string[] = [
  // Chinese gambling-adjacent
  "下注",
  "押注",
  "投注",
  "赔率",
  "盘口",
  "水位",
  "让球",
  "大小球",
  "走地",
  "滚球",
  "串关",
  "稳赚不赔",
  "回血",
  "上岸",
  "梭哈",
  "倍投",
  // English gambling-adjacent
  "place a bet",
  "bet on",
  "odds",
  "spread",
  "parlay",
  "accumulator",
  "moneyline",
  "over under",
  "banker bet",
  "value bet",
  "lock of the day",
  "sure thing",
  "can't lose",
  "risk-free",
] as const;

/**
 * Replacement text for gambling-adjacent phrases.
 */
const GAMBLING_REPLACEMENT = "[内容已移除：不涉及投注建议]";


const MODEL_SOURCE_ZH = "根据 Dixon-Coles 与阵容修正模型";
const MODEL_SOURCE_EN = "Based on Dixon-Coles with lineup adjustment model";

/**
 * Standard disclaimers for script outputs.
 */
export const DISCLAIMER_ZH = "本内容仅供参考分析，不构成任何投注建议。AI辅助解说，模型计算概率，AI负责叙述。";
export const DISCLAIMER_EN = "For commentary assistance only, not betting advice. Models calculate probabilities, AI narrates.";
export const DISCLAIMER_BILINGUAL = `${DISCLAIMER_ZH}\n${DISCLAIMER_EN}`;

/**
 * Replace all forbidden phrases in text with cautious alternatives.
 * Returns the sanitized text.
 */
export function sanitizeForbiddenPhrases(text: string): string {
  let result = text;
  for (const [forbidden, replacement] of Object.entries(FORBIDDEN_REPLACEMENTS)) {
    // Case-insensitive replacement
    const regex = new RegExp(escapeRegExp(forbidden), "gi");
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Replace gambling-adjacent phrases in text.
 * Returns the sanitized text.
 */
export function sanitizeGamblingPhrases(text: string): string {
  let result = text;
  for (const phrase of GAMBLING_ADJACENT_PHRASES) {
    const regex = new RegExp(escapeRegExp(phrase), "gi");
    result = result.replace(regex, GAMBLING_REPLACEMENT);
  }
  return result;
}

/**
 * Check if text contains any forbidden phrases.
 * Returns list of found forbidden phrases.
 */
export function detectForbiddenPhrases(text: string): string[] {
  const found: string[] = [];
  for (const phrase of FORBIDDEN_PHRASES) {
    const regex = new RegExp(escapeRegExp(phrase), "gi");
    if (regex.test(text)) {
      found.push(phrase);
    }
  }
  return found;
}

/**
 * Check if text contains any gambling-adjacent phrases.
 * Returns list of found gambling phrases.
 */
export function detectGamblingPhrases(text: string): string[] {
  const found: string[] = [];
  for (const phrase of GAMBLING_ADJACENT_PHRASES) {
    const regex = new RegExp(escapeRegExp(phrase), "gi");
    if (regex.test(text)) {
      found.push(phrase);
    }
  }
  return found;
}

/**
 * Full sanitize: apply both forbidden and gambling-adjacent phrase replacement.
 */
export function sanitizeAll(text: string): string {
  return sanitizeGamblingPhrases(sanitizeForbiddenPhrases(text));
}

/**
 * Check if text contains at least one model source citation.
 */
export function hasModelSourceCitation(text: string): boolean {
  return text.includes(MODEL_SOURCE_ZH) || text.includes(MODEL_SOURCE_EN);
}

/**
 * Append model source citation to text if not already present.
 */
export function ensureModelSourceCitation(text: string): string {
  if (hasModelSourceCitation(text)) {
    return text;
  }
  return `${text} ${MODEL_SOURCE_ZH}。`;
}

/**
 * Check that all probabilities mentioned in the script text match the input prediction.
 * Returns list of mismatched probability strings found in text.
 */
/**
 * Validate that match-level prediction probabilities in text match the input.
 * Only validates the predictionBrief field (not playerFocus which has goal scorer %).
 *
 * @param predictionText - text from the predictionBrief field only
 * @param prediction - the input prediction object
 */
export function validateProbabilitiesInText(
  predictionText: string,
  prediction: { homeWin: number; draw: number; awayWin: number },
): string[] {
  const mismatches: string[] = [];
  // Look for percentage patterns like "45%" or "45.2%"
  const percentPattern = /(\d+(?:\.\d+)?)\s*%/g;
  let match: RegExpExecArray | null;

  const expectedPercentages = new Set([
    Math.round(prediction.homeWin * 100),
    Math.round(prediction.draw * 100),
    Math.round(prediction.awayWin * 100),
  ]);

  while ((match = percentPattern.exec(predictionText)) !== null) {
    const found = parseFloat(match[1]);
    if (!expectedPercentages.has(found)) {
      // Accept small floating-point drift
      const isCloseToExpected = [...expectedPercentages].some(
        (expected) => Math.abs(expected - found) <= 1,
      );
      if (!isCloseToExpected) {
        mismatches.push(match[0]);
      }
    }
  }
  return mismatches;
}

/**
 * Full validation of a ScriptOutput: checks forbidden phrases, gambling phrases,
 * model citations, and probability consistency.
 */
export interface ValidationResult {
  valid: boolean;
  /** Flat list of all violation descriptions */
  violations: string[];
  forbiddenFound: string[];
  gamblingFound: string[];
  missingModelCitation: boolean;
  probabilityMismatches: string[];
}

export function validateScript(
  output: ScriptSections | { [K: string]: unknown },
  prediction: { homeWin: number; draw: number; awayWin: number },
): ValidationResult {
  const allText = Object.values(output)
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const forbiddenFound = detectForbiddenPhrases(allText);
  const gamblingFound = detectGamblingPhrases(allText);
  const missingModelCitation = !hasModelSourceCitation(allText);
  // Only validate probabilities in predictionBrief, not in playerFocus (which has goal scorer %)
  const predictionBrief = "predictionBrief" in output ? String(output["predictionBrief"]) : "";
  const probabilityMismatches = validateProbabilitiesInText(predictionBrief, prediction);

  // Build flat violations list
  const violations: string[] = [];
  for (const phrase of forbiddenFound) {
    violations.push(`forbidden phrase: "${phrase}"`);
  }
  for (const phrase of gamblingFound) {
    violations.push(`gambling-adjacent phrase: "${phrase}"`);
  }
  if (missingModelCitation) {
    violations.push("missing model source citation");
  }
  for (const mismatch of probabilityMismatches) {
    violations.push(`probability mismatch: ${mismatch}`);
  }

  return {
    valid: violations.length === 0,
    violations,
    forbiddenFound,
    gamblingFound,
    missingModelCitation,
    probabilityMismatches,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export {
  FORBIDDEN_PHRASES,
  FORBIDDEN_REPLACEMENTS,
  GAMBLING_ADJACENT_PHRASES,
  MODEL_SOURCE_ZH,
  MODEL_SOURCE_EN,
};
