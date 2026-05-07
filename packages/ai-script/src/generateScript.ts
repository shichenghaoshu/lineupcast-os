// @lineupcast/ai-script — deterministic script generation from structured match data

import type {
  BilingualMode,
  ScriptGenerationInput,
  ScriptGenerationOutput,
  ScriptLanguage,
  ScriptSections,
  ScriptStyle,
  LineupPlayer,
  GoalScorer,
  CardRisk,
} from "./types.js";
import {
  sanitizeForbiddenPhrases,
  ensureModelSourceCitation,
  validateScript,
} from "./forbidden.js";
import { CARD_RISK_TEMPLATE } from "./templates.js";

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
    return validation.valid && !hasInventedPercentages(candidate, input) ? candidate : fallback;
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
    return buildEnglishScriptSections(input, style);
  }
  if (language === "bilingual") {
    return buildBilingualScriptSections(input, style, input.bilingualMode ?? "paragraph-by-paragraph");
  }
  return buildChineseScriptSections(input, style);
}

function buildChineseScriptSections(
  input: ScriptGenerationInput,
  style: Exclude<ScriptStyle, "bilingual">,
): ScriptSections {
  const { match, lineups, prediction, goalScorers, cardRisks, duration } = input;
  const homeName = lineups.home.teamName;
  const awayName = lineups.away.teamName;
  const homeWinPct = Math.round(prediction.homeWin * 100);
  const drawPct = Math.round(prediction.draw * 100);
  const awayWinPct = Math.round(prediction.awayWin * 100);

  const opening = buildOpening(homeName, awayName, match.league, style, duration);
  const lineupIntro = buildLineupIntro(
    homeName,
    awayName,
    lineups.home.formation,
    lineups.away.formation,
    lineups.home.players,
    lineups.away.players,
    style,
  );
  const tacticalBattle = buildTacticalBattle(
    homeName,
    awayName,
    lineups.home.formation,
    lineups.away.formation,
    lineups.home.players,
    lineups.away.players,
    style,
  );
  const predictionBrief = buildPredictionBrief(
    homeName,
    awayName,
    homeWinPct,
    drawPct,
    awayWinPct,
    prediction.expectedHomeGoals.toFixed(1),
    prediction.expectedAwayGoals.toFixed(1),
    prediction.confidence,
    style,
  );
  const playerFocus = buildPlayerFocus(
    homeName,
    awayName,
    lineups.home.players,
    lineups.away.players,
    goalScorers,
    style,
  );
  const disciplineRisk = buildDisciplineRisk(cardRisks, style);
  const shortVideoCaption = buildShortVideoCaption(
    homeName,
    awayName,
    homeWinPct,
    awayWinPct,
    goalScorers,
    style,
  );
  const teleprompterText = buildTeleprompterText(
    duration,
    opening,
    lineupIntro,
    tacticalBattle,
    predictionBrief,
    playerFocus,
    disciplineRisk,
  );

  return {
    opening,
    lineupIntro,
    tacticalBattle,
    predictionBrief,
    playerFocus,
    disciplineRisk,
    shortVideoCaption,
    teleprompterText,
  };
}

function buildEnglishScriptSections(
  input: ScriptGenerationInput,
  style: Exclude<ScriptStyle, "bilingual">,
): ScriptSections {
  const { match, lineups, prediction, goalScorers, cardRisks, duration } = input;
  const homeName = lineups.home.teamName;
  const awayName = lineups.away.teamName;
  const homeWinPct = Math.round(prediction.homeWin * 100);
  const drawPct = Math.round(prediction.draw * 100);
  const awayWinPct = Math.round(prediction.awayWin * 100);
  const xGH = prediction.expectedHomeGoals.toFixed(1);
  const xGA = prediction.expectedAwayGoals.toFixed(1);
  const modelRef = "Based on Dixon-Coles with lineup adjustment model";
  const leading =
    homeWinPct > awayWinPct
      ? `${homeName} is rated higher by the model`
      : awayWinPct > homeWinPct
        ? `${awayName} is rated higher by the model`
        : "the teams are close in the model";
  const homeTop = topRatedOutfield(lineups.home.players, 2).map((p) => p.name).join(", ") || "key players";
  const awayTop = topRatedOutfield(lineups.away.players, 2).map((p) => p.name).join(", ") || "key players";
  const topScorers = [...goalScorers].sort((a, b) => b.probability - a.probability).slice(0, 3);
  const scorerText =
    topScorers.length > 0
      ? topScorers.map((gs) => `${gs.player} (${gs.team}, scoring probability ${gs.probability}%)`).join("; ")
      : "no high-confidence player scorer data is available";
  const cardText =
    cardRisks.length > 0
      ? [...cardRisks]
          .sort((a, b) => b.yellowRisk - a.yellowRisk)
          .slice(0, 3)
          .map((cr) => `${cr.player} (${cr.team}, yellow-card risk ${cr.yellowRisk}%)`)
          .join("; ")
      : "no elevated discipline-risk data is available";

  const opening =
    style === "short-video"
      ? `${homeName} vs ${awayName}: a quick ${match.league} data preview.`
      : `Welcome to this ${match.league} preview: ${homeName} host ${awayName}. ${modelRef}, here is the pre-match read.`;
  const lineupIntro = `${homeName} set up in a ${lineups.home.formation}, while ${awayName} answer with a ${lineups.away.formation}. The shape comparison points to a compact tactical matchup.`;
  const tacticalBattle = `Tactically, ${homeName} lean on ${homeTop}; ${awayName} look to ${awayTop}. The model treats this as a probability-led contest, not a fixed outcome.`;
  const predictionBrief = `${modelRef}: ${homeName} win ${homeWinPct}%, draw ${drawPct}%, ${awayName} win ${awayWinPct}%. Expected goals are ${homeName} ${xGH} and ${awayName} ${xGA}. ${leading}.`;
  const playerFocus = `Player focus: ${scorerText}. These probabilities come from the supplied player model values.`;
  const disciplineRisk = `Discipline watch: ${cardText}. Treat these as risk signals, not certain card events.`;
  const shortVideoCaption = `${homeName} vs ${awayName} | Model probabilities ${homeWinPct}%-${drawPct}%-${awayWinPct}% | #LineupCast #FootballPrediction`;
  const teleprompterText = buildTeleprompterText(
    duration,
    opening,
    lineupIntro,
    tacticalBattle,
    predictionBrief,
    playerFocus,
    disciplineRisk,
  );

  return {
    opening,
    lineupIntro,
    tacticalBattle,
    predictionBrief,
    playerFocus,
    disciplineRisk,
    shortVideoCaption,
    teleprompterText,
  };
}

function buildBilingualScriptSections(
  input: ScriptGenerationInput,
  style: Exclude<ScriptStyle, "bilingual">,
  mode: BilingualMode,
): ScriptSections {
  const zh = buildChineseScriptSections(input, style);
  const en = buildEnglishScriptSections(input, style);
  if (mode === "separate") {
    return {
      opening: `中文：${zh.opening}\nEnglish: ${en.opening}`,
      lineupIntro: `中文：${zh.lineupIntro}\nEnglish: ${en.lineupIntro}`,
      tacticalBattle: `中文：${zh.tacticalBattle}\nEnglish: ${en.tacticalBattle}`,
      predictionBrief: `中文：${zh.predictionBrief}\nEnglish: ${en.predictionBrief}`,
      playerFocus: `中文：${zh.playerFocus}\nEnglish: ${en.playerFocus}`,
      disciplineRisk: `中文：${zh.disciplineRisk}\nEnglish: ${en.disciplineRisk}`,
      shortVideoCaption: `${zh.shortVideoCaption}\n${en.shortVideoCaption}`,
      teleprompterText: `【中文】\n${zh.teleprompterText}\n\n【English】\n${en.teleprompterText}`,
    };
  }

  return {
    opening: `${zh.opening}\n${en.opening}`,
    lineupIntro: `${zh.lineupIntro}\n${en.lineupIntro}`,
    tacticalBattle: `${zh.tacticalBattle}\n${en.tacticalBattle}`,
    predictionBrief: `${zh.predictionBrief}\n${en.predictionBrief}`,
    playerFocus: `${zh.playerFocus}\n${en.playerFocus}`,
    disciplineRisk: `${zh.disciplineRisk}\n${en.disciplineRisk}`,
    shortVideoCaption: `${zh.shortVideoCaption}\n${en.shortVideoCaption}`,
    teleprompterText: paragraphByParagraph(zh.teleprompterText, en.teleprompterText),
  };
}

function paragraphByParagraph(zhText: string, enText: string): string {
  const zhParts = zhText.split("\n\n");
  const enParts = enText.split("\n\n");
  const max = Math.max(zhParts.length, enParts.length);
  const merged: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const pair = [zhParts[i], enParts[i]].filter(Boolean);
    merged.push(pair.join("\n"));
  }
  return merged.join("\n\n");
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildOpening(
  homeName: string,
  awayName: string,
  league: string,
  style: string,
  duration: string,
): string {
  const modelRef = `根据 Dixon-Coles 与阵容修正模型`;

  if (style === "short-video") {
    return `${homeName} vs ${awayName}！${league}焦点之战，${modelRef}为你拆解。`;
  }
  if (style === "passionate") {
    return `各位球迷朋友，激动人心的时刻即将到来！${homeName}主场迎战${awayName}，${league}本轮焦点之战！${modelRef}，我们来看看这场对决的数据密码。`;
  }
  if (style === "bilingual") {
    return `Welcome to LineupCast! 今天我们带来${league}的焦点对决 — ${homeName} vs ${awayName}。${modelRef}，let's break down the data.`;
  }
  // professional (default)
  if (duration === "15s") {
    return `${homeName}对阵${awayName}，${modelRef}数据速览。`;
  }
  return `观众朋友们好，欢迎收看${league}赛事前瞻。本场比赛由${homeName}主场迎战${awayName}，${modelRef}为您带来赛前分析。`;
}

function buildLineupIntro(
  homeName: string,
  awayName: string,
  homeFormation: string,
  awayFormation: string,
  homePlayers: LineupPlayer[],
  awayPlayers: LineupPlayer[],
  style: string,
): string {
  const homeGK = homePlayers.find((p) => p.position === "GK");
  const awayGK = awayPlayers.find((p) => p.position === "GK");
  const homeGKLine = homeGK ? `门将${homeGK.name}镇守球门，` : "";
  const awayGKLine = awayGK ? `，门将${awayGK.name}` : "";

  if (style === "short-video") {
    return `${homeName}${homeFormation}迎战${awayName}${awayFormation}！${homeGKLine}阵容配置如何？一起来看。`;
  }
  if (style === "bilingual") {
    return `${homeName} lineup: ${homeFormation} formation${homeGK ? `, GK ${homeGK.name}` : ""}。${awayName} lineup: ${awayFormation}${awayGKLine}。两队阵型对比，看看 tactical balance 如何。`;
  }
  return `先来看双方首发阵容。${homeName}排出${homeFormation}阵型，${homeGKLine}整体配置均衡。${awayName}方面则以${awayFormation}应战${awayGKLine}，阵容齐整。`;
}

function buildTacticalBattle(
  homeName: string,
  awayName: string,
  homeFormation: string,
  awayFormation: string,
  homePlayers: LineupPlayer[],
  awayPlayers: LineupPlayer[],
  style: string,
): string {
  // Find top-rated outfield players
  const homeTop = topRatedOutfield(homePlayers, 2);
  const awayTop = topRatedOutfield(awayPlayers, 2);

  const homeKeyNames = homeTop.map((p) => p.name).join("、") || "核心球员";
  const awayKeyNames = awayTop.map((p) => p.name).join("、") || "核心球员";

  const homeAvgXG = avgMetric(homePlayers, "xGLast5");
  const awayAvgXG = avgMetric(awayPlayers, "xGLast5");

  const xgComparison =
    homeAvgXG > awayAvgXG
      ? `${homeName}在进攻端模型认为更具威胁`
      : awayAvgXG > homeAvgXG
        ? `${awayName}的进攻数据概率上更优`
        : "双方进攻数据接近";

  if (style === "short-video") {
    return `关键对决：${homeKeyNames} vs ${awayKeyNames}。${xgComparison}，这场更值得关注！`;
  }
  if (style === "passionate") {
    return `战术层面，${homeName}的${homeFormation}对阵${awayName}的${awayFormation}，这是一场矛与盾的较量！${homeName}阵中${homeKeyNames}是关键人物，而${awayName}则依赖${awayKeyNames}的发挥。${xgComparison}，比赛走向扑朔迷离！`;
  }
  if (style === "bilingual") {
    return `Tactical breakdown: ${homeName} ${homeFormation} vs ${awayName} ${awayFormation}。Key players to watch — ${homeName}: ${homeKeyNames}; ${awayName}: ${awayKeyNames}。${xgComparison}。`;
  }
  return `战术对比方面，${homeName}${homeFormation}的核心球员为${homeKeyNames}，${awayName}${awayFormation}则以${awayKeyNames}为战术支点。${xgComparison}，比赛预计会比较胶着。`;
}

function buildPredictionBrief(
  homeName: string,
  awayName: string,
  homeWinPct: number,
  drawPct: number,
  awayWinPct: number,
  xGH: string,
  xGA: string,
  confidence: string,
  style: string,
): string {
  const confidenceMap: Record<string, string> = {
    low: "置信度较低",
    medium: "置信度中等",
    high: "置信度较高",
  };
  const confText = confidenceMap[confidence] ?? "置信度中等";
  const modelRef = "根据 Dixon-Coles 与阵容修正模型";

  const leading =
    homeWinPct > awayWinPct
      ? `${homeName}概率上更占优势`
      : awayWinPct > homeWinPct
        ? `${awayName}概率上更占优势`
        : "双方势均力敌";

  if (style === "short-video") {
    return `${modelRef}：${homeName} ${homeWinPct}% vs ${awayName} ${awayWinPct}%，平局${drawPct}%。${leading}！`;
  }
  if (style === "bilingual") {
    return `${modelRef}，match prediction: ${homeName} ${homeWinPct}% | Draw ${drawPct}% | ${awayName} ${awayWinPct}%。Expected goals: ${homeName} ${xGH} - ${awayName} ${xGA}。${confText}。${leading}。`;
  }
  return `${modelRef}，本场比赛预测如下：${homeName}胜率${homeWinPct}%，平局${drawPct}%，${awayName}胜率${awayWinPct}%。预期进球${homeName} ${xGH}球、${awayName} ${xGA}球。${leading}，${confText}。`;
}

function buildPlayerFocus(
  homeName: string,
  awayName: string,
  homePlayers: LineupPlayer[],
  awayPlayers: LineupPlayer[],
  goalScorers: GoalScorer[],
  style: string,
): string {
  const sections: string[] = [];

  // Top goal scorer candidates
  const topScorers = [...goalScorers].sort((a, b) => b.probability - a.probability).slice(0, 3);

  if (topScorers.length > 0) {
    const scorerLines = topScorers.map((gs) => {
      const player = findPlayerByName(gs.player, homePlayers, awayPlayers);
      const ratingInfo = player ? `，近期评分${player.recentRating}` : "";
      return `${gs.player}（${gs.team}，破门概率${gs.probability}%${ratingInfo}）`;
    });

    if (style === "short-video") {
      sections.push(`进球热门：${scorerLines.join("、")}！`);
    } else if (style === "passionate") {
      sections.push(`最值得关注的射手：${scorerLines.join("、")}！他们今晚能否破门，让我们拭目以待！`);
    } else if (style === "bilingual") {
      sections.push(`Goal scorer watch: ${scorerLines.join("; ")}。These players are more值得关注 tonight.`);
    } else {
      sections.push(`进球概率较高的球员包括：${scorerLines.join("、")}。以上概率来自模型对近期数据的分析。`);
    }
  }

  // Key performers by rating
  const homeTopRated = topRatedOutfield(homePlayers, 1)[0];
  const awayTopRated = topRatedOutfield(awayPlayers, 1)[0];

  if (homeTopRated && awayTopRated) {
    const roleDesc = (p: LineupPlayer): string => {
      if (p.role.includes("核心") || p.role.includes("key")) return "球队核心";
      if (p.position === "FW" || p.position === "ST") return "锋线尖刀";
      if (p.position === "MF" || p.position === "CM") return "中场发动机";
      if (p.position === "DF" || p.position === "CB") return "后防中坚";
      return "关键球员";
    };

    if (style === "short-video") {
      sections.push(`${homeName}看${homeTopRated.name}，${awayName}盯紧${awayTopRated.name}。`);
    } else {
      sections.push(
        `${homeName}阵中${homeTopRated.name}是${roleDesc(homeTopRated)}，近期评分${homeTopRated.recentRating}；${awayName}方面${awayTopRated.name}作为${roleDesc(awayTopRated)}，近期评分${awayTopRated.recentRating}，两人的发挥将很大程度上决定比赛走势。`,
      );
    }
  }

  return sections.join(" ");
}

function buildDisciplineRisk(cardRisks: CardRisk[], _style: string): string {
  if (cardRisks.length === 0) {
    return "本场比赛暂无高风险球员数据。";
  }

  const highRisk = [...cardRisks].sort((a, b) => b.yellowRisk - a.yellowRisk).slice(0, 3);

  const riskLines = highRisk.map((cr) => {
    const template = CARD_RISK_TEMPLATE.replace("{{playerName}}", cr.player)
      .replace("{{yellowCards}}", String(cr.yellowRisk))
      .replace("{{yellowRisk}}", String(cr.yellowRisk));
    return template;
  });

  return `纪律风险方面需要关注：${riskLines.join("；")}。`;
}

function buildShortVideoCaption(
  homeName: string,
  awayName: string,
  homeWinPct: number,
  awayWinPct: number,
  goalScorers: GoalScorer[],
  style: string,
): string {
  const topScorer = [...goalScorers].sort((a, b) => b.probability - a.probability)[0];
  const scorerPart = topScorer ? `｜${topScorer.player}破门概率${topScorer.probability}%` : "";

  if (style === "short-video") {
    return `${homeName} vs ${awayName}｜${homeWinPct}% vs ${awayWinPct}%${scorerPart}｜模型数据解读 #足球预测 #LineupCast`;
  }
  if (style === "bilingual") {
    return `${homeName} vs ${awayName} — Model Prediction: ${homeWinPct}% vs ${awayWinPct}%${scorerPart} #LineupCast #FootballPrediction`;
  }
  return `${homeName} vs ${awayName} 赛前数据速览：模型预测 ${homeWinPct}% vs ${awayWinPct}%${scorerPart}｜根据 Dixon-Coles 与阵容修正模型 #足球预测`;
}

function buildTeleprompterText(
  duration: string,
  opening: string,
  lineupIntro: string,
  tacticalBattle: string,
  predictionBrief: string,
  playerFocus: string,
  disciplineRisk: string,
): string {
  const sections: string[] = [];

  sections.push(opening);

  if (duration !== "15s") {
    sections.push(lineupIntro);
  }

  if (duration === "1min" || duration === "3min") {
    sections.push(tacticalBattle);
  }

  sections.push(predictionBrief);

  if (duration !== "15s") {
    sections.push(playerFocus);
  }

  if (duration === "3min") {
    sections.push(disciplineRisk);
  }

  return sections.join("\n\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function topRatedOutfield(players: LineupPlayer[], count: number): LineupPlayer[] {
  return players
    .filter((p) => p.position !== "GK")
    .sort((a, b) => b.recentRating - a.recentRating)
    .slice(0, count);
}

function avgMetric(players: LineupPlayer[], key: "xGLast5" | "shotsLast5"): number {
  if (players.length === 0) return 0;
  const sum = players.reduce((s, p) => s + p[key], 0);
  return sum / players.length;
}

function findPlayerByName(
  name: string,
  homePlayers: LineupPlayer[],
  awayPlayers: LineupPlayer[],
): LineupPlayer | undefined {
  return [...homePlayers, ...awayPlayers].find((p) => p.name === name);
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
