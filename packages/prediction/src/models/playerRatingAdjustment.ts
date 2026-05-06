import type { Confidence } from "./dixonColes.js";

export interface PlayerRatingAdjustmentInput {
  playerId: string;
  playerName: string;
  baseRating: number;
  expectedMinutes: number;
  recentFormRating?: number;
  injuryStatus?: "fit" | "doubtful" | "limited" | "out";
  isHome?: boolean;
  opponentStrength?: number;
}

export interface PlayerRatingAdjustment {
  playerId: string;
  playerName: string;
  baseRating: number;
  adjustedRating: number;
  adjustment: number;
  evidence: {
    minutesFactor: number;
    formDelta: number;
    availabilityPenalty: number;
    venueDelta: number;
    opponentDelta: number;
  };
}

export interface LineupRatingAdjustmentInput {
  teamId: string;
  players: PlayerRatingAdjustmentInput[];
}

export interface LineupRatingAdjustmentResult {
  modelName: "lineup-rating-adjustment";
  modelVersion: "1.0.0";
  references: string[];
  explanation: string;
  evidence: {
    teamId: string;
    playersAdjusted: number;
    expectedMinutes: number;
  };
  confidence: Confidence;
  adjustedTeamRating: number;
  playerAdjustments: PlayerRatingAdjustment[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function availabilityPenalty(status: PlayerRatingAdjustmentInput["injuryStatus"]): number {
  if (status === "out") return -100;
  if (status === "doubtful") return -6;
  if (status === "limited") return -3;
  return 0;
}

export function adjustLineupRatings(input: LineupRatingAdjustmentInput): LineupRatingAdjustmentResult {
  const playerAdjustments = input.players.map((player) => {
    const minutesFactor = clamp(player.expectedMinutes, 0, 90) / 90;
    const formDelta = player.recentFormRating === undefined ? 0 : clamp((player.recentFormRating - player.baseRating) * 0.25, -5, 5);
    const availability = availabilityPenalty(player.injuryStatus);
    const venueDelta = player.isHome === undefined ? 0 : player.isHome ? 0.8 : -0.4;
    const opponentDelta = player.opponentStrength === undefined ? 0 : -clamp(player.opponentStrength - 0.5, -0.5, 0.5) * 2;
    const adjustedRating = player.injuryStatus === "out"
      ? 0
      : clamp((player.baseRating + formDelta + availability + venueDelta + opponentDelta) * minutesFactor, 0, 100);

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      baseRating: player.baseRating,
      adjustedRating: round(adjustedRating),
      adjustment: round(adjustedRating - player.baseRating),
      evidence: {
        minutesFactor: round(minutesFactor),
        formDelta: round(formDelta),
        availabilityPenalty: availability,
        venueDelta,
        opponentDelta: round(opponentDelta),
      },
    };
  });

  const totalMinutes = playerAdjustments.reduce((sum, player) => sum + input.players.find((candidate) => candidate.playerId === player.playerId)!.expectedMinutes, 0);
  const weightedRating = input.players.reduce((sum, player, index) => {
    const adjustment = playerAdjustments[index];
    return sum + (adjustment?.adjustedRating ?? 0) * clamp(player.expectedMinutes, 0, 90);
  }, 0);
  const adjustedTeamRating = totalMinutes > 0 ? weightedRating / totalMinutes : 0;
  const confidence: Confidence = input.players.length >= 10 && totalMinutes >= 850 ? "high" : input.players.length >= 7 ? "medium" : "low";

  return {
    modelName: "lineup-rating-adjustment",
    modelVersion: "1.0.0",
    references: [
      "Decroos, T. et al. (2019) Actions Speak Louder than Goals: Valuing Player Actions in Soccer.",
      "Sumpter, D. (2016) Soccermatics: Mathematical Adventures in the Beautiful Game.",
    ],
    explanation: "Lineup adjustment applies expected minutes, recent form, availability, venue, and opponent context to baseline player ratings.",
    evidence: {
      teamId: input.teamId,
      playersAdjusted: playerAdjustments.length,
      expectedMinutes: round(totalMinutes),
    },
    confidence,
    adjustedTeamRating: round(adjustedTeamRating),
    playerAdjustments,
  };
}
