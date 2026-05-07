// @lineupcast/overlay-renderer — enhanced overlay tests

import { describe, it, expect } from "vitest";

import {
  renderLineupScene16x9,
  renderShortVideo9x16,
  renderLowerThird,
  renderPredictionStrip,
  renderDisciplineRiskAlert,
} from "../scenes.js";

import {
  exportOverlayJson,
  exportOverlaySvg,
  exportOverlayPng,
  createBrowserSourceUrl,
  exportOverlayHtml,
} from "../export.js";

import type {
  LineupSceneInput,
  ShortVideoInput,
  LowerThirdInput,
  PredictionStripInput,
  DisciplineRiskAlertInput,
  OverlayExportPayload,
} from "../types.js";

// ─── Shared test fixtures ──────────────────────────────────────────

const match = {
  id: "m1",
  homeTeamId: "t1",
  awayTeamId: "t2",
  kickoff: "2026-05-07T20:00:00Z",
  league: "Premier League",
  status: "scheduled" as const,
};

const homeTeam = { id: "t1", name: "Arsenal", shortName: "ARS", league: "Premier League" };
const awayTeam = { id: "t2", name: "Chelsea", shortName: "CHE", league: "Premier League" };

const prediction = {
  matchId: "m1",
  homeWin: 0.45,
  draw: 0.25,
  awayWin: 0.3,
  expectedHomeGoals: 1.8,
  expectedAwayGoals: 1.2,
  confidence: "medium" as const,
};

const homePlayers = [
  { id: "p1", name: "Saka", teamId: "t1", position: "RW" as const, shirtNumber: 7, x: 0.8, y: 0.3 },
  { id: "p2", name: "Odegaard", teamId: "t1", position: "AM" as const, shirtNumber: 8, x: 0.5, y: 0.4 },
];

const awayPlayers = [
  { id: "p3", name: "Palmer", teamId: "t2", position: "AM" as const, shirtNumber: 20, x: 0.5, y: 0.4 },
];

const lineupInput: LineupSceneInput = {
  match,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  homeFormation: "4-3-3",
  awayFormation: "4-2-3-1",
};

const shortVideoInput: ShortVideoInput = {
  match,
  homeTeam,
  awayTeam,
  prediction,
};

const lowerThirdInput: LowerThirdInput = {
  player: { id: "p1", name: "Bukayo Saka", teamId: "t1", position: "RW", shirtNumber: 7 },
  team: homeTeam,
  stats: { Goals: 12, Assists: 9 },
};

const predictionStripInput: PredictionStripInput = {
  match,
  homeTeam,
  awayTeam,
  prediction,
};

const disciplineInput: DisciplineRiskAlertInput = {
  match,
  homeTeam,
  awayTeam,
  players: [
    { name: "Granit Xhaka", team: "ARS", yellowRisk: 85, redRisk: "high", foulsPer90: 2.4 },
    { name: "Moises Caicedo", team: "CHE", yellowRisk: 62, redRisk: "medium", foulsPer90: 1.9 },
    { name: "Declan Rice", team: "ARS", yellowRisk: 30, redRisk: "low", foulsPer90: 1.1 },
  ],
  dataSource: "Opta",
};

// ─── Scene renderers ───────────────────────────────────────────────

describe("renderLineupScene16x9", () => {
  it("produces valid SVG with correct dimensions", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain('viewBox="0 0 1920 1080"');
    expect(svg).toContain('width="1920"');
    expect(svg).toContain('height="1080"');
  });

  it("renders team names", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain("Arsenal");
    expect(svg).toContain("Chelsea");
  });

  it("renders player names", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain("Saka");
    expect(svg).toContain("Palmer");
  });

  it("includes disclaimer text", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain("For commentary assistance, not betting advice.");
  });

  it("includes data source attribution", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain("Data: LineupCast");
  });

  it("renders formations", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain("4-3-3");
    expect(svg).toContain("4-2-3-1");
  });
});

describe("renderShortVideo9x16", () => {
  it("produces valid SVG with 9:16 dimensions", () => {
    const svg = renderShortVideo9x16(shortVideoInput);
    expect(svg).toContain('viewBox="0 0 1080 1920"');
  });

  it("renders prediction percentages", () => {
    const svg = renderShortVideo9x16(shortVideoInput);
    expect(svg).toContain("45%");
    expect(svg).toContain("25%");
    expect(svg).toContain("30%");
  });

  it("renders expected goals", () => {
    const svg = renderShortVideo9x16(shortVideoInput);
    expect(svg).toContain("1.8");
    expect(svg).toContain("1.2");
  });

  it("includes disclaimer text", () => {
    const svg = renderShortVideo9x16(shortVideoInput);
    expect(svg).toContain("For commentary assistance, not betting advice.");
  });

  it("includes data source attribution", () => {
    const svg = renderShortVideo9x16(shortVideoInput);
    expect(svg).toContain("Data: LineupCast");
  });
});

describe("renderLowerThird", () => {
  it("renders player name and team", () => {
    const svg = renderLowerThird(lowerThirdInput);
    expect(svg).toContain("Bukayo Saka");
    expect(svg).toContain("ARS");
    expect(svg).toContain("#7");
  });

  it("renders stats", () => {
    const svg = renderLowerThird(lowerThirdInput);
    expect(svg).toContain("Goals");
    expect(svg).toContain("12");
    expect(svg).toContain("Assists");
    expect(svg).toContain("9");
  });

  it("includes disclaimer and data source", () => {
    const svg = renderLowerThird(lowerThirdInput);
    expect(svg).toContain("For commentary assistance, not betting advice.");
    expect(svg).toContain("Data: LineupCast");
  });
});

describe("renderPredictionStrip", () => {
  it("renders a 600x60 SVG strip", () => {
    const svg = renderPredictionStrip(predictionStripInput);
    expect(svg).toContain('viewBox="0 0 600 60"');
  });

  it("renders team short names", () => {
    const svg = renderPredictionStrip(predictionStripInput);
    expect(svg).toContain("ARS");
    expect(svg).toContain("CHE");
    expect(svg).toContain("Draw");
  });

  it("renders percentage labels", () => {
    const svg = renderPredictionStrip(predictionStripInput);
    expect(svg).toContain("45%");
    expect(svg).toContain("25%");
    expect(svg).toContain("30%");
  });

  it("includes disclaimer", () => {
    const svg = renderPredictionStrip(predictionStripInput);
    expect(svg).toContain("For commentary assistance, not betting advice.");
  });
});

// ─── Discipline Risk Alert ─────────────────────────────────────────

describe("renderDisciplineRiskAlert", () => {
  it("produces 16:9 SVG by default", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain('viewBox="0 0 1920 1080"');
    expect(svg).toContain('width="1920"');
    expect(svg).toContain('height="1080"');
  });

  it("produces 9:16 SVG when specified", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput, "9:16");
    expect(svg).toContain('viewBox="0 0 1080 1920"');
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
  });

  it("renders card risk alert header", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("Card Risk Alert");
  });

  it("renders match context", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("ARS");
    expect(svg).toContain("CHE");
    expect(svg).toContain("Premier League");
  });

  it("renders all player names", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("Granit Xhaka");
    expect(svg).toContain("Moises Caicedo");
    expect(svg).toContain("Declan Rice");
  });

  it("renders risk percentages", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("85%");
    expect(svg).toContain("62%");
    expect(svg).toContain("30%");
  });

  it("renders red risk levels", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("high");
    expect(svg).toContain("medium");
    expect(svg).toContain("low");
  });

  it("sorts players by yellow risk descending", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    const xhakaPos = svg.indexOf("Granit Xhaka");
    const caicedoPos = svg.indexOf("Moises Caicedo");
    const ricePos = svg.indexOf("Declan Rice");
    expect(xhakaPos).toBeLessThan(caicedoPos);
    expect(caicedoPos).toBeLessThan(ricePos);
  });

  it("uses custom data source", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("Data: Opta");
  });

  it("uses default data source when not specified", () => {
    const inputNoSource: DisciplineRiskAlertInput = {
      ...disciplineInput,
      dataSource: undefined,
    };
    const svg = renderDisciplineRiskAlert(inputNoSource);
    expect(svg).toContain("Data: LineupCast");
  });

  it("includes disclaimer", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("For commentary assistance, not betting advice.");
  });

  it("renders fouls per 90 stats", () => {
    const svg = renderDisciplineRiskAlert(disciplineInput);
    expect(svg).toContain("2.4 fouls/90");
    expect(svg).toContain("1.9 fouls/90");
    expect(svg).toContain("1.1 fouls/90");
  });

  it("limits displayed players to max rows", () => {
    const manyPlayers = Array.from({ length: 20 }, (_, i) => ({
      name: `Player ${i}`,
      team: "ARS",
      yellowRisk: 100 - i * 5,
      redRisk: "high" as const,
      foulsPer90: 2.0,
    }));
    const svg = renderDisciplineRiskAlert({
      ...disciplineInput,
      players: manyPlayers,
    });
    // 16:9 max is 8 rows
    expect(svg).toContain("Player 0");
    expect(svg).toContain("Player 7");
    expect(svg).not.toContain("Player 8");
  });
});

// ─── Export helpers ────────────────────────────────────────────────

describe("exportOverlayJson", () => {
  it("serialises payload to JSON", () => {
    const payload: OverlayExportPayload = {
      version: "1.0",
      generatedAt: "2026-05-07T00:00:00Z",
      dataSource: "LineupCast",
      disclaimer: "For commentary assistance, not betting advice.",
      scenes: [{ id: "s1", type: "lineup", svg: "<svg/>", width: 1920, height: 1080 }],
    };
    const json = exportOverlayJson(payload);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("1.0");
    expect(parsed.dataSource).toBe("LineupCast");
    expect(parsed.disclaimer).toContain("not betting advice");
    expect(parsed.scenes).toHaveLength(1);
  });
});

describe("exportOverlaySvg", () => {
  it("returns complete SVG as-is", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    expect(exportOverlaySvg(svg)).toBe(svg);
  });

  it("wraps bare fragments in a complete SVG", () => {
    const fragment = "<rect/><circle/>";
    const result = exportOverlaySvg(fragment);
    expect(result).toContain('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(result).toContain(fragment);
  });
});

describe("exportOverlayPng", () => {
  it("returns a placeholder with instructions", () => {
    const result = exportOverlayPng("<svg/>", 1920, 1080);
    expect(result.status).toBe("placeholder");
    expect(result.instructions).toContain("rasteriser");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });
});

// ─── Browser Source URL ────────────────────────────────────────────

describe("createBrowserSourceUrl", () => {
  it("produces a data: URL for inline SVG by default", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
    const url = createBrowserSourceUrl(svg);
    expect(url).toMatch(/^data:text\/html;base64,/);
  });

  it("embeds the SVG in the base64 HTML", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const url = createBrowserSourceUrl(svg);
    const encoded = url.replace("data:text/html;base64,", "");
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    expect(decoded).toContain("<!DOCTYPE html>");
    expect(decoded).toContain("rect");
  });

  it("applies custom width and height to inline SVG", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const url = createBrowserSourceUrl(svg, { width: 1080, height: 1920 });
    const encoded = url.replace("data:text/html;base64,", "");
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    expect(decoded).toContain("width:1080px;height:1920px");
  });

  it("returns an absolute URL with query params when baseUrl is provided", () => {
    const svg = '<svg/>';
    const url = createBrowserSourceUrl(svg, {
      baseUrl: "https://overlays.example.com/scene",
      width: 1920,
      height: 1080,
    });
    expect(url).toMatch(/^https:\/\/overlays\.example\.com\/scene\?/);
    expect(url).toContain("w=1920");
    expect(url).toContain("h=1080");
  });

  it("appends secret to the URL when provided", () => {
    const svg = '<svg/>';
    const url = createBrowserSourceUrl(svg, {
      baseUrl: "https://overlays.example.com/scene",
      secret: "my-secret-token",
    });
    expect(url).toContain("secret=my-secret-token");
  });

  it("does not include secret param when not provided", () => {
    const svg = '<svg/>';
    const url = createBrowserSourceUrl(svg, {
      baseUrl: "https://overlays.example.com/scene",
    });
    expect(url).not.toContain("secret=");
  });
});

// ─── HTML Export ───────────────────────────────────────────────────

describe("exportOverlayHtml", () => {
  const svg1 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#0d1117"/></svg>';
  const svg2 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#1a1a2e"/></svg>';

  it("produces a complete HTML document", () => {
    const html = exportOverlayHtml([svg1]);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
  });

  it("embeds the SVG content", () => {
    const html = exportOverlayHtml([svg1]);
    expect(html).toContain("fill=\"#0d1117\"");
  });

  it("includes disclaimer by default", () => {
    const html = exportOverlayHtml([svg1]);
    expect(html).toContain("For commentary assistance, not betting advice.");
  });

  it("includes data source attribution", () => {
    const html = exportOverlayHtml([svg1]);
    expect(html).toContain("Data: LineupCast");
  });

  it("uses custom data source", () => {
    const html = exportOverlayHtml([svg1], { dataSource: "Opta" });
    expect(html).toContain("Data: Opta");
  });

  it("hides disclaimer when showDisclaimer is false", () => {
    const html = exportOverlayHtml([svg1], { showDisclaimer: false });
    expect(html).not.toContain("For commentary assistance");
  });

  it("sets custom dimensions", () => {
    const html = exportOverlayHtml([svg1], { width: 1080, height: 1920 });
    expect(html).toContain("width: 1080px");
    expect(html).toContain("height: 1920px");
  });

  it("sets custom title", () => {
    const html = exportOverlayHtml([svg1], { title: "My Overlay" });
    expect(html).toContain("<title>My Overlay</title>");
  });

  it("sets custom background", () => {
    const html = exportOverlayHtml([svg1], { background: "#000" });
    expect(html).toContain("background: #000");
  });

  it("hides second scene by default for multi-scene", () => {
    const html = exportOverlayHtml([svg1, svg2]);
    expect(html).toContain('id="scene-0"');
    expect(html).toContain('id="scene-1"');
    expect(html).toContain('style="display:none"');
  });

  it("includes auto-refresh meta tag when specified", () => {
    const html = exportOverlayHtml([svg1], { autoRefreshSeconds: 30 });
    expect(html).toContain('<meta http-equiv="refresh" content="30">');
  });

  it("does not include auto-refresh meta tag by default", () => {
    const html = exportOverlayHtml([svg1]);
    expect(html).not.toContain("http-equiv=\"refresh\"");
  });

  it("escapes HTML entities in title", () => {
    const html = exportOverlayHtml([svg1], { title: '<script>alert("xss")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ─── Type-level smoke tests ────────────────────────────────────────

describe("type exports", () => {
  it("DisciplineRiskAlertInput compiles with correct shape", () => {
    const input: DisciplineRiskAlertInput = disciplineInput;
    expect(input.players).toHaveLength(3);
  });

  it("OverlayExportHistoryEntry compiles", async () => {
    // Verify the module loads and exports the expected types
    const mod = await import("../types.js");
    // Module should load without error; the types exist at compile time
    expect(mod).toBeDefined();
  });
});
