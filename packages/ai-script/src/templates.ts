// @lineupcast/ai-script — prompt templates for AI/LLM rewriting

import type { ScriptDuration, ScriptLanguage, ScriptStyle } from "./types";

/**
 * System prompt for AI/LLM script rewriting.
 * The LLM MUST NOT invent probabilities or absolute claims.
 */
export const SYSTEM_PROMPT = `你是 LineupCast 的 AI 解说脚本撰写助手。
你的任务是将结构化的赛前数据重写为自然流畅的解说词。
严格规则：
1. 绝不编造概率、比分预测或任何数据。所有数字必须来自输入。
2. 绝不使用以下禁词：稳赢、必进、一定红牌、必胜、肯定进球、guaranteed。
3. 使用审慎措辞：概率上、更值得关注、风险偏高、模型认为。
4. 必须在脚本中引用数据来源，例如"根据 Dixon-Coles 与阵容修正模型"。
5. 输出必须为 JSON 格式，包含 opening, lineupIntro, tacticalBattle, predictionBrief, playerFocus, disciplineRisk, shortVideoCaption, teleprompterText 字段。
6. 可按 language 输出中文、英文或中英双语；双语时不要改写任何概率数字。`;

/**
 * Duration-specific prompt templates.
 */
export const DURATION_PROMPTS: Record<ScriptDuration, string> = {
  "15s": `生成一段 15 秒短视频解说脚本。
要求：节奏快、信息密度高，适合抖音/快手/Reels 等短视频平台。
每个段落限 1-2 句话。
teleprompterText 总字数不超过 80 字。`,

  "30s": `生成一段 30 秒直播开场脚本。
要求：专业、有气势，适合赛事直播开场。
每个段落限 2-3 句话。
teleprompterText 总字数不超过 150 字。`,

  "1min": `生成一段 1 分钟阵容解读脚本。
要求：重点分析双方阵型和关键球员，兼顾战术对比。
每个段落限 3-4 句话。
teleprompterText 总字数不超过 300 字。`,

  "3min": `生成一段 3 分钟赛前深度分析脚本。
要求：全面覆盖阵容、战术、历史交锋、数据模型预测、球员焦点、纪律风险。
每个段落可包含 4-6 句话，允许更深入的分析。
teleprompterText 总字数不超过 800 字。`,
};

/**
 * Style-specific prompt modifiers.
 */
export const STYLE_PROMPTS: Record<ScriptStyle, string> = {
  professional: `风格要求：专业、客观、中立。语调沉稳，适合体育频道解说。
使用标准普通话，避免网络用语。`,

  "short-video": `风格要求：节奏快、有冲击力、适合竖屏短视频。
可以使用口语化表达，但不能违反禁词规则。
每句话要有"钩子"，吸引观众继续看。`,

  passionate: `风格要求：激情、有感染力，适合球迷社区和弹幕文化。
可以适当使用感叹句和修辞手法，但数据必须准确。
增强情绪表达的同时保持客观分析。`,

  neutral: `风格要求：中立、克制、清晰。
避免夸张表达，重点呈现模型概率、阵容信息和风险提示。`,

  broadcast: `风格要求：电视转播解说。
语言连贯，适合主播口播，段落之间自然衔接。`,

  bilingual: `兼容旧参数：等同于 language=bilingual 且 style=professional。`,
};

/**
 * Build a complete prompt for the AI/LLM from script input.
 */
export function buildPrompt(
  duration: ScriptDuration,
  style: ScriptStyle,
  language: ScriptLanguage = "zh",
): string {
  return `${DURATION_PROMPTS[duration]}\n\n${STYLE_PROMPTS[style]}\n\n语言要求：${language}。`;
}

/**
 * Template for player introduction (per-player).
 */
export const PLAYER_INTRO_TEMPLATE =
  "{{playerName}}（{{position}}，{{nationality}}）——近期评分 {{rating}}，近5场 xG {{xG}}，是{{teamName}}阵中{{roleDescription}}。";

/**
 * Template for card risk warning.
 */
export const CARD_RISK_TEMPLATE =
  "{{playerName}} 需要格外注意：近10场已累计 {{yellowCards}} 张黄牌，本场比赛黄牌风险概率 {{yellowRisk}}%。";

/**
 * Available script generation templates indexed by duration.
 */
export const SCRIPT_TEMPLATES = {
  "15s": {
    sections: ["opening", "predictionBrief", "shortVideoCaption"],
    maxChars: 80,
  },
  "30s": {
    sections: ["opening", "predictionBrief", "playerFocus"],
    maxChars: 150,
  },
  "1min": {
    sections: ["opening", "lineupIntro", "predictionBrief", "playerFocus", "shortVideoCaption"],
    maxChars: 300,
  },
  "3min": {
    sections: [
      "opening",
      "lineupIntro",
      "tacticalBattle",
      "predictionBrief",
      "playerFocus",
      "disciplineRisk",
      "shortVideoCaption",
    ],
    maxChars: 800,
  },
} as const;
