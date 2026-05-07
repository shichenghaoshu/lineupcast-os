"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  History,
  Layers,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ModelBadge } from "@/components/ModelBadge";
import {
  getPredictionHistory,
  type PredictionHistoryRecord,
  type PredictionHistorySummary,
} from "@/lib/api-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type OutcomeLabel = "homeWin" | "draw" | "awayWin";
type FilterModel = "all" | string;

function outcomeLabel(result: string): OutcomeLabel {
  if (result === "H" || result === "homeWin") return "homeWin";
  if (result === "D" || result === "draw") return "draw";
  return "awayWin";
}

function outcomeBadgeClass(outcome: OutcomeLabel): string {
  if (outcome === "homeWin") return "badge-green";
  if (outcome === "draw") return "badge-amber";
  return "badge-blue";
}

function outcomeText(outcome: OutcomeLabel): string {
  if (outcome === "homeWin") return "H";
  if (outcome === "draw") return "D";
  return "A";
}

function computeBrierScore(
  predicted: { homeWin: number; draw: number; awayWin: number },
  actual: OutcomeLabel,
): number {
  const pHome = predicted.homeWin / 100;
  const pDraw = predicted.draw / 100;
  const pAway = predicted.awayWin / 100;
  const yHome = actual === "homeWin" ? 1 : 0;
  const yDraw = actual === "draw" ? 1 : 0;
  const yAway = actual === "awayWin" ? 1 : 0;
  return (
    (pHome - yHome) ** 2 + (pDraw - yDraw) ** 2 + (pAway - yAway) ** 2
  );
}

function isCorrect(
  predicted: { homeWin: number; draw: number; awayWin: number },
  actual: OutcomeLabel,
): boolean {
  const max = Math.max(predicted.homeWin, predicted.draw, predicted.awayWin);
  if (max === predicted.homeWin) return actual === "homeWin";
  if (max === predicted.draw) return actual === "draw";
  return actual === "awayWin";
}

function rollingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += values[j];
    return Math.round((sum / window) * 1000) / 1000;
  });
}

/* ------------------------------------------------------------------ */
/*  Mock data fallback                                                */
/* ------------------------------------------------------------------ */

const MOCK_HISTORY: PredictionHistoryRecord[] = [
  {
    predictionId: "pred-md28-001",
    matchId: "md28",
    homeTeam: "Manchester Red",
    awayTeam: "London Blues",
    competition: "Premier League",
    matchDate: "2026-04-28",
    modelName: "Dixon-Coles",
    modelVersion: "2.1",
    predicted: { homeWin: 62, draw: 22, awayWin: 16 },
    actual: { homeScore: 2, awayScore: 0 },
    confidence: 78,
    generatedAt: "2026-04-27T18:00:00Z",
  },
  {
    predictionId: "pred-md29-001",
    matchId: "md29",
    homeTeam: "Manchester Red",
    awayTeam: "Berlin Eagles",
    competition: "Premier League",
    matchDate: "2026-04-21",
    modelName: "Dixon-Coles",
    modelVersion: "2.1",
    predicted: { homeWin: 45, draw: 28, awayWin: 27 },
    actual: { homeScore: 1, awayScore: 2 },
    confidence: 65,
    generatedAt: "2026-04-20T18:00:00Z",
  },
  {
    predictionId: "pred-md30-001",
    matchId: "md30",
    homeTeam: "Manchester Red",
    awayTeam: "Madrid Lions",
    competition: "Premier League",
    matchDate: "2026-04-14",
    modelName: "Dixon-Coles",
    modelVersion: "2.1",
    predicted: { homeWin: 58, draw: 24, awayWin: 18 },
    actual: { homeScore: 3, awayScore: 1 },
    confidence: 74,
    generatedAt: "2026-04-13T18:00:00Z",
  },
  {
    predictionId: "pred-md31-001",
    matchId: "md31",
    homeTeam: "Manchester Red",
    awayTeam: "Paris Stars",
    competition: "Premier League",
    matchDate: "2026-04-07",
    modelName: "xG-Share",
    modelVersion: "1.0",
    predicted: { homeWin: 40, draw: 30, awayWin: 30 },
    actual: { homeScore: 1, awayScore: 1 },
    confidence: 60,
    generatedAt: "2026-04-06T18:00:00Z",
  },
  {
    predictionId: "pred-md32-001",
    matchId: "md32",
    homeTeam: "Manchester Red",
    awayTeam: "Milan Knights",
    competition: "Premier League",
    matchDate: "2026-03-30",
    modelName: "Dixon-Coles",
    modelVersion: "2.1",
    predicted: { homeWin: 55, draw: 25, awayWin: 20 },
    actual: { homeScore: 2, awayScore: 0 },
    confidence: 71,
    generatedAt: "2026-03-29T18:00:00Z",
  },
  {
    predictionId: "pred-md33-001",
    matchId: "md33",
    homeTeam: "Manchester Red",
    awayTeam: "Rome Wolves",
    competition: "Premier League",
    matchDate: "2026-03-23",
    modelName: "xG-Share",
    modelVersion: "1.0",
    predicted: { homeWin: 38, draw: 30, awayWin: 32 },
    actual: { homeScore: 0, awayScore: 1 },
    confidence: 55,
    generatedAt: "2026-03-22T18:00:00Z",
  },
  {
    predictionId: "pred-md34-001",
    matchId: "md34",
    homeTeam: "Manchester Red",
    awayTeam: "Amsterdam Oranges",
    competition: "Premier League",
    matchDate: "2026-03-16",
    modelName: "Dixon-Coles",
    modelVersion: "2.1",
    predicted: { homeWin: 50, draw: 28, awayWin: 22 },
    actual: { homeScore: 2, awayScore: 2 },
    confidence: 68,
    generatedAt: "2026-03-15T18:00:00Z",
  },
  {
    predictionId: "pred-md35-001",
    matchId: "md35",
    homeTeam: "Lisbon Waves",
    awayTeam: "Manchester Red",
    competition: "Premier League",
    matchDate: "2026-03-09",
    modelName: "Dixon-Coles",
    modelVersion: "2.1",
    predicted: { homeWin: 35, draw: 30, awayWin: 35 },
    actual: { homeScore: 0, awayScore: 1 },
    confidence: 62,
    generatedAt: "2026-03-08T18:00:00Z",
  },
  {
    predictionId: "pred-md36-001",
    matchId: "md36",
    homeTeam: "Beijing Dragons",
    awayTeam: "Shanghai Harbor",
    competition: "Chinese Super League",
    matchDate: "2026-04-27",
    modelName: "Dixon-Coles",
    modelVersion: "2.1",
    predicted: { homeWin: 52, draw: 26, awayWin: 22 },
    actual: { homeScore: 3, awayScore: 1 },
    confidence: 70,
    generatedAt: "2026-04-26T18:00:00Z",
  },
  {
    predictionId: "pred-md37-001",
    matchId: "md37",
    homeTeam: "Shanghai Harbor",
    awayTeam: "Guangzhou Tigers",
    competition: "Chinese Super League",
    matchDate: "2026-04-20",
    modelName: "xG-Share",
    modelVersion: "1.0",
    predicted: { homeWin: 48, draw: 28, awayWin: 24 },
    actual: { homeScore: 1, awayScore: 1 },
    confidence: 64,
    generatedAt: "2026-04-19T18:00:00Z",
  },
];

const MOCK_SUMMARY: PredictionHistorySummary = {
  totalPredictions: 10,
  correctPredictions: 7,
  accuracy: 70.0,
  averageBrierScore: 0.382,
  averageConfidence: 66.7,
  models: ["Dixon-Coles", "xG-Share"],
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                    */
/* ------------------------------------------------------------------ */

export default function PredictionsPage() {
  const [records, setRecords] = useState<PredictionHistoryRecord[]>([]);
  const [summary, setSummary] = useState<PredictionHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [modelFilter, setModelFilter] = useState<FilterModel>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "correct" | "wrong">("all");
  const [sortBy, setSortBy] = useState<"date" | "brier">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPredictionHistory()
      .then((data) => {
        if (!active) return;
        setRecords(data.records);
        setSummary(data.summary);
        setError(null);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        // Fall back to mock data
        setRecords(MOCK_HISTORY);
        setSummary(MOCK_SUMMARY);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableModels = useMemo(() => {
    const models = new Set(records.map((r) => r.modelName));
    return Array.from(models).sort();
  }, [records]);

  // Enriched records with computed fields
  const enriched = useMemo(() => {
    return records.map((r) => {
      const actualOutcome: OutcomeLabel =
        r.actual.homeScore > r.actual.awayScore
          ? "homeWin"
          : r.actual.homeScore < r.actual.awayScore
            ? "awayWin"
            : "draw";
      const brier = computeBrierScore(r.predicted, actualOutcome);
      const correct = isCorrect(r.predicted, actualOutcome);
      return { ...r, actualOutcome, brier, correct };
    });
  }, [records]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let items = [...enriched];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (r) =>
          r.homeTeam.toLowerCase().includes(q) ||
          r.awayTeam.toLowerCase().includes(q) ||
          r.competition.toLowerCase().includes(q) ||
          r.matchId.toLowerCase().includes(q),
      );
    }

    // Model filter
    if (modelFilter !== "all") {
      items = items.filter((r) => r.modelName === modelFilter);
    }

    // Date range
    if (dateFrom) {
      items = items.filter((r) => r.matchDate >= dateFrom);
    }
    if (dateTo) {
      items = items.filter((r) => r.matchDate <= dateTo);
    }

    // Result filter
    if (resultFilter === "correct") {
      items = items.filter((r) => r.correct);
    } else if (resultFilter === "wrong") {
      items = items.filter((r) => !r.correct);
    }

    // Sort
    items.sort((a, b) => {
      if (sortBy === "date") {
        return sortDir === "desc"
          ? b.matchDate.localeCompare(a.matchDate)
          : a.matchDate.localeCompare(b.matchDate);
      }
      return sortDir === "desc" ? b.brier - a.brier : a.brier - b.brier;
    });

    return items;
  }, [enriched, searchQuery, modelFilter, dateFrom, dateTo, resultFilter, sortBy, sortDir]);

  // Compute summary from filtered if needed
  const displaySummary = useMemo(() => {
    if (summary) return summary;
    const correct = filtered.filter((r) => r.correct).length;
    const avgBrier =
      filtered.length > 0
        ? filtered.reduce((s, r) => s + r.brier, 0) / filtered.length
        : 0;
    const avgConf =
      filtered.length > 0
        ? filtered.reduce((s, r) => s + r.confidence, 0) / filtered.length
        : 0;
    return {
      totalPredictions: filtered.length,
      correctPredictions: correct,
      accuracy: filtered.length > 0 ? (correct / filtered.length) * 100 : 0,
      averageBrierScore: avgBrier,
      averageConfidence: avgConf,
      models: availableModels,
    };
  }, [summary, filtered, availableModels]);

  // Brier score trend chart data
  const brierTrendData = useMemo(() => {
    const sorted = [...enriched].sort((a, b) =>
      a.matchDate.localeCompare(b.matchDate),
    );
    const brierValues = sorted.map((r) => r.brier);
    const rolling5 = rollingAverage(brierValues, 3);
    return sorted.map((r, i) => ({
      match: `${r.homeTeam.slice(0, 3)} vs ${r.awayTeam.slice(0, 3)}`,
      date: r.matchDate,
      brier: Math.round(r.brier * 1000) / 1000,
      rolling: rolling5[i] !== null ? rolling5[i] : undefined,
      model: r.modelName,
    }));
  }, [enriched]);

  // Accuracy by model
  const modelAccuracy = useMemo(() => {
    const map = new Map<
      string,
      { correct: number; total: number; brierSum: number }
    >();
    for (const r of enriched) {
      const entry = map.get(r.modelName) ?? {
        correct: 0,
        total: 0,
        brierSum: 0,
      };
      entry.total++;
      if (r.correct) entry.correct++;
      entry.brierSum += r.brier;
      map.set(r.modelName, entry);
    }
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      accuracy: Math.round((v.correct / v.total) * 100),
      brier: Math.round((v.brierSum / v.total) * 1000) / 1000,
      count: v.total,
    }));
  }, [enriched]);

  const toggleSort = (col: "date" | "brier") => {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Prediction History"
        subtitle="Track accuracy, Brier scores, and model performance over time"
      />

      <div className="space-y-4 p-4 sm:p-6">
        {/* Loading / Error */}
        {loading && (
          <div className="card text-sm text-[var(--text-muted)]">
            Loading prediction history...
          </div>
        )}
        {error && !loading && (
          <div className="card border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/5 text-sm text-[var(--accent-amber)]">
            API unavailable; showing demo data.
          </div>
        )}

        {/* ── Summary Cards ──────────────────────────────────────── */}
        {displaySummary && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Total Predictions"
              value={String(displaySummary.totalPredictions)}
              icon={<History className="h-4 w-4 text-[var(--accent-blue)]" />}
              color="var(--accent-blue)"
            />
            <SummaryCard
              label="Correct"
              value={String(displaySummary.correctPredictions)}
              icon={
                <CheckCircle2 className="h-4 w-4 text-[var(--accent-green)]" />
              }
              color="var(--accent-green)"
            />
            <SummaryCard
              label="Accuracy"
              value={`${displaySummary.accuracy.toFixed(1)}%`}
              icon={<Target className="h-4 w-4 text-[var(--accent-purple)]" />}
              color="var(--accent-purple)"
            />
            <SummaryCard
              label="Avg Brier Score"
              value={displaySummary.averageBrierScore.toFixed(3)}
              icon={
                displaySummary.averageBrierScore < 0.4 ? (
                  <TrendingDown className="h-4 w-4 text-[var(--accent-green)]" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-[var(--accent-red)]" />
                )
              }
              color={
                displaySummary.averageBrierScore < 0.4
                  ? "var(--accent-green)"
                  : "var(--accent-red)"
              }
              hint="Lower is better"
            />
            <SummaryCard
              label="Avg Confidence"
              value={`${displaySummary.averageConfidence.toFixed(1)}%`}
              icon={<Layers className="h-4 w-4 text-[var(--accent-amber)]" />}
              color="var(--accent-amber)"
            />
          </div>
        )}

        {/* ── Charts Row ─────────────────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Brier Score Trend */}
          <div className="card space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Brier Score Trend
            </div>
            {brierTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={brierTrendData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="match"
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    axisLine={{ stroke: "var(--border-color)" }}
                  />
                  <YAxis
                    domain={[0, 2]}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    axisLine={{ stroke: "var(--border-color)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--text-primary)" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="brier"
                    stroke="var(--accent-amber)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Brier Score"
                  />
                  <Line
                    type="monotone"
                    dataKey="rolling"
                    stroke="var(--accent-blue)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                    name="Rolling Avg (3)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">
                No data available.
              </div>
            )}
          </div>

          {/* Model Accuracy Comparison */}
          <div className="card space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Accuracy by Model
            </div>
            {modelAccuracy.length > 0 ? (
              <div className="space-y-3">
                {modelAccuracy.map((m) => (
                  <div key={m.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">
                          {m.name}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          ({m.count} predictions)
                        </span>
                      </div>
                      <span
                        className="tabular-nums font-medium"
                        style={{
                          color:
                            m.accuracy >= 60
                              ? "var(--accent-green)"
                              : "var(--accent-red)",
                        }}
                      >
                        {m.accuracy}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${m.accuracy}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{
                          background:
                            m.accuracy >= 60
                              ? "var(--accent-green)"
                              : "var(--accent-red)",
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>Avg Brier: {m.brier}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">
                No model data available.
              </div>
            )}
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            <Filter className="h-3.5 w-3.5" />
            Filters
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search match, team, competition..."
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
              />
            </div>

            {/* Model */}
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
            >
              <option value="all">All Models</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Date from */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
              />
            </div>

            {/* Date to */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
              />
            </div>

            {/* Result filter */}
            <div className="flex rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "correct", label: "Correct" },
                  { key: "wrong", label: "Wrong" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setResultFilter(item.key)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    resultFilter === item.key
                      ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Clear */}
            {(searchQuery ||
              modelFilter !== "all" ||
              dateFrom ||
              dateTo ||
              resultFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setModelFilter("all");
                  setDateFrom("");
                  setDateTo("");
                  setResultFilter("all");
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent-red)]"
              >
                <XCircle className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            Showing {filtered.length} of {records.length} predictions
          </div>
        </div>

        {/* ── Predictions Table ──────────────────────────────────── */}
        <div className="card overflow-hidden p-0">
          {/* Header */}
          <div className="hidden border-b border-[var(--border-color)] bg-[var(--bg-secondary)] text-[10px] uppercase tracking-wider text-[var(--text-muted)] sm:grid sm:grid-cols-[1fr_120px_100px_100px_80px_80px_80px_70px_40px]">
            <div className="px-4 py-2.5">Match</div>
            <div className="px-3 py-2.5">Model</div>
            <button
              onClick={() => toggleSort("date")}
              className="flex items-center gap-1 px-3 py-2.5 text-left hover:text-[var(--text-primary)]"
            >
              Date
              {sortBy === "date" &&
                (sortDir === "desc" ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                ))}
            </button>
            <div className="px-3 py-2.5">Predicted</div>
            <div className="px-3 py-2.5">Actual</div>
            <div className="px-3 py-2.5">Conf</div>
            <button
              onClick={() => toggleSort("brier")}
              className="flex items-center gap-1 px-3 py-2.5 text-left hover:text-[var(--text-primary)]"
            >
              Brier
              {sortBy === "brier" &&
                (sortDir === "desc" ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronUp className="h-3 w-3" />
                ))}
            </button>
            <div className="px-3 py-2.5 text-center">OK?</div>
            <div />
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
              No predictions match the current filters.
            </div>
          ) : (
            filtered.map((r, i) => (
              <motion.div
                key={r.predictionId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                {/* Main row */}
                <div
                  className={`grid cursor-pointer items-center gap-2 border-b border-[var(--border-color)] transition-colors hover:bg-[var(--bg-card-hover)] sm:grid-cols-[1fr_120px_100px_100px_80px_80px_80px_70px_40px] ${
                    expandedRow === r.predictionId
                      ? "bg-[var(--bg-card)]"
                      : ""
                  }`}
                  onClick={() =>
                    setExpandedRow(
                      expandedRow === r.predictionId ? null : r.predictionId,
                    )
                  }
                >
                  {/* Match */}
                  <div className="min-w-0 px-4 py-2.5">
                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {r.homeTeam} vs {r.awayTeam}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {r.competition}
                    </div>
                  </div>

                  {/* Model */}
                  <div className="hidden px-3 sm:block">
                    <ModelBadge
                      name={r.modelName}
                      version={r.modelVersion}
                    />
                  </div>

                  {/* Date */}
                  <div className="hidden items-center gap-1.5 px-3 text-xs text-[var(--text-secondary)] sm:flex">
                    <Clock className="h-3 w-3 flex-shrink-0 text-[var(--text-muted)]" />
                    {r.matchDate}
                  </div>

                  {/* Predicted */}
                  <div className="hidden px-3 text-xs tabular-nums text-[var(--text-secondary)] sm:block">
                    <span className="text-[var(--accent-green)]">
                      {r.predicted.homeWin}%
                    </span>
                    {" / "}
                    <span className="text-[var(--accent-amber)]">
                      {r.predicted.draw}%
                    </span>
                    {" / "}
                    <span className="text-[var(--accent-blue)]">
                      {r.predicted.awayWin}%
                    </span>
                  </div>

                  {/* Actual */}
                  <div className="hidden px-3 text-sm font-medium tabular-nums text-[var(--text-primary)] sm:block">
                    {r.actual.homeScore} - {r.actual.awayScore}
                  </div>

                  {/* Confidence */}
                  <div className="hidden px-3 text-xs tabular-nums text-[var(--accent-purple)] sm:block">
                    {r.confidence}%
                  </div>

                  {/* Brier */}
                  <div className="hidden px-3 text-xs tabular-nums sm:block">
                    <span
                      style={{
                        color:
                          r.brier < 0.4
                            ? "var(--accent-green)"
                            : r.brier < 0.7
                              ? "var(--accent-amber)"
                              : "var(--accent-red)",
                      }}
                    >
                      {r.brier.toFixed(3)}
                    </span>
                  </div>

                  {/* Correct */}
                  <div className="hidden px-3 text-center sm:block">
                    {r.correct ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-[var(--accent-green)]" />
                    ) : (
                      <XCircle className="mx-auto h-4 w-4 text-[var(--accent-red)]" />
                    )}
                  </div>

                  {/* Expand arrow */}
                  <div className="flex items-center justify-center px-2 py-2.5">
                    {expandedRow === r.predictionId ? (
                      <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                    )}
                  </div>

                  {/* Mobile summary */}
                  <div className="flex flex-wrap items-center gap-2 px-4 pb-2.5 sm:hidden">
                    <span className="text-xs text-[var(--text-muted)]">
                      {r.matchDate}
                    </span>
                    <span className="text-sm font-medium tabular-nums text-[var(--text-primary)]">
                      {r.actual.homeScore} - {r.actual.awayScore}
                    </span>
                    <span
                      className={`badge text-[10px] ${
                        r.correct ? "badge-green" : "badge-red"
                      }`}
                    >
                      {r.correct ? "Correct" : "Wrong"}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedRow === r.predictionId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-b border-[var(--border-color)] bg-[var(--bg-primary)]"
                  >
                    <div className="grid gap-3 p-4 sm:grid-cols-3">
                      {/* Predicted breakdown */}
                      <div className="space-y-2 rounded bg-[var(--bg-card)] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          Prediction Breakdown
                        </div>
                        <div className="space-y-1.5">
                          {(
                            [
                              {
                                label: "Home Win",
                                value: r.predicted.homeWin,
                                color: "var(--accent-green)",
                              },
                              {
                                label: "Draw",
                                value: r.predicted.draw,
                                color: "var(--accent-amber)",
                              },
                              {
                                label: "Away Win",
                                value: r.predicted.awayWin,
                                color: "var(--accent-blue)",
                              },
                            ] as const
                          ).map((item) => (
                            <div key={item.label} className="space-y-0.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[var(--text-muted)]">
                                  {item.label}
                                </span>
                                <span
                                  className="tabular-nums font-medium"
                                  style={{ color: item.color }}
                                >
                                  {item.value}%
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${item.value}%`,
                                    background: item.color,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actual result */}
                      <div className="space-y-2 rounded bg-[var(--bg-card)] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          Actual Result
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <div className="text-xs text-[var(--text-muted)]">
                              {r.homeTeam}
                            </div>
                            <div className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                              {r.actual.homeScore}
                            </div>
                          </div>
                          <div className="text-lg text-[var(--text-muted)]">
                            -
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-[var(--text-muted)]">
                              {r.awayTeam}
                            </div>
                            <div className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                              {r.actual.awayScore}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`badge text-[10px] ${outcomeBadgeClass(r.actualOutcome)}`}
                          >
                            {r.actualOutcome === "homeWin"
                              ? "Home Win"
                              : r.actualOutcome === "draw"
                                ? "Draw"
                                : "Away Win"}
                          </span>
                          <span
                            className={`badge text-[10px] ${
                              r.correct ? "badge-green" : "badge-red"
                            }`}
                          >
                            {r.correct ? "Correct" : "Incorrect"}
                          </span>
                        </div>
                      </div>

                      {/* Scoring */}
                      <div className="space-y-2 rounded bg-[var(--bg-card)] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                          Scoring
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)]">
                              Brier Score
                            </span>
                            <span
                              className="text-sm font-medium tabular-nums"
                              style={{
                                color:
                                  r.brier < 0.4
                                    ? "var(--accent-green)"
                                    : r.brier < 0.7
                                      ? "var(--accent-amber)"
                                      : "var(--accent-red)",
                              }}
                            >
                              {r.brier.toFixed(3)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)]">
                              Confidence
                            </span>
                            <span className="text-sm font-medium tabular-nums text-[var(--accent-purple)]">
                              {r.confidence}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)]">
                              Model
                            </span>
                            <span className="text-xs text-[var(--text-secondary)]">
                              {r.modelName} v{r.modelVersion}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)]">
                              Prediction ID
                            </span>
                            <span className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                              {r.predictionId}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* ── Disclaimer ────────────────────────────────────────── */}
        <div className="card border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5">
          <p className="text-xs text-[var(--text-secondary)]">
            For commentary assistance, not betting advice. All predictions are
            probabilistic estimates generated by statistical models. Past
            performance does not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label,
  value,
  icon,
  color,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  hint?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
          {hint}
        </div>
      )}
    </motion.div>
  );
}
