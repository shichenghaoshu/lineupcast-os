import { describe, it, expect } from "vitest";
import { MockProvider } from "../mock-provider.js";

const provider = new MockProvider();

const RED_STARTER_NAMES = [
  "A. Keeper",
  "L. Wing",
  "N. Cross",
  "M. Stone",
  "R. Block",
  "D. Tempo",
  "C. Press",
  "J. Spark",
  "B. Vision",
  "K. Burst",
  "V. Finish",
];

describe("MockProvider", () => {
  describe("meta", () => {
    it("has correct id and name", () => {
      expect(provider.id).toBe("mock");
      expect(provider.meta.id).toBe("mock");
      expect(provider.meta.name).toBe("Mock Provider");
    });

    it("does not require API key", () => {
      expect(provider.meta.requiresApiKey).toBe(false);
      expect(provider.meta.tokenConfigured).toBe(false);
    });

    it("declares full status and all capabilities", () => {
      expect(provider.meta.status).toBe("full");
      expect(provider.meta.capabilities).toBeDefined();
      const caps = provider.meta.capabilities!;
      expect(caps.upcomingMatches).toBe(true);
      expect(caps.match).toBe(true);
      expect(caps.team).toBe(true);
      expect(caps.squad).toBe(true);
      expect(caps.lineup).toBe(true);
      expect(caps.matchStats).toBe(true);
      expect(caps.h2h).toBe(true);
      expect(caps.form).toBe(true);
      expect(caps.prediction).toBe(true);
    });
  });

  describe("fetchUpcomingMatches", () => {
    it("returns Manchester Red vs Shanghai Harbor", async () => {
      const matches = await provider.fetchUpcomingMatches("any-league");
      expect(matches).toHaveLength(1);
      const match = matches[0]!;
      expect(match.homeTeamId).toBe("manchester-red");
      expect(match.awayTeamId).toBe("shanghai-harbor");
      expect(match.status).toBe("scheduled");
      expect(match.homeTeam?.name).toBe("Manchester Red");
      expect(match.awayTeam?.name).toBe("Shanghai Harbor");
    });
  });

  describe("fetchMatch", () => {
    it("returns the demo match by id", async () => {
      const match = await provider.fetchMatch("demo-mr-vs-sh-001");
      expect(match.id).toBe("demo-mr-vs-sh-001");
      expect(match.venue).toBe("Red Arena");
    });

    it("throws for unknown match id", async () => {
      await expect(provider.fetchMatch("nonexistent")).rejects.toThrow("unknown match");
    });
  });

  describe("fetchTeam", () => {
    it("returns Manchester Red", async () => {
      const team = await provider.fetchTeam("manchester-red");
      expect(team.name).toBe("Manchester Red");
      expect(team.shortName).toBe("RED");
      expect(team.country).toBe("England");
    });

    it("returns Shanghai Harbor", async () => {
      const team = await provider.fetchTeam("shanghai-harbor");
      expect(team.name).toBe("Shanghai Harbor");
      expect(team.shortName).toBe("SHA");
    });

    it("throws for unknown team", async () => {
      await expect(provider.fetchTeam("unknown")).rejects.toThrow("unknown team");
    });
  });

  describe("fetchSquad", () => {
    it("returns Manchester Red full squad (starters + subs)", async () => {
      const squad = await provider.fetchSquad("manchester-red");
      expect(squad.length).toBe(16); // 11 starters + 5 subs
      const names = squad.map((p) => p.name);
      expect(names).toContain("V. Finish");
      expect(names).toContain("A. Keeper");
      expect(names).toContain("P. Save");
    });

    it("returns Shanghai Harbor full squad", async () => {
      const squad = await provider.fetchSquad("shanghai-harbor");
      expect(squad.length).toBe(15); // 11 starters + 4 subs
      const names = squad.map((p) => p.name);
      expect(names).toContain("H. Counter");
      expect(names).toContain("D. Anchor");
      expect(names).toContain("S. Late");
    });

    it("uses fictional initial-style mock names only", async () => {
      const redSquad = await provider.fetchSquad("manchester-red");
      const shaSquad = await provider.fetchSquad("shanghai-harbor");
      const allNames = [...redSquad, ...shaSquad].map((p) => p.name);
      expect(allNames.every((name) => /^[A-Z]\. [A-Za-z]+$/.test(name))).toBe(true);
    });
  });

  describe("fetchLineup", () => {
    it("returns Manchester Red XI with formation 4-2-3-1", async () => {
      const lineup = await provider.fetchLineup("demo-mr-vs-sh-001", "manchester-red");
      expect(lineup.formation).toBe("4-2-3-1");
      expect(lineup.starters).toHaveLength(11);
      expect(lineup.substitutes).toHaveLength(5);
      expect(lineup.coach).toBe("R. Manager");

      // Verify exact XI
      const starterNames = lineup.starters.map((p) => p.name);
      expect(starterNames).toEqual(RED_STARTER_NAMES);

      // Verify captain
      const captain = lineup.starters.find((p) => p.captain);
      expect(captain?.name).toBe("C. Press");
    });

    it("returns Shanghai Harbor lineup", async () => {
      const lineup = await provider.fetchLineup("demo-mr-vs-sh-001", "shanghai-harbor");
      expect(lineup.formation).toBe("4-4-2");
      expect(lineup.starters).toHaveLength(11);
      expect(lineup.coach).toBe("L. Tactician");

      const starterNames = lineup.starters.map((p) => p.name);
      expect(starterNames).toContain("H. Counter");
      expect(starterNames).toContain("D. Anchor");
      expect(starterNames).toContain("S. Late");
    });

    it("throws for unknown match", async () => {
      await expect(provider.fetchLineup("bad", "manchester-red")).rejects.toThrow("unknown match");
    });
  });

  describe("fetchPrediction", () => {
    it("returns prediction with correct probabilities", async () => {
      const pred = await provider.fetchPrediction("demo-mr-vs-sh-001");
      expect(pred.matchId).toBe("demo-mr-vs-sh-001");
      expect(pred.homeWin).toBeCloseTo(0.48);
      expect(pred.draw).toBeCloseTo(0.27);
      expect(pred.awayWin).toBeCloseTo(0.25);
      expect(pred.homeWin + pred.draw + pred.awayWin).toBeCloseTo(1.0);
      expect(pred.expectedHomeGoals).toBeCloseTo(1.6);
      expect(pred.expectedAwayGoals).toBeCloseTo(1.2);
      expect(pred.confidence).toBe("medium");
    });

    it("includes goal scorer predictions with fictional names", async () => {
      const pred = await provider.fetchPrediction("demo-mr-vs-sh-001");
      expect(pred.playerGoalPredictions).toBeDefined();
      expect(pred.playerGoalPredictions!.length).toBe(4);

      const scorers = pred.playerGoalPredictions!;
      expect(scorers[0]!.playerName).toBe("V. Finish");
      expect(scorers[0]!.probability).toBeCloseTo(0.34);
      expect(scorers[1]!.playerName).toBe("J. Spark");
      expect(scorers[1]!.probability).toBeCloseTo(0.22);
      expect(scorers[2]!.playerName).toBe("K. Burst");
      expect(scorers[2]!.probability).toBeCloseTo(0.18);
      expect(scorers[3]!.playerName).toBe("H. Counter");
      expect(scorers[3]!.probability).toBeCloseTo(0.17);
    });

    it("includes card risk predictions with fictional names", async () => {
      const pred = await provider.fetchPrediction("demo-mr-vs-sh-001");
      expect(pred.playerCardPredictions).toBeDefined();
      expect(pred.playerCardPredictions!.length).toBe(4);

      const cards = pred.playerCardPredictions!;
      const cPress = cards.find((c) => c.playerName === "C. Press");
      expect(cPress).toBeDefined();
      expect(cPress!.yellowCardProbability).toBeCloseTo(0.42);

      const rBlock = cards.find((c) => c.playerName === "R. Block");
      expect(rBlock).toBeDefined();
      expect(rBlock!.yellowCardProbability).toBeCloseTo(0.31);

      const dAnchor = cards.find((c) => c.playerName === "D. Anchor");
      expect(dAnchor).toBeDefined();
      expect(dAnchor!.yellowCardProbability).toBeCloseTo(0.38);

      const sLate = cards.find((c) => c.playerName === "S. Late");
      expect(sLate).toBeDefined();
      expect(sLate!.redCardRiskLevel).toBe("low");
    });
  });

  describe("fetchMatchStats", () => {
    it("returns stats for demo match", async () => {
      const stats = await provider.fetchMatchStats("demo-mr-vs-sh-001");
      expect(stats.homePossession + stats.awayPossession).toBe(100);
      expect(stats.homeXG).toBeGreaterThan(stats.awayXG);
    });
  });

  describe("fetchH2H", () => {
    it("returns H2H for correct pairing", async () => {
      const h2h = await provider.fetchH2H("manchester-red", "shanghai-harbor");
      expect(h2h.totalMatches).toBe(3);
      expect(h2h.teamAWins).toBe(2);
      expect(h2h.teamBWins).toBe(0);
    });

    it("throws for unknown pairing", async () => {
      await expect(provider.fetchH2H("a", "b")).rejects.toThrow("unknown H2H");
    });
  });

  describe("fetchForm", () => {
    it("returns form for Manchester Red", async () => {
      const form = await provider.fetchForm("manchester-red");
      expect(form.length).toBe(5);
      expect(form[0]!.result).toBe("W");
    });

    it("respects limit parameter", async () => {
      const form = await provider.fetchForm("manchester-red", 2);
      expect(form.length).toBe(2);
    });

    it("returns empty array for unknown team", async () => {
      const form = await provider.fetchForm("unknown");
      expect(form).toEqual([]);
    });
  });

  describe("data isolation (structuredClone)", () => {
    it("returns independent copies", async () => {
      const m1 = await provider.fetchTeam("manchester-red");
      const m2 = await provider.fetchTeam("manchester-red");
      m1.name = "CHANGED";
      expect(m2.name).toBe("Manchester Red");
    });
  });
});
