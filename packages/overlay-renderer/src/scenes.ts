// @lineupcast/overlay-renderer — scene renderers (pure SVG/HTML strings)

import type {
  LineupSceneInput,
  ShortVideoInput,
  LowerThirdInput,
  PredictionStripInput,
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
</svg>`;
}
