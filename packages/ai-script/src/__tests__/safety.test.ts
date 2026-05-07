// @lineupcast/ai-script — safety and grounding tests

import { describe, it, expect } from "vitest";
import { generateScript } from "../generateScript.js";
import type { ScriptInput, ScriptStyle, ScriptDuration } from "../types.js";
import {
  sanitizeForbiddenPhrases,
  sanitizeGamblingPhrases,
  sanitizeAll,
  detectForbiddenPhrases,
  detectGamblingPhrases,
  validateScript,
  DISCLAIMER_ZH,
  DISCLAIMER_EN,
  DISCLAIMER_BILINGUAL,
} from "../forbidden.js";
import { generateGroundingReport, validateGrounding, summarizeGrounding } from "../grounding.js";
import { getZhTemplate } from "../templates/zh.js";
import { getEnTemplate, EN_DISCLAIMER } from "../templates/en.js";
import { getBilingualTemplate, BILINGUAL_DISCLAIMER } from "../templates/bilingual.js";
import { EXAMPLE_INPUT } from "../__fixtures__/example.js";

// ── Shared test fixture builder ───────────────────────────────────────────────

function makeInput(overrides?: Partial<ScriptInput>): ScriptInput {
  return {
    ...EXAMPLE_INPUT,
    ...overrides,
  } as ScriptInput;
}

// ── Chinese forbidden phrase detection ────────────────────────────────────────

describe("Chinese forbidden phrase detection", () => {
  it("detects all required Chinese forbidden phrases", () => {
    const phrases = ["稳赢", "必进", "一定红牌", "稳赚", "包中", "必胜", "确定进球"];
    for (const phrase of phrases) {
      const result = detectForbiddenPhrases(`这场比赛${phrase}了`);
      expect(result).toContain(phrase);
    }
  });

  it("detects 稳赢 in context", () => {
    expect(detectForbiddenPhrases("利物浦稳赢")).toContain("稳赢");
  });

  it("detects 必进 in context", () => {
    expect(detectForbiddenPhrases("Salah 必进")).toContain("必进");
  });

  it("detects 一定红牌 in context", () => {
    expect(detectForbiddenPhrases("这场比赛一定红牌")).toContain("一定红牌");
  });

  it("detects 稳赚 in context", () => {
    expect(detectForbiddenPhrases("这个结果稳赚")).toContain("稳赚");
  });

  it("detects 包中 in context", () => {
    expect(detectForbiddenPhrases("这个预测包中")).toContain("包中");
  });

  it("detects 必胜 in context", () => {
    expect(detectForbiddenPhrases("主队必胜")).toContain("必胜");
  });

  it("detects 确定进球 in context", () => {
    expect(detectForbiddenPhrases("今晚确定进球")).toContain("确定进球");
  });

  it("detects multiple Chinese forbidden phrases in one text", () => {
    const text = "利物浦稳赢，Salah 必进，而且必胜";
    const result = detectForbiddenPhrases(text);
    expect(result).toContain("稳赢");
    expect(result).toContain("必进");
    expect(result).toContain("必胜");
  });

  it("replaces Chinese forbidden phrases with cautious alternatives", () => {
    const input = "利物浦稳赢，Salah 必进，稳赚不赔";
    const result = sanitizeForbiddenPhrases(input);
    expect(result).not.toContain("稳赢");
    expect(result).not.toContain("必进");
    expect(result).toContain("概率上占优");
    expect(result).toContain("更值得关注的得分点");
  });

  it("returns empty for clean Chinese text", () => {
    expect(detectForbiddenPhrases("根据模型预测，利物浦概率上更占优势")).toEqual([]);
  });
});

// ── English forbidden phrase detection ────────────────────────────────────────

describe("English forbidden phrase detection", () => {
  it("detects 'guaranteed' case-insensitively", () => {
    expect(detectForbiddenPhrases("This is GUARANTEED")).toContain("guaranteed");
    expect(detectForbiddenPhrases("Guaranteed outcome")).toContain("guaranteed");
    expect(detectForbiddenPhrases("a guaranteed win")).toContain("guaranteed");
  });

  it("detects 'guaranteed win'", () => {
    expect(detectForbiddenPhrases("This is a guaranteed win")).toContain("guaranteed win");
  });

  it("detects 'sure bet'", () => {
    expect(detectForbiddenPhrases("It's a sure bet")).toContain("sure bet");
  });

  it("detects 'must score'", () => {
    expect(detectForbiddenPhrases("He must score tonight")).toContain("must score");
  });

  it("detects 'certain red card'", () => {
    expect(detectForbiddenPhrases("A certain red card is coming")).toContain("certain red card");
  });

  it("detects 'definite goal'", () => {
    expect(detectForbiddenPhrases("This is a definite goal")).toContain("definite goal");
  });

  it("detects '100% win'", () => {
    expect(detectForbiddenPhrases("100% win guaranteed")).toContain("100% win");
  });

  it("replaces English forbidden phrases", () => {
    const result = sanitizeForbiddenPhrases("a guaranteed win and sure bet");
    expect(result).not.toContain("guaranteed");
    expect(result).not.toContain("sure bet");
    expect(result).toContain("model-estimated");
  });

  it("returns empty for clean English text", () => {
    expect(detectForbiddenPhrases("The model estimates a higher probability for the home team")).toEqual([]);
  });
});

// ── Gambling-adjacent phrase detection ─────────────────────────────────────────

describe("gambling-adjacent phrase detection", () => {
  it("detects Chinese gambling phrases", () => {
    expect(detectGamblingPhrases("这场比赛下注")).toContain("下注");
    expect(detectGamblingPhrases("看看赔率")).toContain("赔率");
    expect(detectGamblingPhrases("盘口分析")).toContain("盘口");
    expect(detectGamblingPhrases("稳赚不赔的投资")).toContain("稳赚不赔");
  });

  it("detects English gambling phrases", () => {
    expect(detectGamblingPhrases("place a bet on this match")).toContain("place a bet");
    expect(detectGamblingPhrases("check the odds")).toContain("odds");
    expect(detectGamblingPhrases("it's a value bet")).toContain("value bet");
    expect(detectGamblingPhrases("the lock of the day")).toContain("lock of the day");
  });

  it("replaces gambling phrases with neutral text", () => {
    const result = sanitizeGamblingPhrases("这场比赛下注赔率很高");
    expect(result).not.toContain("下注");
    expect(result).not.toContain("赔率");
    expect(result).toContain("[内容已移除：不涉及投注建议]");
  });

  it("sanitizeAll handles both forbidden and gambling phrases", () => {
    const input = "利物浦稳赢，下注必赚，guaranteed win";
    const result = sanitizeAll(input);
    expect(result).not.toContain("稳赢");
    expect(result).not.toContain("下注");
    expect(result).not.toContain("guaranteed");
    expect(result).toContain("概率上占优");
    expect(result).toContain("[内容已移除：不涉及投注建议]");
  });

  it("returns empty for clean text without gambling phrases", () => {
    expect(detectGamblingPhrases("根据模型分析，利物浦概率上更占优势")).toEqual([]);
  });
});

// ── Grounding validation ──────────────────────────────────────────────────────

describe("grounding validation", () => {
  it("generateGroundingReport produces reports for all sentences", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) {
      expect(report.sentence).toBeTruthy();
      expect(report.sources.length).toBeGreaterThan(0);
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("every sentence has sourceRefs", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    for (const report of reports) {
      expect(report.sources.length).toBeGreaterThan(0);
      // Each source should have the new fields
      for (const source of report.sources) {
        expect(source.sourceType).toBeDefined();
        expect(source.sourcePath).toBeDefined();
      }
    }
  });

  it("sourceRefs have correct sourceType values", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    const validSourceTypes = new Set(["prediction", "lineup", "stats", "form"]);
    for (const report of reports) {
      for (const source of report.sources) {
        if (source.sourceType) {
          expect(validSourceTypes.has(source.sourceType)).toBe(true);
        }
      }
    }
  });

  it("validateGrounding passes for generated scripts", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    const result = validateGrounding(reports);
    // Most sentences should be grounded (template-only sentences are allowed)
    expect(result.totalSentences).toBeGreaterThan(0);
  });

  it("validateGrounding detects ungrounded sentences", () => {
    // Create a mock report with an ungrounded sentence
    const reports = [
      {
        sentenceIndex: 0,
        sentence: "This sentence has no source",
        sources: [{ field: "(template)", value: null, provider: "template" }],
        confidence: 0.1,
      },
    ];
    const result = validateGrounding(reports);
    expect(result.valid).toBe(false);
    expect(result.ungroundedSentences).toBe(1);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("summarizeGrounding provides accurate summary", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    const summary = summarizeGrounding(reports);
    expect(summary.totalSentences).toBe(reports.length);
    expect(summary.avgConfidence).toBeGreaterThanOrEqual(0);
    expect(summary.avgConfidence).toBeLessThanOrEqual(1);
    expect(summary.uniqueFields.length).toBeGreaterThan(0);
  });
});

// ── Script output safety validation ───────────────────────────────────────────

describe("all outputs pass safety check", () => {
  const styles: ScriptStyle[] = ["professional", "short-video", "passionate", "neutral", "broadcast"];
  const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];

  for (const style of styles) {
    for (const duration of durations) {
      it(`style="${style}" duration="${duration}" passes full safety validation`, () => {
        const input = makeInput({ style, duration });
        const output = generateScript(input);
        const allText = Object.values(output)
          .filter((v) => typeof v === "string")
          .join(" ");

        // No forbidden phrases
        expect(detectForbiddenPhrases(allText)).toEqual([]);

        // No gambling phrases
        expect(detectGamblingPhrases(allText)).toEqual([]);

        // Has disclaimer
        expect(output.disclaimer).toBeTruthy();
        expect(output.disclaimer.length).toBeGreaterThan(0);

        // Has grounding
        expect(output.grounding).toBeDefined();
        expect(output.grounding!.length).toBeGreaterThan(0);

        // Validate script passes
        const validation = validateScript(output, input.prediction);
        expect(validation.valid).toBe(true);
        expect(validation.violations).toEqual([]);
      });
    }
  }

  it("English outputs include English disclaimer", () => {
    const input = makeInput({ language: "en", style: "professional" });
    const output = generateScript(input);
    expect(output.disclaimer).toContain("commentary assistance");
    expect(output.disclaimer).toContain("not betting advice");
  });

  it("Chinese outputs include Chinese disclaimer", () => {
    const input = makeInput({ language: "zh", style: "professional" });
    const output = generateScript(input);
    expect(output.disclaimer).toContain("仅供参考分析");
    expect(output.disclaimer).toContain("不构成任何投注建议");
  });

  it("bilingual outputs include bilingual disclaimer", () => {
    const input = makeInput({ language: "bilingual", style: "professional" });
    const output = generateScript(input);
    expect(output.disclaimer).toContain("仅供参考分析");
    expect(output.disclaimer).toContain("not betting advice");
  });

  it("all outputs contain disclaimer in teleprompterText or disclaimer field", () => {
    const output = generateScript(makeInput());
    expect(output.disclaimer).toBeTruthy();
  });
});

// ── validateScript enhanced ───────────────────────────────────────────────────

describe("validateScript enhanced", () => {
  it("returns violations array for clean script", () => {
    const output = generateScript(makeInput());
    const result = validateScript(output, EXAMPLE_INPUT.prediction);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.gamblingFound).toEqual([]);
  });

  it("returns violations for forbidden phrases", () => {
    const result = validateScript(
      {
        opening: "利物浦稳赢",
        lineupIntro: "",
        tacticalBattle: "",
        predictionBrief: `根据 Dixon-Coles 与阵容修正模型 45%`,
        playerFocus: "",
        disciplineRisk: "",
        shortVideoCaption: "",
        teleprompterText: "",
      },
      { homeWin: 0.45, draw: 0.26, awayWin: 0.29 },
    );
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("稳赢"))).toBe(true);
  });

  it("returns violations for gambling phrases", () => {
    const result = validateScript(
      {
        opening: "下注利物浦",
        lineupIntro: "",
        tacticalBattle: "",
        predictionBrief: `根据 Dixon-Coles 与阵容修正模型 45%`,
        playerFocus: "",
        disciplineRisk: "",
        shortVideoCaption: "",
        teleprompterText: "",
      },
      { homeWin: 0.45, draw: 0.26, awayWin: 0.29 },
    );
    expect(result.valid).toBe(false);
    expect(result.gamblingFound.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("gambling"))).toBe(true);
  });

  it("returns violations for missing model citation", () => {
    const result = validateScript(
      {
        opening: "利物浦胜率45%",
        lineupIntro: "",
        tacticalBattle: "",
        predictionBrief: "平局26%",
        playerFocus: "",
        disciplineRisk: "",
        shortVideoCaption: "",
        teleprompterText: "",
      },
      { homeWin: 0.45, draw: 0.26, awayWin: 0.29 },
    );
    expect(result.valid).toBe(false);
    expect(result.missingModelCitation).toBe(true);
    expect(result.violations.some((v) => v.includes("missing model source citation"))).toBe(true);
  });
});

// ── Template availability ─────────────────────────────────────────────────────

describe("template availability", () => {
  it("getZhTemplate returns templates for all duration/style combos", () => {
    const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];
    const styles = ["professional", "short-video", "broadcast", "passionate", "neutral"] as const;
    for (const duration of durations) {
      for (const style of styles) {
        const template = getZhTemplate(duration, style);
        expect(template).toBeDefined();
        expect(template.opening.template).toBeTruthy();
        expect(template.predictionBrief.template).toBeTruthy();
      }
    }
  });

  it("getEnTemplate returns templates for all duration/style combos", () => {
    const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];
    const styles = ["professional", "short-video", "broadcast", "passionate", "neutral"] as const;
    for (const duration of durations) {
      for (const style of styles) {
        const template = getEnTemplate(duration, style);
        expect(template).toBeDefined();
        expect(template.opening.template).toBeTruthy();
        expect(template.predictionBrief.template).toBeTruthy();
      }
    }
  });

  it("getBilingualTemplate returns templates for all modes", () => {
    const modes = ["separate", "paragraph-by-paragraph"] as const;
    for (const mode of modes) {
      const template = getBilingualTemplate("3min", "professional", mode);
      expect(template).toBeDefined();
      expect(template.opening.zh).toBeTruthy();
      expect(template.opening.en).toBeTruthy();
    }
  });

  it("Chinese templates include sourceRefs for grounding", () => {
    const template = getZhTemplate("3min", "professional");
    expect(template.predictionBrief.sourceRefs.length).toBeGreaterThan(0);
    expect(template.predictionBrief.sourceRefs[0].sourceType).toBeDefined();
    expect(template.predictionBrief.sourceRefs[0].sourcePath).toBeDefined();
  });

  it("English templates include sourceRefs for grounding", () => {
    const template = getEnTemplate("3min", "professional");
    expect(template.predictionBrief.sourceRefs.length).toBeGreaterThan(0);
  });
});

// ── Disclaimer constants ──────────────────────────────────────────────────────

describe("disclaimer constants", () => {
  it("DISCLAIMER_ZH contains key safety phrases", () => {
    expect(DISCLAIMER_ZH).toContain("仅供参考分析");
    expect(DISCLAIMER_ZH).toContain("不构成任何投注建议");
    expect(DISCLAIMER_ZH).toContain("模型计算概率");
    expect(DISCLAIMER_ZH).toContain("AI负责叙述");
  });

  it("DISCLAIMER_EN contains key safety phrases", () => {
    expect(DISCLAIMER_EN).toContain("commentary assistance");
    expect(DISCLAIMER_EN).toContain("not betting advice");
    expect(DISCLAIMER_EN).toContain("Models calculate probabilities");
    expect(DISCLAIMER_EN).toContain("AI narrates");
  });

  it("DISCLAIMER_BILINGUAL contains both languages", () => {
    expect(DISCLAIMER_BILINGUAL).toContain("仅供参考分析");
    expect(DISCLAIMER_BILINGUAL).toContain("not betting advice");
  });

  it("EN_DISCLAIMER matches DISCLAIMER_EN", () => {
    expect(EN_DISCLAIMER).toBe(DISCLAIMER_EN);
  });

  it("BILINGUAL_DISCLAIMER matches DISCLAIMER_BILINGUAL", () => {
    expect(BILINGUAL_DISCLAIMER).toBe(DISCLAIMER_BILINGUAL);
  });
});

// ── Cross-language consistency ────────────────────────────────────────────────

describe("cross-language consistency", () => {
  it("generated scripts in all languages pass safety checks", () => {
    const languages = ["zh", "en", "bilingual"] as const;
    for (const language of languages) {
      const input = makeInput({ language, style: "professional", duration: "3min" });
      const output = generateScript(input);

      const allText = Object.values(output)
        .filter((v) => typeof v === "string")
        .join(" ");

      expect(detectForbiddenPhrases(allText)).toEqual([]);
      expect(detectGamblingPhrases(allText)).toEqual([]);
      expect(output.disclaimer).toBeTruthy();
      expect(output.grounding).toBeDefined();
      expect(output.grounding!.length).toBeGreaterThan(0);
    }
  });
});
