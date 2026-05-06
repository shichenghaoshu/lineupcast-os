import { describe, expect, it } from "vitest";
import { manchesterRedXI, matchPrediction } from "./mock-data";

describe("LineupCast mock data", () => {
  it("renders a complete Manchester Red XI with the requested fictional players", () => {
    expect(manchesterRedXI).toHaveLength(11);
    expect(manchesterRedXI.map((player) => player.name)).toEqual([
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
    ]);
    expect(manchesterRedXI.map((player) => player.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it("uses the requested paper-backed mock prediction values", () => {
    expect(matchPrediction.homeWin).toBe(48);
    expect(matchPrediction.draw).toBe(27);
    expect(matchPrediction.awayWin).toBe(25);
    expect(matchPrediction.expectedHomeGoals).toBe(1.6);
    expect(matchPrediction.expectedAwayGoals).toBe(1.2);
    expect(matchPrediction.possibleScorers[0]).toEqual({
      name: "V. Finish",
      probability: 34,
    });
  });
});
