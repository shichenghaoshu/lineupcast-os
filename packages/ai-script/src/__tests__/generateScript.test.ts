// @lineupcast/ai-script — tests for generateScript

import { describe, it, expect } from "vitest";
import { generateScript, generateScriptWithLlm } from "../generateScript.js";
import type { ScriptInput, ScriptOutput, ScriptStyle, ScriptDuration } from "../types.js";
import {
  sanitizeForbiddenPhrases,
  detectForbiddenPhrases,
  validateScript,
  validateProbabilitiesInText,
  hasModelSourceCitation,
} from "../forbidden.js";
import { SYSTEM_PROMPT, DURATION_PROMPTS, STYLE_PROMPTS, buildPrompt, SCRIPT_TEMPLATES } from "../templates.js";
import { scriptOutputSchema } from "../schema.js";
import { EXAMPLE_INPUT } from "../__fixtures__/example.js";

// ── Shared test fixture builder ───────────────────────────────────────────────

function makeInput(overrides?: Partial<ScriptInput>): ScriptInput {
  return {
    ...EXAMPLE_INPUT,
    ...overrides,
  } as ScriptInput;
}

// ── generateScript ────────────────────────────────────────────────────────────

describe("generateScript", () => {
  it("returns all required ScriptOutput fields", () => {
    const output = generateScript(makeInput());
    const expectedKeys: (keyof ScriptOutput)[] = [
      "opening",
      "lineupIntro",
      "tacticalBattle",
      "predictionBrief",
      "playerFocus",
      "disciplineRisk",
      "shortVideoCaption",
      "teleprompterText",
    ];
    for (const key of expectedKeys) {
      expect(output[key]).toBeDefined();
      expect(typeof output[key]).toBe("string");
      expect(output[key]?.length).toBeGreaterThan(0);
    }
  });

  it("contains no forbidden phrases", () => {
    const output = generateScript(makeInput());
    const allText = Object.values(output).join(" ");
    const forbidden = detectForbiddenPhrases(allText);
    expect(forbidden).toEqual([]);
  });

  it("includes model source citation", () => {
    const output = generateScript(makeInput());
    expect(hasModelSourceCitation(output.predictionBrief)).toBe(true);
    expect(hasModelSourceCitation(output.teleprompterText)).toBe(true);
  });

  it("uses correct probabilities from input", () => {
    const input = makeInput();
    const output = generateScript(input);
    const homeWinPct = Math.round(input.prediction.homeWin * 100);
    const awayWinPct = Math.round(input.prediction.awayWin * 100);
    expect(output.predictionBrief).toContain(`${homeWinPct}%`);
    expect(output.predictionBrief).toContain(`${awayWinPct}%`);
  });

  it("includes team names in opening", () => {
    const output = generateScript(makeInput());
    expect(output.opening).toContain("利物浦");
    expect(output.opening).toContain("阿森纳");
  });

  it("includes formation in lineupIntro", () => {
    const output = generateScript(makeInput());
    expect(output.lineupIntro).toContain("4-3-3");
  });

  it("includes top goal scorers in playerFocus", () => {
    const output = generateScript(makeInput());
    expect(output.playerFocus).toContain("Salah");
    expect(output.playerFocus).toContain("Saka");
  });

  it("generates Chinese example fixture without errors", () => {
    const output = generateScript(EXAMPLE_INPUT);
    expect(output.opening).toBeTruthy();
    expect(output.teleprompterText).toBeTruthy();
  });
});

describe("generateScriptWithLlm", () => {
  it("falls back when an LLM invents a probability", async () => {
    const input = makeInput({ language: "en" });
    const fallback = generateScript(input);
    const output = await generateScriptWithLlm(input, {
      async generateText() {
        return {
          text: JSON.stringify({
            ...fallback,
            predictionBrief:
              "Based on Dixon-Coles with lineup adjustment model: invented home win 99%.",
          }),
          provider: "mock",
          model: "test",
          latencyMs: 1,
        };
      },
    });

    expect(output.predictionBrief).toBe(fallback.predictionBrief);
  });

  it("accepts a safe LLM rewrite that keeps supplied percentages", async () => {
    const input = makeInput({ language: "en" });
    const fallback = generateScript(input);
    const safePrediction =
      "Based on Dixon-Coles with lineup adjustment model: Liverpool win 45%, draw 26%, Arsenal win 29%.";
    const output = await generateScriptWithLlm(input, {
      async generateText() {
        return {
          text: JSON.stringify({
            ...fallback,
            predictionBrief: safePrediction,
          }),
          provider: "mock",
          model: "test",
          latencyMs: 1,
        };
      },
    });

    expect(output.predictionBrief).toBe(safePrediction);
  });
});

// ── Styles ────────────────────────────────────────────────────────────────────

describe("generateScript styles", () => {
  const styles: ScriptStyle[] = ["professional", "short-video", "passionate", "neutral", "broadcast"];

  for (const style of styles) {
    it(`produces valid output for style="${style}"`, () => {
      const output = generateScript(makeInput({ style }));
      const allText = Object.values(output).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
      expect(hasModelSourceCitation(allText)).toBe(true);
    });
  }

  it("short-video style produces concise opening", () => {
    const output = generateScript(makeInput({ style: "short-video" }));
    expect(output.opening.length).toBeLessThan(80);
  });

  it("bilingual language includes Chinese and English text", () => {
    const output = generateScript(makeInput({ language: "bilingual", bilingualMode: "paragraph-by-paragraph" }));
    const allText = Object.values(output).join(" ");
    expect(output.language).toBe("bilingual");
    expect(output.teleprompterText).toContain("根据 Dixon-Coles 与阵容修正模型");
    expect(allText).toMatch(/[A-Za-z]{3,}/);
  });

  it("legacy bilingual style maps to bilingual language safely", () => {
    const output = generateScript(makeInput({ style: "bilingual" }));
    expect(output.language).toBe("bilingual");
    expect(output.style).toBe("professional");
    expect(detectForbiddenPhrases(Object.values(output).join(" "))).toEqual([]);
  });

  it("English language uses supplied probabilities without forbidden absolutes", () => {
    const input = makeInput({ language: "en", style: "broadcast" });
    const output = generateScript(input);
    expect(output.language).toBe("en");
    expect(output.predictionBrief).toContain("45%");
    expect(output.predictionBrief).toContain("26%");
    expect(output.predictionBrief).toContain("29%");
    expect(output.predictionBrief).toContain("Based on Dixon-Coles with lineup adjustment model");
    expect(detectForbiddenPhrases(Object.values(output).join(" "))).toEqual([]);
  });
});

// ── Durations ─────────────────────────────────────────────────────────────────

describe("generateScript durations", () => {
  const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];

  for (const duration of durations) {
    it(`produces valid output for duration="${duration}"`, () => {
      const output = generateScript(makeInput({ duration }));
      const allText = Object.values(output).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
      expect(hasModelSourceCitation(allText)).toBe(true);
    });
  }

  it("15s teleprompterText is shorter than 3min", () => {
    const short_ = generateScript(makeInput({ duration: "15s" }));
    const long_ = generateScript(makeInput({ duration: "3min" }));
    expect(short_.teleprompterText.length).toBeLessThan(long_.teleprompterText.length);
  });
});

// ── Forbidden phrases ─────────────────────────────────────────────────────────

describe("forbidden phrases", () => {
  it("detectForbiddenPhrases finds Chinese forbidden phrases", () => {
    expect(detectForbiddenPhrases("这场比赛利物浦稳赢")).toContain("稳赢");
    expect(detectForbiddenPhrases("Salah 必进")).toContain("必进");
    expect(detectForbiddenPhrases("guaranteed win")).toContain("guaranteed");
  });

  it("sanitizeForbiddenPhrases replaces all forbidden phrases", () => {
    const input = "利物浦稳赢，Salah 必进，guaranteed victory";
    const result = sanitizeForbiddenPhrases(input);
    expect(result).not.toContain("稳赢");
    expect(result).not.toContain("必进");
    expect(result).not.toContain("guaranteed");
    expect(result).toContain("概率上占优");
  });

  it("detectForbiddenPhrases returns empty for clean text", () => {
    expect(detectForbiddenPhrases("根据模型预测，利物浦概率上更占优势")).toEqual([]);
  });

  it("handles case-insensitive matching for English", () => {
    expect(detectForbiddenPhrases("This is GUARANTEED to work")).toContain("guaranteed");
    expect(detectForbiddenPhrases("Guaranteed outcome")).toContain("guaranteed");
  });
});

// ── Probability validation ────────────────────────────────────────────────────

describe("validateProbabilitiesInText", () => {
  it("returns empty when probabilities match", () => {
    const mismatches = validateProbabilitiesInText(
      "利物浦胜率45%，平局26%，阿森纳29%",
      { homeWin: 0.45, draw: 0.26, awayWin: 0.29 },
    );
    expect(mismatches).toEqual([]);
  });

  it("detects mismatched probabilities", () => {
    const mismatches = validateProbabilitiesInText(
      "利物浦胜率80%，平局26%",
      { homeWin: 0.45, draw: 0.26, awayWin: 0.29 },
    );
    expect(mismatches.length).toBeGreaterThan(0);
  });

  it("accepts small floating point drift (±1%)", () => {
    const mismatches = validateProbabilitiesInText(
      "利物浦胜率46%",
      { homeWin: 0.45, draw: 0.26, awayWin: 0.29 },
    );
    expect(mismatches).toEqual([]);
  });
});

// ── validateScript ────────────────────────────────────────────────────────────

describe("validateScript", () => {
  it("passes for clean script", () => {
    const output = generateScript(makeInput());
    const result = validateScript(output, EXAMPLE_INPUT.prediction);
    expect(result.valid).toBe(true);
    expect(result.forbiddenFound).toEqual([]);
    expect(result.missingModelCitation).toBe(false);
    expect(result.probabilityMismatches).toEqual([]);
  });

  it("fails when forbidden phrase is present", () => {
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
    expect(result.forbiddenFound).toContain("稳赢");
  });

  it("fails when model citation is missing", () => {
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
  });
});

// ── Templates ─────────────────────────────────────────────────────────────────

describe("prompt templates", () => {
  it("SYSTEM_PROMPT contains key rules", () => {
    expect(SYSTEM_PROMPT).toContain("绝不编造概率");
    expect(SYSTEM_PROMPT).toContain("禁词");
    expect(SYSTEM_PROMPT).toContain("JSON");
  });

  it("DURATION_PROMPTS has entries for all durations", () => {
    expect(Object.keys(DURATION_PROMPTS)).toEqual(["15s", "30s", "1min", "3min"]);
  });

  it("STYLE_PROMPTS has entries for all styles", () => {
    expect(Object.keys(STYLE_PROMPTS)).toEqual([
      "professional",
      "short-video",
      "passionate",
      "neutral",
      "broadcast",
      "bilingual",
    ]);
  });

  it("buildPrompt combines duration and style", () => {
    const prompt = buildPrompt("15s", "short-video");
    expect(prompt).toContain("15 秒");
    expect(prompt).toContain("短视频");
  });

  it("SCRIPT_TEMPLATES has correct section counts", () => {
    expect(SCRIPT_TEMPLATES["15s"].sections.length).toBeLessThan(SCRIPT_TEMPLATES["3min"].sections.length);
  });
});

// ── Schema ────────────────────────────────────────────────────────────────────

describe("scriptOutputSchema", () => {
  it("defines all required fields", () => {
    const required = scriptOutputSchema.required;
    expect(required).toContain("opening");
    expect(required).toContain("teleprompterText");
    expect(required).toContain("language");
    expect(required).toContain("style");
    expect(required).toContain("duration");
    expect(required.length).toBe(12);
  });

  it("has correct schema type", () => {
    expect(scriptOutputSchema.type).toBe("object");
    expect(scriptOutputSchema.$schema).toContain("json-schema");
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("input validation", () => {
  it("throws on missing match id", () => {
    expect(() =>
      generateScript(makeInput({ match: { ...EXAMPLE_INPUT.match, id: "" } })),
    ).toThrow("match.id");
  });

  it("throws on missing team name", () => {
    expect(() =>
      generateScript(
        makeInput({
          lineups: {
            ...EXAMPLE_INPUT.lineups,
            home: { ...EXAMPLE_INPUT.lineups.home, teamName: "" },
          },
        }),
      ),
    ).toThrow("teamName");
  });

  it("throws on missing prediction fields", () => {
    expect(() =>
      generateScript(
        makeInput({
          prediction: { ...EXAMPLE_INPUT.prediction, homeWin: undefined as unknown as number },
        }),
      ),
    ).toThrow("prediction.homeWin");
  });
});
