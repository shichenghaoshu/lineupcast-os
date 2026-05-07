// @lineupcast/ai-script — English script templates with grounding placeholder refs

import type { ScriptDuration, ScriptStyle } from "../types.js";
import type { TemplateSourceAnnotation } from "./zh.js";

/**
 * A script template section with grounding annotations (English).
 */
export interface EnScriptTemplateSection {
  template: string;
  sourceRefs: TemplateSourceAnnotation[];
}

/**
 * Complete English template set for a given duration + style combination.
 */
export interface EnScriptTemplateSet {
  opening: EnScriptTemplateSection;
  lineupIntro: EnScriptTemplateSection;
  tacticalBattle: EnScriptTemplateSection;
  predictionBrief: EnScriptTemplateSection;
  playerFocus: EnScriptTemplateSection;
  disciplineRisk: EnScriptTemplateSection;
  shortVideoCaption: EnScriptTemplateSection;
}

/**
 * Standard English disclaimer required on all outputs.
 */
export const EN_DISCLAIMER = "For commentary assistance only, not betting advice. Models calculate probabilities, AI narrates.";

const MODEL_REF = "Based on Dixon-Coles with lineup adjustment model";

// ── 15s templates ─────────────────────────────────────────────────────────────

const en_15s_professional: EnScriptTemplateSet = {
  opening: {
    template: `{{homeName}} vs {{awayName}}: a quick data preview. ${MODEL_REF}.`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
  lineupIntro: {
    template: `{{homeName}} set up in {{homeFormation}}, {{awayName}} respond with {{awayFormation}}.`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
    ],
  },
  tacticalBattle: { template: `Key tactical matchup.`, sourceRefs: [] },
  predictionBrief: {
    template: `${MODEL_REF}: {{homeName}} win {{homeWinPct}}%, draw {{drawPct}}%, {{awayName}} win {{awayWinPct}}%. {{leading}}.`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
  playerFocus: {
    template: `Players to watch: {{scorerNames}}.`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Goal scorers" },
    ],
  },
  disciplineRisk: { template: `Discipline risk note.`, sourceRefs: [] },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}} | Model {{homeWinPct}}%-{{drawPct}}%-{{awayWinPct}}% | #LineupCast #FootballPrediction | ${EN_DISCLAIMER}`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
};

const en_15s_shortvideo: EnScriptTemplateSet = {
  opening: {
    template: `{{homeName}} vs {{awayName}}: a quick {{league}} data preview.`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "form", sourcePath: "match.league", description: "League name" },
    ],
  },
  lineupIntro: {
    template: `{{homeName}} {{homeFormation}} vs {{awayName}} {{awayFormation}}. Shape comparison: compact tactical matchup.`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
    ],
  },
  tacticalBattle: {
    template: `Tactically, {{homeName}} lean on {{homeTop}}; {{awayName}} look to {{awayTop}}. The model treats this as a probability-led contest.`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.players", description: "Home key players" },
      { sourceType: "lineup", sourcePath: "lineups.away.players", description: "Away key players" },
    ],
  },
  predictionBrief: {
    template: `${MODEL_REF}: {{homeName}} {{homeWinPct}}% | Draw {{drawPct}}% | {{awayName}} {{awayWinPct}}%. Expected goals: {{homeName}} {{xGH}} - {{awayName}} {{xGA}}. {{leading}}.`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
      { sourceType: "prediction", sourcePath: "prediction.expectedHomeGoals", description: "Expected home goals" },
      { sourceType: "prediction", sourcePath: "prediction.expectedAwayGoals", description: "Expected away goals" },
    ],
  },
  playerFocus: {
    template: `Goal scorer watch: {{scorerText}}. These probabilities come from the supplied player model values.`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Goal scorers with probabilities" },
    ],
  },
  disciplineRisk: {
    template: `Discipline watch: {{cardText}}. Treat these as risk signals, not certain card events.`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "cardRisks", description: "Card risk data" },
    ],
  },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}} | Model probabilities {{homeWinPct}}%-{{drawPct}}%-{{awayWinPct}}% | #LineupCast #FootballPrediction | ${EN_DISCLAIMER}`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
};

const en_15s_broadcast: EnScriptTemplateSet = {
  ...en_15s_professional,
  opening: {
    template: `Welcome to this {{league}} preview: {{homeName}} host {{awayName}}. ${MODEL_REF}, here is the pre-match read.`,
    sourceRefs: [
      { sourceType: "form", sourcePath: "match.league", description: "League name" },
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
};

const en_15s_passionate: EnScriptTemplateSet = {
  ...en_15s_professional,
  opening: {
    template: `What a match we have in store! {{homeName}} versus {{awayName}} in the {{league}}! ${MODEL_REF} — let us break down the data!`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "form", sourcePath: "match.league", description: "League name" },
    ],
  },
};

const en_15s_neutral: EnScriptTemplateSet = {
  ...en_15s_professional,
};

// ── 30s templates ─────────────────────────────────────────────────────────────

const en_30s_professional: EnScriptTemplateSet = {
  ...en_15s_shortvideo,
  opening: {
    template: `Welcome to this {{league}} preview: {{homeName}} host {{awayName}}. ${MODEL_REF}, here is the pre-match read.`,
    sourceRefs: [
      { sourceType: "form", sourcePath: "match.league", description: "League name" },
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
};

// ── 1min and 3min ─────────────────────────────────────────────────────────────

const en_1min_professional: EnScriptTemplateSet = {
  ...en_30s_professional,
  tacticalBattle: {
    template: `Tactically, {{homeName}} lean on {{homeTop}}; {{awayName}} look to {{awayTop}}. The model treats this as a probability-led contest, not a fixed outcome. Both formations aim to control the midfield.`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.players", description: "Home key players" },
      { sourceType: "lineup", sourcePath: "lineups.away.players", description: "Away key players" },
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
    ],
  },
};

const en_3min_professional: EnScriptTemplateSet = {
  ...en_1min_professional,
  disciplineRisk: {
    template: `Discipline watch: {{cardText}}. Treat these as risk signals, not certain card events. Players should be mindful of their positioning and challenges.`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "cardRisks", description: "Card risk data" },
    ],
  },
};

// ── Style variants ────────────────────────────────────────────────────────────

const en_30s_shortvideo: EnScriptTemplateSet = { ...en_15s_shortvideo };
const en_30s_broadcast: EnScriptTemplateSet = { ...en_30s_professional };
const en_30s_passionate: EnScriptTemplateSet = { ...en_15s_passionate };
const en_30s_neutral: EnScriptTemplateSet = { ...en_30s_professional };

// ── Template registry ─────────────────────────────────────────────────────────

type EnTemplateKey = `${ScriptDuration}_${Exclude<ScriptStyle, "bilingual">}`;

export const EN_TEMPLATES: Record<EnTemplateKey, EnScriptTemplateSet> = {
  "15s_professional": en_15s_professional,
  "15s_short-video": en_15s_shortvideo,
  "15s_broadcast": en_15s_broadcast,
  "15s_passionate": en_15s_passionate,
  "15s_neutral": en_15s_neutral,
  "30s_professional": en_30s_professional,
  "30s_short-video": en_30s_shortvideo,
  "30s_broadcast": en_30s_broadcast,
  "30s_passionate": en_30s_passionate,
  "30s_neutral": en_30s_neutral,
  "1min_professional": en_1min_professional,
  "1min_short-video": en_30s_shortvideo,
  "1min_broadcast": en_1min_professional,
  "1min_passionate": en_30s_passionate,
  "1min_neutral": en_1min_professional,
  "3min_professional": en_3min_professional,
  "3min_short-video": en_30s_shortvideo,
  "3min_broadcast": en_3min_professional,
  "3min_passionate": en_30s_passionate,
  "3min_neutral": en_3min_professional,
};

/**
 * Get the English template for a given duration and style.
 * Falls back to professional style if the exact combination is not found.
 */
export function getEnTemplate(
  duration: ScriptDuration,
  style: Exclude<ScriptStyle, "bilingual">,
): EnScriptTemplateSet {
  const key: EnTemplateKey = `${duration}_${style}`;
  return EN_TEMPLATES[key] ?? EN_TEMPLATES[`${duration}_professional`] ?? en_30s_professional;
}
