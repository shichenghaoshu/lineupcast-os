// @lineupcast/overlay-renderer — broadcast graphic export (SVG/HTML/JSON/PNG)

export type {
  LineupPlayer,
  LineupSceneInput,
  ShortVideoInput,
  LowerThirdInput,
  PredictionStripInput,
  OverlayExportPayload,
} from "./types.js";

export {
  renderLineupScene16x9,
  renderShortVideo9x16,
  renderLowerThird,
  renderPredictionStrip,
} from "./scenes.js";

export {
  exportOverlayJson,
  exportOverlaySvg,
  exportOverlayPng,
  createBrowserSourceUrl,
} from "./export.js";

// ─── Legacy HTML renderer (preserved for backwards compat) ─────────

import type { Prediction, Match, Team } from "@lineupcast/schema";

export interface OverlayConfig {
  width: number;
  height: number;
  theme: "dark" | "light";
  showLogo: boolean;
}

export interface OverlayData {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  prediction: Prediction;
}

/** Generate an HTML string for a broadcast overlay card. */
export function renderOverlayHTML(data: OverlayData, config?: Partial<OverlayConfig>): string {
  const cfg: OverlayConfig = { width: 1920, height: 1080, theme: "dark", showLogo: true, ...config };

  return `<!DOCTYPE html>
<html>
<head><style>
  body { margin: 0; font-family: system-ui, sans-serif; background: ${cfg.theme === "dark" ? "#111" : "#fff"}; color: ${cfg.theme === "dark" ? "#fff" : "#111"}; width: ${cfg.width}px; height: ${cfg.height}px; display: flex; align-items: center; justify-content: center; }
  .card { text-align: center; }
  .score { font-size: 4rem; font-weight: 700; }
</style></head>
<body>
  <div class="card">
    <h1>${data.homeTeam.shortName} vs ${data.awayTeam.shortName}</h1>
    <div class="score">${data.prediction.expectedHomeGoals} – ${data.prediction.expectedAwayGoals}</div>
    <p>Win: ${Math.round(data.prediction.homeWin * 100)}% | Draw: ${Math.round(data.prediction.draw * 100)}% | Loss: ${Math.round(data.prediction.awayWin * 100)}%</p>
  </div>
</body>
</html>`;
}
