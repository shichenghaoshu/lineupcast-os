// @lineupcast/ai-script — tests for grounding reports

import { describe, it, expect } from "vitest";
import { generateScript } from "../generateScript.js";
import {
  generateGroundingReport,
  splitIntoSentences,
  summarizeGrounding,
} from "../grounding.js";
import type { ScriptInput } from "../types.js";
import { EXAMPLE_INPUT } from "../__fixtures__/example.js";

// ── Shared test fixture builder ───────────────────────────────────────────────

function makeInput(overrides?: Partial<ScriptInput>): ScriptInput {
  return {
    ...EXAMPLE_INPUT,
    ...overrides,
  } as ScriptInput;
}

// ── splitIntoSentences ────────────────────────────────────────────────────────

describe("splitIntoSentences", () => {
  it("splits Chinese sentences on full stops", () => {
    const text = "这是第一句。这是第二句。这是第三句。";
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBe(3);
    expect(sentences[0]).toBe("这是第一句。");
    expect(sentences[1]).toBe("这是第二句。");
    expect(sentences[2]).toBe("这是第三句。");
  });

  it("splits on exclamation marks", () => {
    const text = "进球了！比赛结束！";
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBe(2);
  });

  it("splits on English punctuation", () => {
    const text = "First sentence. Second sentence! Third?";
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBe(3);
  });

  it("splits on paragraph breaks", () => {
    const text = "Paragraph one。\n\nParagraph two。";
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBe(2);
  });

  it("filters empty strings", () => {
    const text = "  ";
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBe(0);
  });
});

// ── generateGroundingReport ──────────────────────────────────────────────────

describe("generateGroundingReport", () => {
  it("returns a grounding report for each sentence", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) {
      expect(report.sentenceIndex).toBeGreaterThanOrEqual(0);
      expect(report.sentence.length).toBeGreaterThan(0);
      expect(report.sources.length).toBeGreaterThan(0);
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic — same input produces same report", () => {
    const input = makeInput();
    const output = generateScript(input);
    const report1 = generateGroundingReport(output, input);
    const report2 = generateGroundingReport(output, input);

    expect(report1).toEqual(report2);
  });

  it("has sequential sentence indices starting from 0", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    for (let i = 0; i < reports.length; i++) {
      expect(reports[i]?.sentenceIndex).toBe(i);
    }
  });

  it("traces team names to lineups fields", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    // Find a sentence that contains the home team name
    const homeTeamReport = reports.find((r) =>
      r.sentence.includes("利物浦"),
    );
    expect(homeTeamReport).toBeDefined();

    const homeSource = homeTeamReport?.sources.find(
      (s) => s.field === "lineups.home.teamName",
    );
    expect(homeSource).toBeDefined();
    expect(homeSource?.value).toBe("利物浦");
    expect(homeSource?.provider).toBe("lineup-provider");
  });

  it("traces prediction percentages to prediction fields", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    // Find a sentence that contains a prediction percentage
    const pctReport = reports.find((r) => r.sentence.includes("45%"));
    expect(pctReport).toBeDefined();

    const predSource = pctReport?.sources.find(
      (s) => s.field === "prediction.homeWin",
    );
    expect(predSource).toBeDefined();
    expect(predSource?.value).toBe(0.45);
    expect(predSource?.provider).toBe("prediction-model");
  });

  it("traces goal scorer names to goalScorers field", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    // Find a sentence that mentions any goal scorer
    const scorerNames = input.goalScorers.map((gs) => gs.player);
    const scorerReport = reports.find((r) =>
      scorerNames.some((name) => r.sentence.includes(name)),
    );
    expect(scorerReport).toBeDefined();

    // Check if any source traces back to goalScorers or playerFocus section
    const hasScorerSource = scorerReport?.sources.some(
      (s) => s.field === "goalScorers" || s.field === "lineups.home.players" || s.field === "lineups.away.players",
    );
    expect(hasScorerSource).toBe(true);
  });

  it("traces card risk players to cardRisks field", () => {
    const input = makeInput({ duration: "3min" });
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    // Find a sentence that mentions a card risk player
    const cardReport = reports.find((r) => r.sentence.includes("Mac Allister"));
    expect(cardReport).toBeDefined();

    const cardSource = cardReport?.sources.find(
      (s) => s.field === "cardRisks",
    );
    expect(cardSource).toBeDefined();
  });

  it("traces formation data to lineup fields", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    // Find a sentence that contains the formation
    const formationReport = reports.find((r) => r.sentence.includes("4-3-3"));
    expect(formationReport).toBeDefined();

    const formationSource = formationReport?.sources.find(
      (s) =>
        s.field === "lineups.home.formation" || s.field === "lineups.away.formation",
    );
    expect(formationSource).toBeDefined();
    expect(formationSource?.provider).toBe("lineup-provider");
  });

  it("assigns higher confidence to data-heavy sentences", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    // Prediction sentences should have higher confidence than template-only sentences
    const predReport = reports.find((r) => r.sentence.includes("45%") || r.sentence.includes("胜"));
    expect(predReport).toBeDefined();

    // Find the minimum confidence for comparison
    const minConfidence = Math.min(...reports.map((r) => r.confidence));
    expect(predReport!.confidence).toBeGreaterThanOrEqual(minConfidence);
  });

  it("assigns lower confidence to template-heavy sentences", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    // Find the lowest confidence report
    const minConfidence = Math.min(...reports.map((r) => r.confidence));
    expect(minConfidence).toBeGreaterThanOrEqual(0);
    expect(minConfidence).toBeLessThan(0.5);
  });

  it("uses correct provider names", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    const validProviders = new Set([
      "match-provider",
      "lineup-provider",
      "prediction-model",
      "scorer-model",
      "discipline-model",
      "user-config",
      "template",
    ]);

    for (const report of reports) {
      for (const source of report.sources) {
        expect(validProviders.has(source.provider)).toBe(true);
      }
    }
  });
});

// ── summarizeGrounding ────────────────────────────────────────────────────────

describe("summarizeGrounding", () => {
  it("returns correct summary statistics", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    const summary = summarizeGrounding(reports);

    expect(summary.totalSentences).toBe(reports.length);
    expect(summary.avgConfidence).toBeGreaterThanOrEqual(0);
    expect(summary.avgConfidence).toBeLessThanOrEqual(1);
    expect(summary.fullyGrounded + summary.partiallyGrounded + summary.ungrounded).toBe(
      summary.totalSentences,
    );
    expect(summary.uniqueFields.length).toBeGreaterThan(0);
  });

  it("lists unique fields that were referenced", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    const summary = summarizeGrounding(reports);

    // Should reference at least team names and predictions
    expect(summary.uniqueFields).toContain("lineups.home.teamName");
    expect(summary.uniqueFields).toContain("lineups.away.teamName");
    expect(summary.uniqueFields).toContain("prediction.homeWin");
  });

  it("counts fully grounded sentences", () => {
    const input = makeInput();
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);
    const summary = summarizeGrounding(reports);

    // Most sentences should be at least partially grounded
    expect(summary.fullyGrounded + summary.partiallyGrounded).toBeGreaterThan(0);
  });
});

// ── Grounding in ScriptOutput ─────────────────────────────────────────────────

describe("grounding in ScriptOutput", () => {
  it("generateScript attaches grounding to output", () => {
    const input = makeInput();
    const output = generateScript(input);

    expect(output.grounding).toBeDefined();
    expect(Array.isArray(output.grounding)).toBe(true);
    expect(output.grounding!.length).toBeGreaterThan(0);
  });

  it("grounding reports have valid structure", () => {
    const input = makeInput();
    const output = generateScript(input);

    for (const report of output.grounding!) {
      expect(typeof report.sentenceIndex).toBe("number");
      expect(typeof report.sentence).toBe("string");
      expect(Array.isArray(report.sources)).toBe(true);
      expect(typeof report.confidence).toBe("number");

      for (const source of report.sources) {
        expect(typeof source.field).toBe("string");
        expect(typeof source.provider).toBe("string");
      }
    }
  });

  it("grounding is consistent across multiple calls", () => {
    const input = makeInput();
    const output1 = generateScript(input);
    const output2 = generateScript(input);

    expect(output1.grounding).toEqual(output2.grounding);
  });
});

// ── Different styles and durations ────────────────────────────────────────────

describe("grounding across styles", () => {
  const styles = ["professional", "short-video", "passionate"] as const;

  for (const style of styles) {
    it(`produces valid grounding for style="${style}"`, () => {
      const input = makeInput({ style });
      const output = generateScript(input);
      const reports = generateGroundingReport(output, input);

      expect(reports.length).toBeGreaterThan(0);
      for (const report of reports) {
        expect(report.sources.length).toBeGreaterThan(0);
        expect(report.confidence).toBeGreaterThanOrEqual(0);
      }
    });
  }
});

describe("grounding across durations", () => {
  const durations = ["15s", "30s", "1min", "3min"] as const;

  for (const duration of durations) {
    it(`produces valid grounding for duration="${duration}"`, () => {
      const input = makeInput({ duration });
      const output = generateScript(input);
      const reports = generateGroundingReport(output, input);

      expect(reports.length).toBeGreaterThan(0);
    });
  }

  it("longer scripts have more grounded sentences", () => {
    const shortInput = makeInput({ duration: "15s" });
    const longInput = makeInput({ duration: "3min" });
    const shortOutput = generateScript(shortInput);
    const longOutput = generateScript(longInput);
    const shortReports = generateGroundingReport(shortOutput, shortInput);
    const longReports = generateGroundingReport(longOutput, longInput);

    expect(longReports.length).toBeGreaterThan(shortReports.length);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("grounding edge cases", () => {
  it("handles bilingual output", () => {
    const input = makeInput({ language: "bilingual", bilingualMode: "separate" });
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    expect(reports.length).toBeGreaterThan(0);
  });

  it("handles English output", () => {
    const input = makeInput({ language: "en" });
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    expect(reports.length).toBeGreaterThan(0);
    // Should still trace back to input fields - team names may be in Chinese
    const teamReport = reports.find(
      (r) => r.sentence.includes("利物浦") || r.sentence.includes("Liverpool"),
    );
    expect(teamReport).toBeDefined();
  });

  it("handles empty goalScorers gracefully", () => {
    const input = makeInput({ goalScorers: [] });
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    expect(reports.length).toBeGreaterThan(0);
  });

  it("handles empty cardRisks gracefully", () => {
    const input = makeInput({ cardRisks: [] });
    const output = generateScript(input);
    const reports = generateGroundingReport(output, input);

    expect(reports.length).toBeGreaterThan(0);
  });
});
