// @lineupcast/ai-script — tests for bilingual script templates

import { describe, it, expect } from "vitest";
import { buildChineseSections } from "../templates/zh.js";
import { buildEnglishSections } from "../templates/en.js";
import { buildBilingualSections } from "../templates/bilingual.js";
import { generateScript } from "../generateScript.js";
import { EXAMPLE_INPUT } from "../__fixtures__/example.js";
import {
  detectForbiddenPhrases,
  hasModelSourceCitation,
  MODEL_SOURCE_ZH,
  MODEL_SOURCE_EN,
} from "../forbidden.js";
import type { ScriptInput, ScriptDuration, ScriptStyle, BilingualMode } from "../types.js";

// ── Shared test fixture builder ───────────────────────────────────────────────

function makeInput(overrides?: Partial<ScriptInput>): ScriptInput {
  return { ...EXAMPLE_INPUT, ...overrides } as ScriptInput;
}

// ── Chinese templates ─────────────────────────────────────────────────────────

describe("buildChineseSections", () => {
  const styles: Exclude<ScriptStyle, "bilingual">[] = ["professional", "short-video", "passionate", "neutral", "broadcast"];

  for (const style of styles) {
    it(`produces all sections for style="${style}"`, () => {
      const sections = buildChineseSections(makeInput({ style }), style);
      expect(sections.opening).toBeTruthy();
      expect(sections.lineupIntro).toBeTruthy();
      expect(sections.tacticalBattle).toBeTruthy();
      expect(sections.predictionBrief).toBeTruthy();
      expect(sections.playerFocus).toBeTruthy();
      expect(sections.disciplineRisk).toBeTruthy();
      expect(sections.shortVideoCaption).toBeTruthy();
      expect(sections.teleprompterText).toBeTruthy();
    });

    it(`style="${style}" has no forbidden phrases`, () => {
      const sections = buildChineseSections(makeInput({ style }), style);
      const allText = Object.values(sections).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
    });

    it(`style="${style}" includes model source citation`, () => {
      const sections = buildChineseSections(makeInput({ style }), style);
      expect(hasModelSourceCitation(sections.predictionBrief)).toBe(true);
    });
  }

  it("short-video opening is concise", () => {
    const sections = buildChineseSections(makeInput({ style: "short-video" }), "short-video");
    expect(sections.opening.length).toBeLessThan(80);
  });

  it("contains team names in opening", () => {
    const sections = buildChineseSections(makeInput(), "professional");
    expect(sections.opening).toContain("利物浦");
    expect(sections.opening).toContain("阿森纳");
  });

  it("contains formation in lineupIntro", () => {
    const sections = buildChineseSections(makeInput(), "professional");
    expect(sections.lineupIntro).toContain("4-3-3");
  });

  it("contains goal scorers in playerFocus", () => {
    const sections = buildChineseSections(makeInput(), "professional");
    expect(sections.playerFocus).toContain("Salah");
    expect(sections.playerFocus).toContain("Saka");
  });

  it("uses correct probabilities from input", () => {
    const input = makeInput();
    const sections = buildChineseSections(input, "professional");
    const homeWinPct = Math.round(input.prediction.homeWin * 100);
    const awayWinPct = Math.round(input.prediction.awayWin * 100);
    expect(sections.predictionBrief).toContain(`${homeWinPct}%`);
    expect(sections.predictionBrief).toContain(`${awayWinPct}%`);
  });

  it("includes goal keeper in lineupIntro", () => {
    const sections = buildChineseSections(makeInput(), "professional");
    expect(sections.lineupIntro).toContain("Alisson");
  });
});

// ── Chinese template durations ────────────────────────────────────────────────

describe("buildChineseSections durations", () => {
  const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];

  for (const duration of durations) {
    it(`produces valid output for duration="${duration}"`, () => {
      const sections = buildChineseSections(makeInput({ duration }), "professional");
      const allText = Object.values(sections).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
      expect(hasModelSourceCitation(allText)).toBe(true);
    });
  }

  it("15s teleprompterText is shorter than 3min", () => {
    const short_ = buildChineseSections(makeInput({ duration: "15s" }), "professional");
    const long_ = buildChineseSections(makeInput({ duration: "3min" }), "professional");
    expect(short_.teleprompterText.length).toBeLessThan(long_.teleprompterText.length);
  });

  it("15s teleprompterText does not include lineupIntro", () => {
    const sections = buildChineseSections(makeInput({ duration: "15s" }), "professional");
    expect(sections.teleprompterText).not.toContain("首发阵容");
  });

  it("3min teleprompterText includes disciplineRisk", () => {
    const sections = buildChineseSections(makeInput({ duration: "3min" }), "professional");
    expect(sections.teleprompterText).toContain("纪律风险");
  });
});

// ── English templates ─────────────────────────────────────────────────────────

describe("buildEnglishSections", () => {
  const styles: Exclude<ScriptStyle, "bilingual">[] = ["professional", "short-video", "passionate", "neutral", "broadcast"];

  for (const style of styles) {
    it(`produces all sections for style="${style}"`, () => {
      const sections = buildEnglishSections(makeInput({ style }), style);
      expect(sections.opening).toBeTruthy();
      expect(sections.lineupIntro).toBeTruthy();
      expect(sections.tacticalBattle).toBeTruthy();
      expect(sections.predictionBrief).toBeTruthy();
      expect(sections.playerFocus).toBeTruthy();
      expect(sections.disciplineRisk).toBeTruthy();
      expect(sections.shortVideoCaption).toBeTruthy();
      expect(sections.teleprompterText).toBeTruthy();
    });

    it(`style="${style}" has no forbidden phrases`, () => {
      const sections = buildEnglishSections(makeInput({ style }), style);
      const allText = Object.values(sections).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
    });

    it(`style="${style}" includes model source citation`, () => {
      const sections = buildEnglishSections(makeInput({ style }), style);
      expect(hasModelSourceCitation(sections.predictionBrief)).toBe(true);
    });
  }

  it("all sections contain disclaimer text", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    expect(sections.opening).toContain("For commentary assistance, not betting advice.");
    expect(sections.predictionBrief).toContain("For commentary assistance, not betting advice.");
    expect(sections.teleprompterText).toContain("For commentary assistance, not betting advice.");
  });

  it("short-video opening is concise", () => {
    const sections = buildEnglishSections(makeInput({ style: "short-video" }), "short-video");
    expect(sections.opening.length).toBeLessThan(120);
  });

  it("contains team names in opening", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    expect(sections.opening).toContain("Liverpool");
    expect(sections.opening).toContain("Arsenal");
  });

  it("contains formation in lineupIntro", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    expect(sections.lineupIntro).toContain("4-3-3");
  });

  it("contains goal scorers in playerFocus", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    expect(sections.playerFocus).toContain("Salah");
    expect(sections.playerFocus).toContain("Saka");
  });

  it("uses correct probabilities from input", () => {
    const input = makeInput();
    const sections = buildEnglishSections(input, "professional");
    const homeWinPct = Math.round(input.prediction.homeWin * 100);
    const awayWinPct = Math.round(input.prediction.awayWin * 100);
    expect(sections.predictionBrief).toContain(`${homeWinPct}%`);
    expect(sections.predictionBrief).toContain(`${awayWinPct}%`);
  });

  it("uses Dixon-Coles model reference in English", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    expect(sections.predictionBrief).toContain(MODEL_SOURCE_EN);
  });
});

// ── English template durations ────────────────────────────────────────────────

describe("buildEnglishSections durations", () => {
  const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];

  for (const duration of durations) {
    it(`produces valid output for duration="${duration}"`, () => {
      const sections = buildEnglishSections(makeInput({ duration }), "professional");
      const allText = Object.values(sections).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
      expect(hasModelSourceCitation(allText)).toBe(true);
    });
  }

  it("15s teleprompterText is shorter than 3min", () => {
    const short_ = buildEnglishSections(makeInput({ duration: "15s" }), "professional");
    const long_ = buildEnglishSections(makeInput({ duration: "3min" }), "professional");
    expect(short_.teleprompterText.length).toBeLessThan(long_.teleprompterText.length);
  });

  it("3min teleprompterText includes discipline section", () => {
    const sections = buildEnglishSections(makeInput({ duration: "3min" }), "professional");
    expect(sections.teleprompterText).toContain("Discipline watch");
  });
});

// ── Bilingual templates ───────────────────────────────────────────────────────

describe("buildBilingualSections", () => {
  const modes: BilingualMode[] = ["separate", "paragraph-by-paragraph"];

  for (const mode of modes) {
    it(`produces all sections for mode="${mode}"`, () => {
      const sections = buildBilingualSections(makeInput(), "professional", mode);
      expect(sections.opening).toBeTruthy();
      expect(sections.lineupIntro).toBeTruthy();
      expect(sections.tacticalBattle).toBeTruthy();
      expect(sections.predictionBrief).toBeTruthy();
      expect(sections.playerFocus).toBeTruthy();
      expect(sections.disciplineRisk).toBeTruthy();
      expect(sections.shortVideoCaption).toBeTruthy();
      expect(sections.teleprompterText).toBeTruthy();
    });

    it(`mode="${mode}" has no forbidden phrases`, () => {
      const sections = buildBilingualSections(makeInput(), "professional", mode);
      const allText = Object.values(sections).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
    });

    it(`mode="${mode}" includes both Chinese and English model citations`, () => {
      const sections = buildBilingualSections(makeInput(), "professional", mode);
      const allText = Object.values(sections).join(" ");
      expect(allText).toContain(MODEL_SOURCE_ZH);
      expect(allText).toContain(MODEL_SOURCE_EN);
    });

    it(`mode="${mode}" contains both team names in both languages`, () => {
      const sections = buildBilingualSections(makeInput(), "professional", mode);
      expect(sections.opening).toContain("利物浦");
      expect(sections.opening).toContain("Liverpool");
      expect(sections.opening).toContain("阿森纳");
      expect(sections.opening).toContain("Arsenal");
    });
  }

  it("separate mode has language markers in opening", () => {
    const sections = buildBilingualSections(makeInput(), "professional", "separate");
    expect(sections.opening).toContain("中文：");
    expect(sections.opening).toContain("English:");
  });

  it("separate mode has language markers in teleprompterText", () => {
    const sections = buildBilingualSections(makeInput(), "professional", "separate");
    expect(sections.teleprompterText).toContain("【中文】");
    expect(sections.teleprompterText).toContain("【English】");
  });

  it("paragraph-by-paragraph mode interleaves paragraphs in teleprompterText", () => {
    const sections = buildBilingualSections(makeInput(), "professional", "paragraph-by-paragraph");
    // The teleprompter should contain both Chinese and English text
    const teleprompter = sections.teleprompterText;
    expect(teleprompter).toContain("根据 Dixon-Coles");
    expect(teleprompter).toContain("Based on Dixon-Coles");
  });

  it("separate mode teleprompter is longer than single-language", () => {
    const zhSections = buildChineseSections(makeInput(), "professional");
    const biSections = buildBilingualSections(makeInput(), "professional", "separate");
    expect(biSections.teleprompterText.length).toBeGreaterThan(zhSections.teleprompterText.length);
  });
});

// ── Bilingual template durations ──────────────────────────────────────────────

describe("buildBilingualSections durations", () => {
  const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];

  for (const duration of durations) {
    it(`produces valid bilingual output for duration="${duration}"`, () => {
      const sections = buildBilingualSections(makeInput({ duration }), "professional", "paragraph-by-paragraph");
      const allText = Object.values(sections).join(" ");
      expect(detectForbiddenPhrases(allText)).toEqual([]);
      expect(hasModelSourceCitation(allText)).toBe(true);
    });
  }
});

// ── Template selection via generateScript ─────────────────────────────────────

describe("generateScript template selection", () => {
  it("selects Chinese template when language=zh", () => {
    const output = generateScript(makeInput({ language: "zh" }));
    expect(output.language).toBe("zh");
    expect(output.predictionBrief).toContain("根据 Dixon-Coles");
  });

  it("selects English template when language=en", () => {
    const output = generateScript(makeInput({ language: "en" }));
    expect(output.language).toBe("en");
    expect(output.predictionBrief).toContain("Based on Dixon-Coles");
    expect(output.teleprompterText).toContain("For commentary assistance, not betting advice.");
  });

  it("selects bilingual template when language=bilingual", () => {
    const output = generateScript(makeInput({ language: "bilingual" }));
    expect(output.language).toBe("bilingual");
    const allText = Object.values(output).join(" ");
    expect(allText).toContain("根据 Dixon-Coles");
    expect(allText).toContain("Based on Dixon-Coles");
  });

  it("defaults to Chinese when no language specified", () => {
    const output = generateScript(makeInput({}));
    expect(output.language).toBe("zh");
    expect(output.predictionBrief).toContain("根据 Dixon-Coles");
  });

  it("resolves bilingual style to bilingual language", () => {
    const output = generateScript(makeInput({ style: "bilingual" }));
    expect(output.language).toBe("bilingual");
    expect(output.style).toBe("professional");
  });

  it("all durations produce valid output across all languages", () => {
    const durations: ScriptDuration[] = ["15s", "30s", "1min", "3min"];
    for (const duration of durations) {
      for (const lang of ["zh", "en", "bilingual"] as const) {
        const output = generateScript(makeInput({ duration, language: lang }));
        const allText = Object.values(output).join(" ");
        expect(detectForbiddenPhrases(allText)).toEqual([]);
        expect(hasModelSourceCitation(allText)).toBe(true);
      }
    }
  });

  it("all styles produce valid output across all languages", () => {
    const styles: ScriptStyle[] = ["professional", "short-video", "passionate", "neutral", "broadcast"];
    for (const style of styles) {
      for (const lang of ["zh", "en"] as const) {
        const output = generateScript(makeInput({ style, language: lang }));
        const allText = Object.values(output).join(" ");
        expect(detectForbiddenPhrases(allText)).toEqual([]);
        expect(hasModelSourceCitation(allText)).toBe(true);
      }
    }
  });
});

// ── Grounding placeholder verification ────────────────────────────────────────

describe("template grounding placeholders", () => {
  it("Chinese predictionBrief contains probability placeholders resolved to data", () => {
    const input = makeInput();
    const sections = buildChineseSections(input, "professional");
    const homeWinPct = Math.round(input.prediction.homeWin * 100);
    expect(sections.predictionBrief).toContain(`${homeWinPct}%`);
    expect(sections.predictionBrief).not.toContain("{{homeWinPct}}");
  });

  it("English predictionBrief contains probability placeholders resolved to data", () => {
    const input = makeInput();
    const sections = buildEnglishSections(input, "professional");
    const homeWinPct = Math.round(input.prediction.homeWin * 100);
    expect(sections.predictionBrief).toContain(`${homeWinPct}%`);
    expect(sections.predictionBrief).not.toContain("{{homeWinPct}}");
  });

  it("Chinese playerFocus resolves player names from input", () => {
    const sections = buildChineseSections(makeInput(), "professional");
    expect(sections.playerFocus).toContain("Salah");
    expect(sections.playerFocus).not.toContain("{{playerName}}");
  });

  it("English playerFocus resolves player names from input", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    expect(sections.playerFocus).toContain("Salah");
    expect(sections.playerFocus).not.toContain("{{playerName}}");
  });

  it("no template placeholder syntax remains in any section", () => {
    const zh = buildChineseSections(makeInput(), "professional");
    const en = buildEnglishSections(makeInput(), "professional");
    const allText = [...Object.values(zh), ...Object.values(en)].join(" ");
    expect(allText).not.toMatch(/\{\{[a-zA-Z]+\}\}/);
  });
});

// ── No betting language ───────────────────────────────────────────────────────

describe("no betting language", () => {
  it("Chinese templates avoid betting terms", () => {
    const sections = buildChineseSections(makeInput(), "professional");
    const allText = Object.values(sections).join(" ");
    // No absolute claims
    expect(allText).not.toContain("稳赢");
    expect(allText).not.toContain("必胜");
    expect(allText).not.toContain("必进");
    expect(allText).not.toContain("guaranteed");
  });

  it("English templates avoid betting terms", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    const allText = Object.values(sections).join(" ");
    expect(allText).not.toContain("guaranteed");
    expect(allText).not.toContain("guarantee");
    expect(allText).not.toContain("certain win");
    expect(allText).not.toContain("bet");
  });

  it("English templates include disclaimer", () => {
    const sections = buildEnglishSections(makeInput(), "professional");
    expect(sections.teleprompterText).toContain("For commentary assistance, not betting advice.");
  });

  it("bilingual templates avoid betting terms", () => {
    const sections = buildBilingualSections(makeInput(), "professional", "separate");
    const allText = Object.values(sections).join(" ");
    expect(allText).not.toContain("稳赢");
    expect(allText).not.toContain("必胜");
    expect(allText).not.toContain("guaranteed");
  });
});

// ── Consistency between languages ─────────────────────────────────────────────

describe("cross-language consistency", () => {
  it("Chinese and English predictionBrief use same probabilities", () => {
    const input = makeInput();
    const zh = buildChineseSections(input, "professional");
    const en = buildEnglishSections(input, "professional");

    const homeWinPct = Math.round(input.prediction.homeWin * 100);
    const awayWinPct = Math.round(input.prediction.awayWin * 100);

    expect(zh.predictionBrief).toContain(`${homeWinPct}%`);
    expect(en.predictionBrief).toContain(`${homeWinPct}%`);
    expect(zh.predictionBrief).toContain(`${awayWinPct}%`);
    expect(en.predictionBrief).toContain(`${awayWinPct}%`);
  });

  it("Chinese and English teleprompterText have similar structure", () => {
    const input = makeInput({ duration: "3min" });
    const zh = buildChineseSections(input, "professional");
    const en = buildEnglishSections(input, "professional");

    // Both should have multiple paragraphs (double-newline separated)
    const zhParagraphs = zh.teleprompterText.split("\n\n").length;
    const enParagraphs = en.teleprompterText.split("\n\n").length;
    expect(zhParagraphs).toBeGreaterThanOrEqual(3);
    expect(enParagraphs).toBeGreaterThanOrEqual(3);
  });

  it("bilingual output includes content from both languages", () => {
    const zh = buildChineseSections(makeInput(), "professional");
    const en = buildEnglishSections(makeInput(), "professional");
    const bi = buildBilingualSections(makeInput(), "professional", "separate");

    // Bilingual should contain content from both
    expect(bi.opening).toContain(zh.opening.split("，")[0] ?? "");
    expect(bi.opening).toContain(en.opening.split(":")[0] ?? "");
  });
});
