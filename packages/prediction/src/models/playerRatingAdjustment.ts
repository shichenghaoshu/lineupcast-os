import type { Confidence } from "./dixonColes.js";

/** Flags indicating which data inputs were missing or defaulted. */
export interface PlayerDataDegradationFlags {
  missingFormRating: boolean;
  missingInjuryStatus: boolean;
  missingVenue: boolean;
  missingOpponentStrength: boolean;
  dataCompletenessScore?: number; // 0-100, from DataCompletenessScore integration
}

export interface PlayerRatingAdjustmentInput {
  playerId: string;
  playerName: string;
  baseRating: number;
  expectedMinutes: number;
  recentFormRating?: number;
  injuryStatus?: "fit" | "doubtful" | "limited" | "out";
  isHome?: boolean;
  opponentStrength?: number;
  /** Optional data completeness score (0-100) to limit output precision. */
  dataCompletenessScore?: number;
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
  degradationFlags: PlayerDataDegradationFlags;
}

export interface LineupRatingAdjustmentInput {
  teamId: string;
  players: PlayerRatingAdjustmentInput[];
  /** Optional data completeness score (0-100) to limit output precision. */
  dataCompletenessScore?: number;
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
    dataCompletenessScore?: number;
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

/**
 * Round a number to the given decimal places, but reduce precision when
 * dataCompletenessScore is below a threshold.
 */
function precisionRound(value: number, places: number, completenessScore?: number): number {
  // Reduce precision when data is sparse: score < 60 → 0 decimal places, < 40 → integer
  const effectivePlaces = completenessScore !== undefined
    ? (completenessScore < 40 ? 0 : completenessScore < 60 ? Math.min(places, 1) : places)
    : places;
  const factor = 10 ** effectivePlaces;
  return Math.round(value * factor) / factor;
}

export function adjustLineupRatings(input: LineupRatingAdjustmentInput): LineupRatingAdjustmentResult {
  const completenessScore = input.dataCompletenessScore;

  const playerAdjustments = input.players.map((player) => {
    const playerCompleteness = player.dataCompletenessScore ?? completenessScore;

    // Track degradation flags per player
    const degradationFlags: PlayerDataDegradationFlags = {
      missingFormRating: player.recentFormRating === undefined,
      missingInjuryStatus: player.injuryStatus === undefined,
      missingVenue: player.isHome === undefined,
      missingOpponentStrength: player.opponentStrength === undefined,
      dataCompletenessScore: playerCompleteness,
    };

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
      adjustedRating: precisionRound(adjustedRating, 2, playerCompleteness),
      adjustment: precisionRound(adjustedRating - player.baseRating, 2, playerCompleteness),
      evidence: {
        minutesFactor: round(minutesFactor),
        formDelta: round(formDelta),
        availabilityPenalty: availability,
        venueDelta,
        opponentDelta: round(opponentDelta),
      },
      degradationFlags,
    };
  });

  const totalMinutes = playerAdjustments.reduce((sum, player) => sum + input.players.find((candidate) => candidate.playerId === player.playerId)!.expectedMinutes, 0);
  const weightedRating = input.players.reduce((sum, player, index) => {
    const adjustment = playerAdjustments[index];
    return sum + (adjustment?.adjustedRating ?? 0) * clamp(player.expectedMinutes, 0, 90);
  }, 0);
  const adjustedTeamRating = totalMinutes > 0 ? weightedRating / totalMinutes : 0;

  // Confidence degrades with low data completeness and missing player data
  const playersWithForm = input.players.filter((p) => p.recentFormRating !== undefined).length;
  const playersWithInjury = input.players.filter((p) => p.injuryStatus !== undefined).length;
  const missingDataRatio = 1 - ((playersWithForm + playersWithInjury) / Math.max(1, input.players.length * 2));

  let confidence: Confidence;
  if (completenessScore !== undefined && completenessScore < 40) {
    confidence = "low";
  } else if (input.players.length >= 10 && totalMinutes >= 850 && missingDataRatio < 0.2) {
    confidence = "high";
  } else if (input.players.length >= 7 && missingDataRatio < 0.5) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    modelName: "lineup-rating-adjustment",
    modelVersion: "1.0.0",
    references: [
      "Decroos, T. et al. (2019) Actions Speak Louder than Goals: Valuing Player Actions in Soccer.",
      "Sumpter, D. (2016) Soccermatics: Mathematical Adventures in the Beautiful Game.",
    ],
    explanation: "Lineup adjustment applies expected minutes, recent form, availability, venue, and opponent context to baseline player ratings. Output precision is limited by data completeness.",
    evidence: {
      teamId: input.teamId,
      playersAdjusted: playerAdjustments.length,
      expectedMinutes: round(totalMinutes),
      dataCompletenessScore: completenessScore,
    },
    confidence,
    adjustedTeamRating: precisionRound(adjustedTeamRating, 2, completenessScore),
    playerAdjustments,
  };
}
