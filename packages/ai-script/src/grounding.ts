// @lineupcast/ai-script — grounding reports for script traceability

import type {
  ScriptGenerationInput,
  ScriptGenerationOutput,
  ScriptSections,
  SourceRef,
  GroundingReport,
} from "./types.js";

// Re-export for convenience
export type { SourceRef, GroundingReport } from "./types.js";

/**
 * Section name to field-path mapping.
 * Each entry lists the JSON pointer paths into ScriptGenerationInput
 * that the section builder reads.
 */
const SECTION_FIELD_MAP: Record<keyof ScriptSections, string[]> = {
  opening: [
    "lineups.home.teamName",
    "lineups.away.teamName",
    "match.league",
    "style",
    "duration",
  ],
  lineupIntro: [
    "lineups.home.teamName",
    "lineups.away.teamName",
    "lineups.home.formation",
    "lineups.away.formation",
    "lineups.home.players",
    "lineups.away.players",
  ],
  tacticalBattle: [
    "lineups.home.teamName",
    "lineups.away.teamName",
    "lineups.home.formation",
    "lineups.away.formation",
    "lineups.home.players",
    "lineups.away.players",
  ],
  predictionBrief: [
    "lineups.home.teamName",
    "lineups.away.teamName",
    "prediction.homeWin",
    "prediction.draw",
    "prediction.awayWin",
    "prediction.expectedHomeGoals",
    "prediction.expectedAwayGoals",
    "prediction.confidence",
  ],
  playerFocus: [
    "lineups.home.teamName",
    "lineups.away.teamName",
    "lineups.home.players",
    "lineups.away.players",
    "goalScorers",
  ],
  disciplineRisk: [
    "cardRisks",
  ],
  shortVideoCaption: [
    "lineups.home.teamName",
    "lineups.away.teamName",
    "prediction.homeWin",
    "prediction.awayWin",
    "goalScorers",
  ],
  teleprompterText: [
    // teleprompter is an assembly of other sections; it references everything
    "lineups.home.teamName",
    "lineups.away.teamName",
    "lineups.home.formation",
    "lineups.away.formation",
    "lineups.home.players",
    "lineups.away.players",
    "match.league",
    "prediction.homeWin",
    "prediction.draw",
    "prediction.awayWin",
    "prediction.expectedHomeGoals",
    "prediction.expectedAwayGoals",
    "prediction.confidence",
    "goalScorers",
    "cardRisks",
    "style",
    "duration",
  ],
};

/**
 * Provider names for different data categories.
 */
const PROVIDER_MAP: Record<string, string> = {
  "match": "match-provider",
  "lineups": "lineup-provider",
  "prediction": "prediction-model",
  "goalScorers": "scorer-model",
  "cardRisks": "discipline-model",
  "style": "user-config",
  "duration": "user-config",
  "language": "user-config",
  "audience": "user-config",
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a grounding report for a script output.
 *
 * For each sentence in the script, traces which input fields were used
 * and assigns a confidence score based on data density vs template filler.
 *
 * The report is deterministic — same input always produces the same report.
 *
 * @param script - The generated script output
 * @param input  - The original script generation input
 * @returns Array of grounding reports, one per sentence
 */
export function generateGroundingReport(
  script: ScriptGenerationOutput,
  input: ScriptGenerationInput,
): GroundingReport[] {
  const reports: GroundingReport[] = [];
  let sentenceIndex = 0;

  // Process each section in canonical order
  const sectionOrder: (keyof ScriptSections)[] = [
    "opening",
    "lineupIntro",
    "tacticalBattle",
    "predictionBrief",
    "playerFocus",
    "disciplineRisk",
    "shortVideoCaption",
  ];

  for (const sectionName of sectionOrder) {
    const sectionText = script[sectionName];
    if (!sectionText) continue;

    const sentences = splitIntoSentences(sectionText);
    const fieldPaths = SECTION_FIELD_MAP[sectionName];

    for (const sentence of sentences) {
      const sources = resolveSources(fieldPaths, input, sentence);
      const confidence = computeConfidence(sentence, sources);

      reports.push({
        sentenceIndex,
        sentence,
        sources,
        confidence,
      });
      sentenceIndex += 1;
    }
  }

  return reports;
}

// ── Sentence splitting ────────────────────────────────────────────────────────

/**
 * Split a section of text into individual sentences.
 * Handles both Chinese and English sentence boundaries.
 */
export function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation: Chinese full stop, exclamation,
  // question mark, semicolons, and their English equivalents.
  // Also split on paragraph breaks.
  const raw = text
    .split(/\n\n+/)
    .flatMap((para) => para.split(/(?<=[。！？；.!?;])\s*/));

  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ── Source resolution ─────────────────────────────────────────────────────────

/**
 * Resolve which input fields are referenced by a sentence.
 * Uses content matching: checks whether values from each field
 * actually appear in the sentence text.
 */
function resolveSources(
  fieldPaths: string[],
  input: ScriptGenerationInput,
  sentence: string,
): SourceRef[] {
  const sources: SourceRef[] = [];
  const seen = new Set<string>();

  for (const path of fieldPaths) {
    const values = extractFieldValues(path, input);

    for (const { value, displayValue } of values) {
      // Check if the display value appears in the sentence
      if (displayValue != null && sentenceContains(sentence, String(displayValue))) {
        const key = `${path}:${String(displayValue)}`;
        if (!seen.has(key)) {
          seen.add(key);
          sources.push({
            field: path,
            value,
            provider: resolveProvider(path),
          });
        }
      }
    }

    // For array/object fields, also check if any item value appears
    if (sources.length === 0 || !sources.some((s) => s.field === path)) {
      const fieldValue = getNestedValue(input, path);
      if (fieldValue !== undefined && isReferencedInSentence(sentence, path, fieldValue)) {
        if (!seen.has(path)) {
          seen.add(path);
          sources.push({
            field: path,
            value: fieldValue,
            provider: resolveProvider(path),
          });
        }
      }
    }
  }

  // If no specific fields matched, mark as template-only
  if (sources.length === 0) {
    sources.push({
      field: "(template)",
      value: null,
      provider: "template",
    });
  }

  return sources;
}

/**
 * Extract display-relevant values from a field path.
 * Returns an array of { value, displayValue } pairs.
 */
function extractFieldValues(
  path: string,
  input: ScriptGenerationInput,
): Array<{ value: unknown; displayValue: unknown }> {
  const results: Array<{ value: unknown; displayValue: unknown }> = [];

  switch (path) {
    case "lineups.home.teamName":
      results.push({ value: input.lineups.home.teamName, displayValue: input.lineups.home.teamName });
      break;
    case "lineups.away.teamName":
      results.push({ value: input.lineups.away.teamName, displayValue: input.lineups.away.teamName });
      break;
    case "lineups.home.formation":
      results.push({ value: input.lineups.home.formation, displayValue: input.lineups.home.formation });
      break;
    case "lineups.away.formation":
      results.push({ value: input.lineups.away.formation, displayValue: input.lineups.away.formation });
      break;
    case "match.league":
      results.push({ value: input.match.league, displayValue: input.match.league });
      break;
    case "prediction.homeWin": {
      const pct = Math.round(input.prediction.homeWin * 100);
      results.push({ value: input.prediction.homeWin, displayValue: `${pct}%` });
      break;
    }
    case "prediction.draw": {
      const pct = Math.round(input.prediction.draw * 100);
      results.push({ value: input.prediction.draw, displayValue: `${pct}%` });
      break;
    }
    case "prediction.awayWin": {
      const pct = Math.round(input.prediction.awayWin * 100);
      results.push({ value: input.prediction.awayWin, displayValue: `${pct}%` });
      break;
    }
    case "prediction.expectedHomeGoals":
      results.push({
        value: input.prediction.expectedHomeGoals,
        displayValue: input.prediction.expectedHomeGoals.toFixed(1),
      });
      break;
    case "prediction.expectedAwayGoals":
      results.push({
        value: input.prediction.expectedAwayGoals,
        displayValue: input.prediction.expectedAwayGoals.toFixed(1),
      });
      break;
    case "prediction.confidence":
      results.push({ value: input.prediction.confidence, displayValue: input.prediction.confidence });
      break;
    case "lineups.home.players":
      for (const p of input.lineups.home.players) {
        results.push({ value: p, displayValue: p.name });
      }
      break;
    case "lineups.away.players":
      for (const p of input.lineups.away.players) {
        results.push({ value: p, displayValue: p.name });
      }
      break;
    case "goalScorers":
      for (const gs of input.goalScorers) {
        results.push({ value: gs, displayValue: gs.player });
        results.push({ value: gs, displayValue: `${gs.probability}%` });
      }
      break;
    case "cardRisks":
      for (const cr of input.cardRisks) {
        results.push({ value: cr, displayValue: cr.player });
        results.push({ value: cr, displayValue: `${cr.yellowRisk}` });
      }
      break;
    case "style":
      results.push({ value: input.style, displayValue: null }); // style doesn't appear in text
      break;
    case "duration":
      results.push({ value: input.duration, displayValue: null }); // duration doesn't appear in text
      break;
    default:
      break;
  }

  return results;
}

/**
 * Check if a sentence contains a specific value string.
 */
function sentenceContains(sentence: string, value: string): boolean {
  if (!value || value.length === 0) return false;
  return sentence.includes(value);
}

/**
 * Check if a field value is referenced in a sentence via heuristic matching.
 */
function isReferencedInSentence(
  sentence: string,
  _path: string,
  value: unknown,
): boolean {
  // For player arrays, check if any player name appears
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "object" && item !== null && "name" in item) {
        if (sentence.includes(String(item.name))) return true;
      }
      if (typeof item === "object" && item !== null && "player" in item) {
        if (sentence.includes(String(item.player))) return true;
      }
    }
    return false;
  }

  // For objects with a name field
  if (typeof value === "object" && value !== null && "name" in value) {
    return sentence.includes(String((value as { name: string }).name));
  }

  // For strings
  if (typeof value === "string") {
    return sentence.includes(value);
  }

  // For numbers, check if the stringified form appears
  if (typeof value === "number") {
    return sentence.includes(String(value));
  }

  return false;
}

/**
 * Get a nested value from an object using a dot-separated path.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Resolve the provider name for a field path.
 */
function resolveProvider(path: string): string {
  // Match the top-level key
  const topLevel = path.split(".")[0];
  if (topLevel && topLevel in PROVIDER_MAP) {
    return PROVIDER_MAP[topLevel];
  }
  return "unknown";
}

// ── Confidence scoring ────────────────────────────────────────────────────────

/**
 * Compute confidence score (0-1) for how much of a sentence is grounded
 * in actual input data vs template/boilerplate text.
 *
 * Heuristic: count how many characters in the sentence come from data values
 * (team names, player names, numbers) vs template filler.
 */
function computeConfidence(sentence: string, sources: SourceRef[]): number {
  if (sources.length === 0) return 0;
  if (sources.length === 1 && sources[0]?.field === "(template)") return 0.2;

  // Count characters that come from source values
  let dataChars = 0;
  const counted = new Set<string>();

  for (const source of sources) {
    if (source.value == null) continue;

    const displayValues = getDisplayValues(source);
    for (const dv of displayValues) {
      const str = String(dv);
      if (!counted.has(str) && sentence.includes(str)) {
        dataChars += str.length;
        counted.add(str);
      }
    }
  }

  // Template filler characters
  const totalChars = sentence.length;
  if (totalChars === 0) return 0;

  const ratio = dataChars / totalChars;

  // Apply a scaling factor: template text is expected, so even 20% data is decent
  // Clamp to [0.1, 1.0]
  return Math.min(1, Math.max(0.1, ratio * 2.5));
}

/**
 * Get display-relevant values from a SourceRef for confidence calculation.
 */
function getDisplayValues(source: SourceRef): unknown[] {
  const values: unknown[] = [];

  if (source.value == null) return values;

  if (typeof source.value === "object" && !Array.isArray(source.value)) {
    // For objects like GoalScorer, CardRisk, LineupPlayer
    const obj = source.value as Record<string, unknown>;
    if ("name" in obj) values.push(obj.name);
    if ("player" in obj) values.push(obj.player);
    if ("team" in obj) values.push(obj.team);
    if ("probability" in obj) values.push(`${obj.probability}%`);
    if ("yellowRisk" in obj) values.push(String(obj.yellowRisk));
    if ("formation" in obj) values.push(obj.formation);
    if ("teamName" in obj) values.push(obj.teamName);
  } else {
    values.push(source.value);
  }

  return values;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Get a summary of grounding coverage for a report.
 */
export function summarizeGrounding(reports: GroundingReport[]): {
  totalSentences: number;
  avgConfidence: number;
  fullyGrounded: number;
  partiallyGrounded: number;
  ungrounded: number;
  uniqueFields: string[];
} {
  const totalSentences = reports.length;
  const avgConfidence =
    totalSentences > 0
      ? reports.reduce((sum, r) => sum + r.confidence, 0) / totalSentences
      : 0;

  let fullyGrounded = 0;
  let partiallyGrounded = 0;
  let ungrounded = 0;
  const uniqueFieldSet = new Set<string>();

  for (const report of reports) {
    const hasRealSources = report.sources.some((s) => s.field !== "(template)");
    if (!hasRealSources) {
      ungrounded += 1;
    } else if (report.confidence >= 0.6) {
      fullyGrounded += 1;
    } else {
      partiallyGrounded += 1;
    }

    for (const source of report.sources) {
      uniqueFieldSet.add(source.field);
    }
  }

  return {
    totalSentences,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    fullyGrounded,
    partiallyGrounded,
    ungrounded,
    uniqueFields: [...uniqueFieldSet].sort(),
  };
}
