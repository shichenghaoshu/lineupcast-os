// @lineupcast/ai-script — Bilingual script templates (Chinese + English)

import type { ScriptDuration, ScriptStyle, BilingualMode } from "../types.js";
import type { TemplateSourceAnnotation } from "./zh.js";
import { getZhTemplate } from "./zh.js";
import { getEnTemplate } from "./en.js";

/**
 * Bilingual disclaimer combining both languages.
 */
export const BILINGUAL_DISCLAIMER =
  "本内容仅供参考分析，不构成任何投注建议。AI辅助解说，模型计算概率，AI负责叙述。\nFor commentary assistance only, not betting advice. Models calculate probabilities, AI narrates.";

/**
 * A bilingual template section combines Chinese and English templates.
 */
export interface BilingualTemplateSection {
  zh: string;
  en: string;
  sourceRefs: TemplateSourceAnnotation[];
}

/**
 * Complete bilingual template set.
 */
export interface BilingualTemplateSet {
  opening: BilingualTemplateSection;
  lineupIntro: BilingualTemplateSection;
  tacticalBattle: BilingualTemplateSection;
  predictionBrief: BilingualTemplateSection;
  playerFocus: BilingualTemplateSection;
  disciplineRisk: BilingualTemplateSection;
  shortVideoCaption: BilingualTemplateSection;
}

/**
 * Build a bilingual template set from the corresponding Chinese and English templates.
 *
 * In "separate" mode, each section is rendered as distinct Chinese and English paragraphs.
 * In "paragraph-by-paragraph" mode, the teleprompter interleaves Chinese and English paragraphs.
 */
export function getBilingualTemplate(
  duration: ScriptDuration,
  style: Exclude<ScriptStyle, "bilingual">,
  _mode: BilingualMode,
): BilingualTemplateSet {
  const zh = getZhTemplate(duration, style);
  const en = getEnTemplate(duration, style);

  return {
    opening: mergeSection(zh.opening, en.opening),
    lineupIntro: mergeSection(zh.lineupIntro, en.lineupIntro),
    tacticalBattle: mergeSection(zh.tacticalBattle, en.tacticalBattle),
    predictionBrief: mergeSection(zh.predictionBrief, en.predictionBrief),
    playerFocus: mergeSection(zh.playerFocus, en.playerFocus),
    disciplineRisk: mergeSection(zh.disciplineRisk, en.disciplineRisk),
    shortVideoCaption: mergeSection(zh.shortVideoCaption, en.shortVideoCaption),
  };
}

function mergeSection(
  zh: { template: string; sourceRefs: TemplateSourceAnnotation[] },
  en: { template: string; sourceRefs: TemplateSourceAnnotation[] },
): BilingualTemplateSection {
  // Merge source refs, deduplicating by sourcePath
  const seen = new Set<string>();
  const mergedRefs: TemplateSourceAnnotation[] = [];
  for (const ref of [...zh.sourceRefs, ...en.sourceRefs]) {
    if (!seen.has(ref.sourcePath)) {
      seen.add(ref.sourcePath);
      mergedRefs.push(ref);
    }
  }

  return {
    zh: zh.template,
    en: en.template,
    sourceRefs: mergedRefs,
  };
}

/**
 * Render a bilingual template section in "separate" mode:
 * Chinese paragraph followed by English paragraph.
 */
export function renderSeparate(section: BilingualTemplateSection): string {
  return `中文：${section.zh}\nEnglish: ${section.en}`;
}

/**
 * Render a bilingual template section in "mixed" mode:
 * Key terms appear in both languages inline.
 * For mixed mode, we use the Chinese template as the base and embed English key terms.
 */
export function renderMixed(section: BilingualTemplateSection): string {
  // In mixed mode, combine both templates inline
  return `${section.zh}\n${section.en}`;
}

/**
 * Render a bilingual teleprompter text in "separate" mode (paragraph by paragraph).
 */
export function renderTeleprompterSeparate(
  zhTeleprompter: string,
  enTeleprompter: string,
): string {
  const zhParts = zhTeleprompter.split("\n\n");
  const enParts = enTeleprompter.split("\n\n");
  const max = Math.max(zhParts.length, enParts.length);
  const merged: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const pair = [zhParts[i], enParts[i]].filter(Boolean);
    merged.push(pair.join("\n"));
  }
  return merged.join("\n\n");
}

/**
 * Render a bilingual teleprompter text in "mixed" mode:
 * Chinese and English paragraphs are combined section by section.
 */
export function renderTeleprompterMixed(
  zhTeleprompter: string,
  enTeleprompter: string,
): string {
  return `【中文】\n${zhTeleprompter}\n\n【English】\n${enTeleprompter}`;
}

export type { ZhScriptTemplateSet } from "./zh.js";
export type { EnScriptTemplateSet } from "./en.js";
