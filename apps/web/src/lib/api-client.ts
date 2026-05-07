import { currentMatch, dataProviders, manchesterRedXI, matchPrediction } from "./mock-data";

export type Language = "zh" | "en" | "bilingual";
export type ScriptStyle =
  | "professional"
  | "short-video"
  | "passionate"
  | "neutral"
  | "broadcast";
export type ScriptDuration = "15s" | "30s" | "1min" | "3min";

export interface ApiTeam {
  teamId?: string;
  name: string;
  shortName?: string;
}

export interface ApiMatch {
  matchId: string;
  competition?: string;
  kickoff: string;
  status: string;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score?: { home?: number; away?: number } | null;
}

export interface ApiModelInfo {
  name: string;
  version?: string;
  reference?: string;
}

export interface ApiPrediction {
  matchId: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  confidence: number;
  models: ApiModelInfo[];
  inputFeatures: string[];
  featureContributions: FeatureContribution[];
  goalScorers: GoalScorerEvidence[];
  cardRisks: CardRiskEvidence[];
  explanations: string[];
}

export interface FeatureContribution {
  feature: string;
  contribution: number;
  direction: "positive" | "negative" | "neutral";
  evidence: string;
}

export interface GoalScorerEvidence {
  player: string;
  team?: string;
  probability: number;
  evidence: string[];
}

export interface CardRiskEvidence {
  player: string;
  team?: string;
  yellowRisk: number;
  redRisk: string;
  evidence: string[];
}

export interface ScriptRequest {
  language: Language;
  style: ScriptStyle;
  duration: ScriptDuration;
}

export interface ScriptResult {
  matchId: string;
  script: string;
  disclaimer?: string;
  provider: string;
  model: string;
  latencyMs: number;
  fallback: boolean;
}

export interface ProviderItem {
  id: string;
  name: string;
  type?: string;
  description?: string;
  status: string;
  lastSync?: string | null;
  fields?: string[];
  errorCount?: number;
  lastError?: string | null;
  lastSuccessfulSync?: string | null;
  freshness?: string;
  health?: "healthy" | "degraded" | "unhealthy";
}

export interface ProviderLog {
  time: string;
  source: string;
  message: string;
  status: "success" | "warning" | "error" | "info";
}

export interface ProviderDashboard {
  providers: ProviderItem[];
  logs: ProviderLog[];
  apiHealth: "online" | "offline";
  syncStatus: "idle" | "running" | "fallback";
  testStatus: "ready" | "unavailable";
}

export interface ReadinessProviderInfo {
  id: string;
  name: string;
  status: string;
  errorCount: number;
  lastError: string | null;
  lastSuccessfulSync: string | null;
  freshness?: string;
  health: "healthy" | "degraded" | "unhealthy";
  missingCapabilities?: string[];
  degradedReasons?: string[];
}

export interface ReadinessData {
  status: "ready" | "degraded";
  provider: { available: boolean; mode: string; detail: string };
  model: { available: boolean; mode: string; detail: string };
  providers: ReadinessProviderInfo[];
  providerFreshness?: Record<string, string>;
  errorCount: number;
}

type Fetcher = typeof fetch;
type ApiPredictionPayload = Partial<Omit<ApiPrediction, "goalScorers" | "cardRisks">> & {
  goalScorers?: Partial<GoalScorerEvidence>[];
  cardRisks?: Partial<CardRiskEvidence>[];
};

const DEFAULT_API_URL = "http://localhost:8000";

export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  fetcher: Fetcher = fetch,
): Promise<T> {
  const response = await fetcher(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  return (await response.json()) as T;
}

export async function getDemoMatch(fetcher?: Fetcher): Promise<ApiMatch> {
  try {
    return await requestJson<ApiMatch>("/api/matches/demo", undefined, fetcher);
  } catch {
    return {
      matchId: currentMatch.id,
      kickoff: currentMatch.kickoff,
      status: currentMatch.status,
      homeTeam: { name: currentMatch.homeTeam },
      awayTeam: { name: currentMatch.awayTeam },
    };
  }
}

export async function getPrediction(
  matchId: string,
  fetcher?: Fetcher,
): Promise<ApiPrediction> {
  try {
    const data = await requestJson<ApiPredictionPayload>(
      `/api/matches/${matchId}/prediction`,
      undefined,
      fetcher,
    );
    return normalizePrediction(data, matchId);
  } catch {
    return normalizePrediction(
      {
        matchId,
        ...matchPrediction,
        confidence: matchPrediction.confidence,
        goalScorers: matchPrediction.possibleScorers.map((item) => ({
          player: item.name,
          probability: item.probability,
        })),
        cardRisks: matchPrediction.yellowCardRisks.map((item) => ({
            player: item.name,
            yellowRisk: item.risk,
            redRisk: "low",
          })),
      },
      matchId,
    );
  }
}

export async function getMatchBundle(fetcher?: Fetcher) {
  const match = await getDemoMatch(fetcher);
  const prediction = await getPrediction(match.matchId || "match-001", fetcher);
  return { match, prediction };
}

export async function generateScript(
  matchId: string,
  request: ScriptRequest,
  fetcher: Fetcher = fetch,
): Promise<ScriptResult> {
  const started = Date.now();
  const body = JSON.stringify({ ...request, tone: request.style });

  try {
    const data = await requestJson<Partial<ScriptResult>>(
      `/api/matches/${matchId}/scripts/generate`,
      { method: "POST", body },
      fetcher,
    );
    return normalizeScriptResult(data, matchId, Date.now() - started, false);
  } catch {
    try {
      const data = await requestJson<Partial<ScriptResult>>(
        `/api/matches/${matchId}/script`,
        { method: "POST", body },
        fetcher,
      );
      return normalizeScriptResult(data, matchId, Date.now() - started, true);
    } catch {
      return buildLocalScriptFallback(matchId, request, Date.now() - started);
    }
  }
}

export async function getProviderDashboard(fetcher?: Fetcher): Promise<ProviderDashboard> {
  const apiHealth = await getApiHealth(fetcher);

  try {
    const providers = await requestJson<ProviderItem[]>("/api/providers", undefined, fetcher);
    return {
      providers,
      logs: providersToLogs(providers),
      apiHealth,
      syncStatus: "idle",
      testStatus: "ready",
    };
  } catch {
    return {
      providers: dataProviders.map((provider) => ({
        ...provider,
        type: "data",
        description: provider.fields.join(", "),
      })),
      logs: providersToLogs(dataProviders),
      apiHealth,
      syncStatus: "fallback",
      testStatus: "unavailable",
    };
  }
}

async function getApiHealth(fetcher?: Fetcher): Promise<"online" | "offline"> {
  try {
    await requestJson<{ status: string }>("/health", undefined, fetcher);
    return "online";
  } catch {
    return "offline";
  }
}

export async function getReadiness(fetcher?: Fetcher): Promise<ReadinessData | null> {
  try {
    return await requestJson<ReadinessData>("/readyz", undefined, fetcher);
  } catch {
    return null;
  }
}

export interface DataCompletenessInfo {
  score: number;
  missingFields: string[];
  degradedReasons: string[];
  confidenceCap: number;
  dataSource: "live" | "demo";
  fallbackMethod: string | null;
}

/**
 * Derive data completeness from readiness data.
 * Attempts the /api/completeness endpoint first; falls back to
 * computing from readiness provider health.
 */
export async function getDataCompleteness(fetcher?: Fetcher): Promise<DataCompletenessInfo> {
  try {
    return await requestJson<DataCompletenessInfo>("/api/completeness", undefined, fetcher);
  } catch {
    // Derive from readiness data
    const readiness = await getReadiness(fetcher);
    if (!readiness) {
      return {
        score: 0,
        missingFields: ["lineup", "playerStats", "cardStats", "referee", "recentForm", "h2h", "injuries", "xG"],
        degradedReasons: ["API unreachable — using bundled demo data"],
        confidenceCap: 0,
        dataSource: "demo",
        fallbackMethod: "Local mock data with default player profiles",
      };
    }

    const missingFields: string[] = [];
    const degradedReasons: string[] = [];
    let score = 100;

    // Map provider health to data field availability
    const providerFieldMap: Record<string, { field: string; penalty: number; reason: string }> = {
      lineup: { field: "lineup", penalty: 25, reason: "Missing lineup data" },
      stats: { field: "playerStats", penalty: 20, reason: "Missing player statistics" },
      events: { field: "cardStats", penalty: 10, reason: "Missing card statistics" },
      referee: { field: "referee", penalty: 5, reason: "Missing referee data" },
      fixtures: { field: "recentForm", penalty: 10, reason: "Missing recent form data" },
      h2h: { field: "h2h", penalty: 10, reason: "Missing head-to-head data" },
      injuries: { field: "injuries", penalty: 10, reason: "Missing injury data" },
      xg: { field: "xG", penalty: 10, reason: "Missing expected goals data" },
    };

    for (const provider of readiness.providers) {
      const mapping = providerFieldMap[provider.id];
      if (mapping && provider.health !== "healthy") {
        missingFields.push(mapping.field);
        degradedReasons.push(mapping.reason);
        score -= mapping.penalty;
      }
    }

    score = Math.max(0, Math.min(100, score));
    const isLive = readiness.status === "ready" && score >= 60;

    return {
      score,
      missingFields,
      degradedReasons,
      confidenceCap: score / 100,
      dataSource: isLive ? "live" : "demo",
      fallbackMethod: isLive
        ? null
        : "Local mock data with default player profiles (Dixon-Coles baseline)",
    };
  }
}

export async function testProviderConnection(
  providerId: string,
  fetcher: Fetcher = fetch,
): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  try {
    const result = await requestJson<{ providerId: string; ok: boolean; latencyMs: number; detail: string }>(
      "/api/providers/test",
      { method: "POST", body: JSON.stringify({ providerId }) },
      fetcher,
    );
    return { ok: result.ok, latencyMs: result.latencyMs, detail: result.detail };
  } catch (err) {
    return { ok: false, latencyMs: 0, detail: err instanceof Error ? err.message : "Connection failed" };
  }
}

function normalizeScriptResult(
  data: Partial<ScriptResult>,
  matchId: string,
  latencyMs: number,
  fallback: boolean,
): ScriptResult {
  return {
    matchId: data.matchId ?? matchId,
    script: data.script ?? "",
    disclaimer: data.disclaimer,
    provider: data.provider ?? "LineupCast API",
    model: data.model ?? "deterministic-script-template",
    latencyMs: data.latencyMs ?? latencyMs,
    fallback: data.fallback ?? fallback,
  };
}

function buildLocalScriptFallback(
  matchId: string,
  request: ScriptRequest,
  latencyMs: number,
): ScriptResult {
  const homeTeam = currentMatch.homeTeam;
  const awayTeam = currentMatch.awayTeam;
  const leadingScorer = matchPrediction.possibleScorers[0]?.name ?? "the lead forward";
  const english =
    `${homeTeam} host ${awayTeam}. The local fallback keeps the briefing usable: ` +
    `home win ${matchPrediction.homeWin}%, draw ${matchPrediction.draw}%, away win ${matchPrediction.awayWin}%, ` +
    `with projected xG ${matchPrediction.expectedHomeGoals} to ${matchPrediction.expectedAwayGoals}. ` +
    `Watch ${leadingScorer} as the main scorer focus.`;
  const chinese =
    `${homeTeam} 对阵 ${awayTeam}。本地降级稿保留核心数据：主胜 ${matchPrediction.homeWin}%，` +
    `平局 ${matchPrediction.draw}%，客胜 ${matchPrediction.awayWin}%，预计 xG 为 ` +
    `${matchPrediction.expectedHomeGoals} 比 ${matchPrediction.expectedAwayGoals}。重点关注 ${leadingScorer}。`;

  const script =
    request.language === "zh"
      ? chinese
      : request.language === "bilingual"
        ? `${english}\n\n${chinese}`
        : english;

  return {
    matchId,
    script,
    disclaimer: "Local fallback generated from bundled demo data because the API script endpoints were unavailable.",
    provider: "local-web-fallback",
    model: `local-template-${request.style}-${request.duration}`,
    latencyMs,
    fallback: true,
  };
}

function normalizePrediction(data: ApiPredictionPayload, matchId: string): ApiPrediction {
  const inputFeatures = data.inputFeatures ?? [
    "player_xG_last_5_matches",
    "player_VAEP_attack",
    "player_VAEP_defense",
    "home_advantage_factor",
    "recent_team_form_last_6",
  ];

  const explanations =
    data.explanations ??
    [
      "Dixon-Coles baseline is adjusted by lineup and player-form inputs.",
      "Goal scorer and card risk ranks use player-level recent form evidence.",
    ];

  const goalScorers = normalizeGoalScorers(data.goalScorers, explanations);
  const cardRisks = normalizeCardRisks(data.cardRisks, explanations);

  return {
    matchId: data.matchId ?? matchId,
    homeWin: data.homeWin ?? matchPrediction.homeWin,
    draw: data.draw ?? matchPrediction.draw,
    awayWin: data.awayWin ?? matchPrediction.awayWin,
    expectedHomeGoals: data.expectedHomeGoals ?? matchPrediction.expectedHomeGoals,
    expectedAwayGoals: data.expectedAwayGoals ?? matchPrediction.expectedAwayGoals,
    confidence: normalizeConfidence(data.confidence ?? matchPrediction.confidence),
    models: data.models?.length
      ? data.models
      : [
          { name: "Dixon-Coles", version: "2.1", reference: "docs/model-cards/dixon-coles.md" },
          { name: "xG Share", version: "1.0", reference: "docs/model-cards/xg-share.md" },
          {
            name: "xB-Inspired Card Risk",
            version: "0.9",
            reference: "docs/model-cards/xb-inspired-card-risk.md",
          },
        ],
    inputFeatures,
    featureContributions:
      data.featureContributions?.length
        ? data.featureContributions
        : buildFeatureContributions(inputFeatures),
    goalScorers,
    cardRisks,
    explanations,
  };
}

function normalizeConfidence(confidence: number): number {
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}

function normalizeGoalScorers(
  scorers: Partial<GoalScorerEvidence>[] | undefined,
  explanations: string[],
): GoalScorerEvidence[] {
  const source: Partial<GoalScorerEvidence>[] =
    scorers ??
    matchPrediction.possibleScorers.map((item) => ({
      player: item.name,
      probability: item.probability,
    }));

  return source.map((item) => ({
    player: item.player ?? "Unknown player",
    team: item.team,
    probability: item.probability ?? 0,
    evidence:
      item.evidence?.length
        ? item.evidence
        : evidenceForPlayer(item.player, explanations, "Recent xG and shot volume support this scorer rank."),
  }));
}

function normalizeCardRisks(
  risks: Partial<CardRiskEvidence>[] | undefined,
  explanations: string[],
): CardRiskEvidence[] {
  const source: Partial<CardRiskEvidence>[] =
    risks ??
    matchPrediction.yellowCardRisks.map((item) => ({
      player: item.name,
      yellowRisk: item.risk,
      redRisk: "low",
    }));

  return source.map((item) => ({
    player: item.player ?? "Unknown player",
    team: item.team,
    yellowRisk: item.yellowRisk ?? 0,
    redRisk: item.redRisk ?? "low",
    evidence:
      item.evidence?.length
        ? item.evidence
        : evidenceForPlayer(item.player, explanations, "Fouls per 90 and role intensity drive this card risk."),
  }));
}

function evidenceForPlayer(
  playerName: string | undefined,
  explanations: string[],
  fallback: string,
): string[] {
  const matched = explanations.filter((item) =>
    playerName ? item.toLowerCase().includes(playerName.toLowerCase()) : false,
  );
  return matched.length ? matched : [fallback];
}

function buildFeatureContributions(features: string[]): FeatureContribution[] {
  return features.map((feature, index) => {
    const player = manchesterRedXI[index % manchesterRedXI.length];
    const contribution = Math.max(8, 22 - index * 2);
    return {
      feature,
      contribution,
      direction: index % 4 === 3 ? "negative" : "positive",
      evidence: `${player.name}: rating ${player.recentRating.toFixed(1)}, xG ${player.xGLast5.toFixed(1)}, fouls/90 ${player.foulsPer90.toFixed(1)}`,
    };
  });
}

function providersToLogs(providers: Array<ProviderItem | (typeof dataProviders)[number]>): ProviderLog[] {
  const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const logs: ProviderLog[] = [];

  for (const provider of providers) {
    // Main status log
    const isHealthy =
      provider.status === "active" || provider.status === "connected";
    const isError = provider.status === "error";

    logs.push({
      time: provider.lastSync
        ? new Date(provider.lastSync).toLocaleTimeString("zh-CN", { hour12: false })
        : now,
      source: provider.name,
      message: isHealthy
        ? "Provider reachable; metadata loaded"
        : isError
          ? "Provider reported an error state"
          : "Provider configured but not connected",
      status: isHealthy ? "success" : isError ? "error" : "warning",
    });

    // Additional error log entry when lastError is present
    const lastError =
      "lastError" in provider ? (provider as ProviderItem).lastError : undefined;
    if (lastError) {
      logs.push({
        time: now,
        source: provider.name,
        message: lastError,
        status: "error",
      });
    }
  }

  return logs;
}
