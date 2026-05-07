// @lineupcast/overlay-renderer — scene renderers (pure SVG/HTML strings)

import type {
  LineupSceneInput,
  ShortVideoInput,
  LowerThirdInput,
  PredictionStripInput,
  DisciplineRiskAlertInput,
  LineupPlayer,
} from "./types.js";

// ─── Shared helpers ────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const DISCLAIMER = "For commentary assistance, not betting advice.";
const DEFAULT_DATA_SOURCE = "LineupCast";

/** SVG fragment: disclaimer text anchored bottom-centre. */
function disclaimerSvg(w: number, h: number): string {
  return `<text x="${w / 2}" y="${h - 12}" text-anchor="middle" font-size="12" fill="#555" font-family="system-ui,sans-serif">${escapeXml(DISCLAIMER)}</text>`;
}

/** SVG fragment: data source attribution anchored bottom-left. */
function dataSourceSvg(_w: number, h: number, source: string): string {
  return `<text x="12" y="${h - 12}" font-size="11" fill="#444" font-family="system-ui,sans-serif">Data: ${escapeXml(source)}</text>`;
}

// ─── Player dot + label ────────────────────────────────────────────

function playerDot(
  p: LineupPlayer,
  cx: number,
  cy: number,
  fill: string,
  textColor: string,
): string {
  const num = p.shirtNumber != null ? String(p.shirtNumber) : "";
  const name = escapeXml(p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name);
  return `
    <circle cx="${cx}" cy="${cy}" r="18" fill="${fill}" stroke="#fff" stroke-width="2"/>
    ${num ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${textColor}">${escapeXml(num)}</text>` : ""}
    <text x="${cx}" y="${cy + 34}" text-anchor="middle" font-size="11" fill="#ddd">${name}</text>`;
}

// ─── Pitch background (SVG fragment) ──────────────────────────────

function pitchSvg(w: number, h: number): string {
  const lw = 2;
  const m = 40; // margin
  const pw = w - m * 2;
  const ph = h - m * 2;
  const cx = w / 2;
  const cy = h / 2;
  return `
    <rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="#1a472a"/>
    <rect x="${m}" y="${m}" width="${pw}" height="${ph}" fill="none" stroke="#fff" stroke-width="${lw}"/>
    <line x1="${cx}" y1="${m}" x2="${cx}" y2="${m + ph}" stroke="#fff" stroke-width="${lw}"/>
    <circle cx="${cx}" cy="${cy}" r="60" fill="none" stroke="#fff" stroke-width="${lw}"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="#fff"/>
    <rect x="${m}" y="${cy - 80}" width="100" height="160" fill="none" stroke="#fff" stroke-width="${lw}"/>
    <rect x="${w - m - 100}" y="${cy - 80}" width="100" height="160" fill="none" stroke="#fff" stroke-width="${lw}"/>`;
}

// ─── 16:9 Lineup Graphic ──────────────────────────────────────────

export function renderLineupScene16x9(input: LineupSceneInput): string {
  const W = 1920;
  const H = 1080;
  const pitchTop = 140;
  const pitchH = H - pitchTop - 60;
  const pitchW = W - 160;
  const pitchLeft = 80;

  const playerSvg = (players: LineupPlayer[], fill: string, textColor: string, flip: boolean) =>
    players
      .map((p) => {
        const px = flip ? 1 - p.x : p.x;
        const cx = pitchLeft + px * pitchW;
        const cy = pitchTop + p.y * pitchH;
        return playerDot(p, cx, cy, fill, textColor);
      })
      .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="headerBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0d1117" rx="0"/>
  <rect x="0" y="0" width="${W}" height="130" fill="url(#headerBg)"/>
  <text x="80" y="55" font-size="36" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${escapeXml(input.homeTeam.name)}</text>
  <text x="${W / 2}" y="55" text-anchor="middle" font-size="28" fill="#888" font-family="system-ui,sans-serif">vs</text>
  <text x="${W - 80}" y="55" text-anchor="end" font-size="36" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${escapeXml(input.awayTeam.name)}</text>
  <text x="80" y="100" font-size="20" fill="#aaa" font-family="system-ui,sans-serif">${escapeXml(input.homeFormation)}</text>
  <text x="${W - 80}" y="100" text-anchor="end" font-size="20" fill="#aaa" font-family="system-ui,sans-serif">${escapeXml(input.awayFormation)}</text>
  <text x="${W / 2}" y="100" text-anchor="middle" font-size="16" fill="#555" font-family="system-ui,sans-serif">${escapeXml(input.match.league)}</text>
  <g transform="translate(${pitchLeft},${pitchTop})">
    ${pitchSvg(pitchW, pitchH)}
  </g>
  ${playerSvg(input.homePlayers, "#e63946", "#fff", false)}
  ${playerSvg(input.awayPlayers, "#457b9d", "#fff", true)}
  ${dataSourceSvg(W, H, DEFAULT_DATA_SOURCE)}
  ${disclaimerSvg(W, H)}
</svg>`;
}

// ─── 9:16 Short Video Card ────────────────────────────────────────

export function renderShortVideo9x16(input: ShortVideoInput): string {
  const W = 1080;
  const H = 1920;

  const homePct = pct(input.prediction.homeWin);
  const drawPct = pct(input.prediction.draw);
  const awayPct = pct(input.prediction.awayWin);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg916" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="50%" stop-color="#161b22"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg916)"/>

  <!-- League badge -->
  <text x="${W / 2}" y="100" text-anchor="middle" font-size="24" fill="#888" font-family="system-ui,sans-serif">${escapeXml(input.match.league)}</text>

  <!-- Home crest area -->
  <circle cx="${W / 2 - 160}" cy="260" r="80" fill="#1a1a2e" stroke="#333" stroke-width="2"/>
  <text x="${W / 2 - 160}" y="270" text-anchor="middle" font-size="32" font-weight="700" fill="#e63946" font-family="system-ui,sans-serif">${escapeXml(input.homeTeam.shortName)}</text>

  <!-- Away crest area -->
  <circle cx="${W / 2 + 160}" cy="260" r="80" fill="#1a1a2e" stroke="#333" stroke-width="2"/>
  <text x="${W / 2 + 160}" y="270" text-anchor="middle" font-size="32" font-weight="700" fill="#457b9d" font-family="system-ui,sans-serif">${escapeXml(input.awayTeam.shortName)}</text>

  <!-- VS -->
  <text x="${W / 2}" y="275" text-anchor="middle" font-size="28" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">VS</text>

  <!-- Prediction bar -->
  <rect x="80" y="400" width="${W - 160}" height="60" rx="30" fill="#1a1a2e"/>
  <rect x="80" y="400" width="${(W - 160) * input.prediction.homeWin}" height="60" rx="30 0 0 30" fill="#e63946"/>
  <rect x="${80 + (W - 160) * input.prediction.homeWin}" y="400" width="${(W - 160) * input.prediction.draw}" height="60" fill="#f4a261"/>
  <rect x="${80 + (W - 160) * (input.prediction.homeWin + input.prediction.draw)}" y="400" width="${(W - 160) * input.prediction.awayWin}" height="60" rx="0 30 30 0" fill="#457b9d"/>

  <text x="${W / 2 - 200}" y="438" text-anchor="middle" font-size="20" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${homePct}</text>
  <text x="${W / 2}" y="438" text-anchor="middle" font-size="20" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${drawPct}</text>
  <text x="${W / 2 + 200}" y="438" text-anchor="middle" font-size="20" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${awayPct}</text>

  <!-- xG -->
  <text x="${W / 2}" y="540" text-anchor="middle" font-size="22" fill="#aaa" font-family="system-ui,sans-serif">Expected Goals</text>
  <text x="${W / 2 - 80}" y="590" text-anchor="middle" font-size="48" font-weight="700" fill="#e63946" font-family="system-ui,sans-serif">${input.prediction.expectedHomeGoals.toFixed(1)}</text>
  <text x="${W / 2}" y="590" text-anchor="middle" font-size="36" fill="#555" font-family="system-ui,sans-serif">–</text>
  <text x="${W / 2 + 80}" y="590" text-anchor="middle" font-size="48" font-weight="700" fill="#457b9d" font-family="system-ui,sans-serif">${input.prediction.expectedAwayGoals.toFixed(1)}</text>

  <!-- Confidence -->
  <text x="${W / 2}" y="680" text-anchor="middle" font-size="18" fill="#666" font-family="system-ui,sans-serif">Confidence: ${input.prediction.confidence}</text>

  ${dataSourceSvg(W, H, DEFAULT_DATA_SOURCE)}
  ${disclaimerSvg(W, H)}
</svg>`;
}

// ─── Player Lower-Third ───────────────────────────────────────────

export function renderLowerThird(input: LowerThirdInput): string {
  const W = 800;
  const H = 100;
  const statsEntries = input.stats ? Object.entries(input.stats) : [];
  const statsHtml = statsEntries
    .map(
      ([k, v], i) =>
        `<text x="${420 + i * 100}" y="65" font-size="16" fill="#aaa" font-family="system-ui,sans-serif">${escapeXml(k)}: <tspan font-weight="700" fill="#fff">${escapeXml(String(v))}</tspan></text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="ltBg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b22" stop-opacity="0.9"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ltBg)" rx="8"/>
  <rect x="0" y="0" width="6" height="${H}" fill="#e63946" rx="8 0 0 8"/>
  <text x="24" y="45" font-size="28" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${escapeXml(input.player.name)}</text>
  <text x="24" y="75" font-size="16" fill="#aaa" font-family="system-ui,sans-serif">${escapeXml(input.team.shortName)}${input.player.shirtNumber != null ? ` · #${input.player.shirtNumber}` : ""} · ${escapeXml(input.player.position)}</text>
  ${statsHtml}
  <text x="${W - 12}" y="${H - 10}" text-anchor="end" font-size="9" fill="#444" font-family="system-ui,sans-serif">${escapeXml(DISCLAIMER)} | Data: ${escapeXml(DEFAULT_DATA_SOURCE)}</text>
</svg>`;
}

// ─── Prediction Probability Strip ─────────────────────────────────

export function renderPredictionStrip(input: PredictionStripInput): string {
  const W = 600;
  const H = 60;
  const barW = W - 40;
  const barH = 24;
  const barY = 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#0d1117" rx="6"/>

  <!-- Labels -->
  <text x="20" y="18" font-size="14" font-weight="700" fill="#e63946" font-family="system-ui,sans-serif">${escapeXml(input.homeTeam.shortName)}</text>
  <text x="${W / 2}" y="18" text-anchor="middle" font-size="14" fill="#f4a261" font-family="system-ui,sans-serif">Draw</text>
  <text x="${W - 20}" y="18" text-anchor="end" font-size="14" font-weight="700" fill="#457b9d" font-family="system-ui,sans-serif">${escapeXml(input.awayTeam.shortName)}</text>

  <!-- Bar -->
  <rect x="20" y="${barY}" width="${barW}" height="${barH}" rx="${barH / 2}" fill="#1a1a2e"/>
  <rect x="20" y="${barY}" width="${barW * input.prediction.homeWin}" height="${barH}" rx="${barH / 2} 0 0 ${barH / 2}" fill="#e63946"/>
  <rect x="${20 + barW * input.prediction.homeWin}" y="${barY}" width="${barW * input.prediction.draw}" height="${barH}" fill="#f4a261"/>
  <rect x="${20 + barW * (input.prediction.homeWin + input.prediction.draw)}" y="${barY}" width="${barW * input.prediction.awayWin}" height="${barH}" rx="0 ${barH / 2} ${barH / 2} 0" fill="#457b9d"/>

  <!-- Percentage labels on bar -->
  <text x="${20 + barW * input.prediction.homeWin / 2}" y="${barY + 17}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${pct(input.prediction.homeWin)}</text>
  <text x="${20 + barW * (input.prediction.homeWin + input.prediction.draw / 2)}" y="${barY + 17}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${pct(input.prediction.draw)}</text>
  <text x="${20 + barW * (input.prediction.homeWin + input.prediction.draw + input.prediction.awayWin / 2)}" y="${barY + 17}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${pct(input.prediction.awayWin)}</text>
  <text x="${W - 8}" y="${H - 6}" text-anchor="end" font-size="8" fill="#444" font-family="system-ui,sans-serif">${escapeXml(DISCLAIMER)}</text>
</svg>`;
}

// ─── Discipline Risk Alert ──────────────────────────────────────

/** Render a discipline risk alert overlay for card-risk warnings. */
export function renderDisciplineRiskAlert(
  input: DisciplineRiskAlertInput,
  aspect: "16:9" | "9:16" = "16:9",
): string {
  const isWide = aspect === "16:9";
  const W = isWide ? 1920 : 1080;
  const H = isWide ? 1080 : 1920;
  const source = input.dataSource ?? DEFAULT_DATA_SOURCE;

  const riskColor = (level: string) =>
    level === "high" ? "#e63946" : level === "medium" ? "#f4a261" : "#2a9d8f";

  const riskIcon = (level: string) =>
    level === "high" ? "⚠" : level === "medium" ? "◆" : "•";

  // Sort players by yellowRisk descending so highest risk appears first
  const sorted = [...input.players].sort((a, b) => b.yellowRisk - a.yellowRisk);
  const maxRows = isWide ? 8 : 12;
  const shown = sorted.slice(0, maxRows);
  const rowH = isWide ? 52 : 56;
  const startY = isWide ? 160 : 200;

  const playerRows = shown
    .map((p, i) => {
      const y = startY + i * rowH;
      const color = riskColor(p.redRisk);
      const icon = riskIcon(p.redRisk);
      const barWidth = (p.yellowRisk / 100) * (isWide ? 300 : 260);
      return `
    <rect x="${isWide ? 60 : 40}" y="${y - 8}" width="${isWide ? W - 120 : W - 80}" height="${rowH - 12}" rx="6" fill="#1a1a2e" stroke="${color}" stroke-width="1"/>
    <text x="${isWide ? 80 : 55}" y="${y + 20}" font-size="16" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${escapeXml(p.name)}</text>
    <text x="${isWide ? 80 : 55}" y="${y + 38}" font-size="12" fill="#888" font-family="system-ui,sans-serif">${escapeXml(p.team)} | ${p.foulsPer90.toFixed(1)} fouls/90</text>
    <rect x="${isWide ? 500 : 380}" y="${y + 8}" width="${isWide ? 300 : 260}" height="14" rx="7" fill="#222"/>
    <rect x="${isWide ? 500 : 380}" y="${y + 8}" width="${barWidth}" height="14" rx="7" fill="${color}"/>
    <text x="${isWide ? 810 : 650}" y="${y + 22}" font-size="14" fill="#aaa" font-family="system-ui,sans-serif">${p.yellowRisk}%</text>
    <text x="${isWide ? 880 : 710}" y="${y + 22}" font-size="14" fill="${color}" font-family="system-ui,sans-serif">${icon} ${escapeXml(p.redRisk)}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="draBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b22"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#draBg)"/>

  <!-- Header -->
  <text x="${W / 2}" y="${isWide ? 60 : 80}" text-anchor="middle" font-size="28" font-weight="700" fill="#e63946" font-family="system-ui,sans-serif">Card Risk Alert</text>
  <text x="${W / 2}" y="${isWide ? 95 : 120}" text-anchor="middle" font-size="18" fill="#aaa" font-family="system-ui,sans-serif">${escapeXml(input.homeTeam.shortName)} vs ${escapeXml(input.awayTeam.shortName)}</text>
  <text x="${W / 2}" y="${isWide ? 125 : 155}" text-anchor="middle" font-size="14" fill="#666" font-family="system-ui,sans-serif">${escapeXml(input.match.league)}</text>

  <!-- Column headers -->
  <text x="${isWide ? 80 : 55}" y="${isWide ? 148 : 185}" font-size="12" fill="#555" font-family="system-ui,sans-serif">PLAYER</text>
  <text x="${isWide ? 500 : 380}" y="${isWide ? 148 : 185}" font-size="12" fill="#555" font-family="system-ui,sans-serif">YELLOW CARD RISK</text>
  <text x="${isWide ? 880 : 710}" y="${isWide ? 148 : 185}" font-size="12" fill="#555" font-family="system-ui,sans-serif">RED RISK</text>

  ${playerRows}

  ${dataSourceSvg(W, H, source)}
  ${disclaimerSvg(W, H)}
</svg>`;
}
