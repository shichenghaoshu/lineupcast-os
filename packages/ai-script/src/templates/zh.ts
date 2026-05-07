// @lineupcast/ai-script — Chinese script templates with grounding placeholder refs

import type { ScriptDuration, ScriptStyle } from "../types.js";

/**
 * Source ref annotation for grounding traceability.
 * Each template section is annotated with which source types it draws from.
 */
export interface TemplateSourceAnnotation {
  sourceType: "prediction" | "lineup" | "stats" | "form";
  sourcePath: string;
  description: string;
}

/**
 * A script template section with grounding annotations.
 */
export interface ScriptTemplateSection {
  /** Template string with {{placeholder}} markers */
  template: string;
  /** Grounding annotations for each placeholder in the template */
  sourceRefs: TemplateSourceAnnotation[];
}

/**
 * Complete template set for a given duration + style combination.
 */
export interface ZhScriptTemplateSet {
  opening: ScriptTemplateSection;
  lineupIntro: ScriptTemplateSection;
  tacticalBattle: ScriptTemplateSection;
  predictionBrief: ScriptTemplateSection;
  playerFocus: ScriptTemplateSection;
  disciplineRisk: ScriptTemplateSection;
  shortVideoCaption: ScriptTemplateSection;
}

// ── Template definitions ──────────────────────────────────────────────────────

const MODEL_REF = "根据 Dixon-Coles 与阵容修正模型";

// ── 15s templates ─────────────────────────────────────────────────────────────

const zh_15s_professional: ZhScriptTemplateSet = {
  opening: {
    template: `{{homeName}}对阵{{awayName}}，${MODEL_REF}数据速览。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "prediction", sourcePath: "prediction", description: "Model reference" },
    ],
  },
  lineupIntro: {
    template: `{{homeName}}{{homeFormation}}迎战{{awayName}}{{awayFormation}}。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
    ],
  },
  tacticalBattle: {
    template: `关键对决看点。`,
    sourceRefs: [],
  },
  predictionBrief: {
    template: `${MODEL_REF}：{{homeName}} {{homeWinPct}}% vs {{awayName}} {{awayWinPct}}%，平局{{drawPct}}%。{{leading}}。`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
  playerFocus: {
    template: `进球热门：{{scorerNames}}。`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Top goal scorers" },
    ],
  },
  disciplineRisk: {
    template: `纪律风险提示。`,
    sourceRefs: [],
  },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}}｜{{homeWinPct}}% vs {{awayWinPct}}%｜模型数据解读 #足球预测 #LineupCast`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
};

const zh_15s_shortvideo: ZhScriptTemplateSet = {
  opening: {
    template: `{{homeName}} vs {{awayName}}！{{league}}焦点之战，${MODEL_REF}为你拆解。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "form", sourcePath: "match.league", description: "League name" },
    ],
  },
  lineupIntro: {
    template: `{{homeName}}{{homeFormation}}迎战{{awayName}}{{awayFormation}}！阵容配置如何？一起来看。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
    ],
  },
  tacticalBattle: {
    template: `关键对决：{{homeKeyNames}} vs {{awayKeyNames}}。{{xgComparison}}，这场更值得关注！`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.players", description: "Home key players" },
      { sourceType: "lineup", sourcePath: "lineups.away.players", description: "Away key players" },
      { sourceType: "stats", sourcePath: "lineups.home.players.xGLast5", description: "xG comparison" },
    ],
  },
  predictionBrief: {
    template: `${MODEL_REF}：{{homeName}} {{homeWinPct}}% vs {{awayName}} {{awayWinPct}}%，平局{{drawPct}}%。{{leading}}！`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
    ],
  },
  playerFocus: {
    template: `进球热门：{{scorerLines}}！`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Goal scorers with probabilities" },
    ],
  },
  disciplineRisk: {
    template: `纪律风险提示。`,
    sourceRefs: [],
  },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}}｜{{homeWinPct}}% vs {{awayWinPct}}%{{scorerPart}}｜模型数据解读 #足球预测 #LineupCast`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
      { sourceType: "stats", sourcePath: "goalScorers", description: "Top goal scorer" },
    ],
  },
};

const zh_15s_broadcast: ZhScriptTemplateSet = {
  opening: {
    template: `各位观众，{{homeName}}对阵{{awayName}}，${MODEL_REF}为您解读。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
  lineupIntro: {
    template: `双方阵型：{{homeName}}{{homeFormation}}，{{awayName}}{{awayFormation}}。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
    ],
  },
  tacticalBattle: { template: `战术看点。`, sourceRefs: [] },
  predictionBrief: {
    template: `${MODEL_REF}：{{homeName}} {{homeWinPct}}%，平局{{drawPct}}%，{{awayName}} {{awayWinPct}}%。`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
  playerFocus: {
    template: `关注：{{scorerNames}}。`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Goal scorers" },
    ],
  },
  disciplineRisk: { template: `纪律提醒。`, sourceRefs: [] },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}}｜${MODEL_REF}数据速览 #LineupCast`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
};

const zh_15s_passionate: ZhScriptTemplateSet = {
  opening: {
    template: `各位球迷朋友！{{homeName}}主场迎战{{awayName}}，{{league}}焦点之战！${MODEL_REF}，看看数据怎么说！`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "form", sourcePath: "match.league", description: "League name" },
    ],
  },
  lineupIntro: {
    template: `首发来了！{{homeName}}{{homeFormation}}，{{awayName}}{{awayFormation}}！`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
    ],
  },
  tacticalBattle: { template: `战术碰撞！`, sourceRefs: [] },
  predictionBrief: {
    template: `${MODEL_REF}：{{homeName}} {{homeWinPct}}% vs {{awayName}} {{awayWinPct}}%！{{leading}}！`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
  playerFocus: {
    template: `今晚看他们！{{scorerNames}}！`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Goal scorers" },
    ],
  },
  disciplineRisk: { template: `注意纪律！`, sourceRefs: [] },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}}｜谁能笑到最后？{{homeWinPct}}% vs {{awayWinPct}}% #足球预测`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
};

const zh_15s_neutral: ZhScriptTemplateSet = {
  opening: {
    template: `{{homeName}}对阵{{awayName}}，${MODEL_REF}数据如下。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
  lineupIntro: { template: `阵型对比。`, sourceRefs: [] },
  tacticalBattle: { template: `战术分析。`, sourceRefs: [] },
  predictionBrief: {
    template: `${MODEL_REF}：{{homeName}} {{homeWinPct}}%，平局{{drawPct}}%，{{awayName}} {{awayWinPct}}%。`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
    ],
  },
  playerFocus: {
    template: `关注球员：{{scorerNames}}。`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Goal scorers" },
    ],
  },
  disciplineRisk: { template: `风险提示。`, sourceRefs: [] },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}}｜数据解读 #LineupCast`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
};

// ── 30s templates ─────────────────────────────────────────────────────────────

const zh_30s_professional: ZhScriptTemplateSet = {
  opening: {
    template: `观众朋友们好，欢迎收看{{league}}赛事前瞻。本场比赛由{{homeName}}主场迎战{{awayName}}，${MODEL_REF}为您带来赛前分析。`,
    sourceRefs: [
      { sourceType: "form", sourcePath: "match.league", description: "League name" },
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
    ],
  },
  lineupIntro: {
    template: `先来看双方首发阵容。{{homeName}}排出{{homeFormation}}阵型，{{homeGKLine}}整体配置均衡。{{awayName}}方面则以{{awayFormation}}应战{{awayGKLine}}，阵容齐整。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.home.players", description: "Home goalkeeper" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.players", description: "Away goalkeeper" },
    ],
  },
  tacticalBattle: {
    template: `战术对比方面，{{homeName}}{{homeFormation}}的核心球员为{{homeKeyNames}}，{{awayName}}{{awayFormation}}则以{{awayKeyNames}}为战术支点。{{xgComparison}}，比赛预计会比较胶着。`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.formation", description: "Home formation" },
      { sourceType: "lineup", sourcePath: "lineups.away.formation", description: "Away formation" },
      { sourceType: "lineup", sourcePath: "lineups.home.players", description: "Home key players" },
      { sourceType: "lineup", sourcePath: "lineups.away.players", description: "Away key players" },
      { sourceType: "stats", sourcePath: "lineups.home.players.xGLast5", description: "xG comparison" },
    ],
  },
  predictionBrief: {
    template: `${MODEL_REF}，本场比赛预测如下：{{homeName}}胜率{{homeWinPct}}%，平局{{drawPct}}%，{{awayName}}胜率{{awayWinPct}}%。预期进球{{homeName}} {{xGH}}球、{{awayName}} {{xGA}}球。{{leading}}，{{confText}}。`,
    sourceRefs: [
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.draw", description: "Draw probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
      { sourceType: "prediction", sourcePath: "prediction.expectedHomeGoals", description: "Expected home goals" },
      { sourceType: "prediction", sourcePath: "prediction.expectedAwayGoals", description: "Expected away goals" },
      { sourceType: "prediction", sourcePath: "prediction.confidence", description: "Confidence level" },
    ],
  },
  playerFocus: {
    template: `进球概率较高的球员包括：{{scorerLines}}。以上概率来自模型对近期数据的分析。`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "goalScorers", description: "Goal scorers with probabilities" },
      { sourceType: "lineup", sourcePath: "lineups.home.players", description: "Player ratings" },
      { sourceType: "lineup", sourcePath: "lineups.away.players", description: "Player ratings" },
    ],
  },
  disciplineRisk: {
    template: `纪律风险方面需要关注：{{riskLines}}。`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "cardRisks", description: "Card risk data" },
    ],
  },
  shortVideoCaption: {
    template: `{{homeName}} vs {{awayName}} 赛前数据速览：模型预测 {{homeWinPct}}% vs {{awayWinPct}}%{{scorerPart}}｜根据 Dixon-Coles 与阵容修正模型 #足球预测`,
    sourceRefs: [
      { sourceType: "lineup", sourcePath: "lineups.home.teamName", description: "Home team name" },
      { sourceType: "lineup", sourcePath: "lineups.away.teamName", description: "Away team name" },
      { sourceType: "prediction", sourcePath: "prediction.homeWin", description: "Home win probability" },
      { sourceType: "prediction", sourcePath: "prediction.awayWin", description: "Away win probability" },
      { sourceType: "stats", sourcePath: "goalScorers", description: "Top goal scorer" },
    ],
  },
};

// ── 1min and 3min share the professional template with more detail ────────────

const zh_1min_professional: ZhScriptTemplateSet = {
  ...zh_30s_professional,
  tacticalBattle: {
    template: `战术对比方面，{{homeName}}{{homeFormation}}的核心球员为{{homeKeyNames}}，{{awayName}}{{awayFormation}}则以{{awayKeyNames}}为战术支点。{{xgComparison}}，比赛预计会比较胶着。两队的阵型对比将决定中场控制权的归属。`,
    sourceRefs: zh_30s_professional.tacticalBattle.sourceRefs,
  },
};

const zh_3min_professional: ZhScriptTemplateSet = {
  ...zh_1min_professional,
  disciplineRisk: {
    template: `纪律风险方面需要关注：{{riskLines}}。这些球员需要格外注意动作控制，避免不必要的牌面。`,
    sourceRefs: [
      { sourceType: "stats", sourcePath: "cardRisks", description: "Card risk data" },
    ],
  },
};

// ── Style variants for 30s, 1min, 3min ────────────────────────────────────────

const zh_30s_shortvideo: ZhScriptTemplateSet = {
  ...zh_15s_shortvideo,
  opening: {
    template: `{{homeName}} vs {{awayName}}！{{league}}焦点之战，${MODEL_REF}为你拆解。一起来看！`,
    sourceRefs: zh_15s_shortvideo.opening.sourceRefs,
  },
};

const zh_30s_broadcast: ZhScriptTemplateSet = {
  ...zh_30s_professional,
};

const zh_30s_passionate: ZhScriptTemplateSet = {
  ...zh_15s_passionate,
  opening: {
    template: `各位球迷朋友，激动人心的时刻即将到来！{{homeName}}主场迎战{{awayName}}，{{league}}本轮焦点之战！${MODEL_REF}，我们来看看这场对决的数据密码。`,
    sourceRefs: zh_15s_passionate.opening.sourceRefs,
  },
};

const zh_30s_neutral: ZhScriptTemplateSet = {
  ...zh_30s_professional,
};

// ── Template registry ─────────────────────────────────────────────────────────

type TemplateKey = `${ScriptDuration}_${Exclude<ScriptStyle, "bilingual">}`;

/**
 * Registry of all Chinese script templates indexed by duration_style.
 */
export const ZH_TEMPLATES: Record<TemplateKey, ZhScriptTemplateSet> = {
  "15s_professional": zh_15s_professional,
  "15s_short-video": zh_15s_shortvideo,
  "15s_broadcast": zh_15s_broadcast,
  "15s_passionate": zh_15s_passionate,
  "15s_neutral": zh_15s_neutral,
  "30s_professional": zh_30s_professional,
  "30s_short-video": zh_30s_shortvideo,
  "30s_broadcast": zh_30s_broadcast,
  "30s_passionate": zh_30s_passionate,
  "30s_neutral": zh_30s_neutral,
  "1min_professional": zh_1min_professional,
  "1min_short-video": zh_30s_shortvideo,
  "1min_broadcast": zh_1min_professional,
  "1min_passionate": zh_30s_passionate,
  "1min_neutral": zh_1min_professional,
  "3min_professional": zh_3min_professional,
  "3min_short-video": zh_30s_shortvideo,
  "3min_broadcast": zh_3min_professional,
  "3min_passionate": zh_30s_passionate,
  "3min_neutral": zh_3min_professional,
};

/**
 * Get the Chinese template for a given duration and style.
 * Falls back to professional style if the exact combination is not found.
 */
export function getZhTemplate(
  duration: ScriptDuration,
  style: Exclude<ScriptStyle, "bilingual">,
): ZhScriptTemplateSet {
  const key: TemplateKey = `${duration}_${style}`;
  return ZH_TEMPLATES[key] ?? ZH_TEMPLATES[`${duration}_professional`] ?? zh_30s_professional;
}
