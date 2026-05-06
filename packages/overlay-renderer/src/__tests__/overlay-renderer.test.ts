import { describe, it, expect } from "vitest";
import type { Match, Team, Prediction, Player } from "@lineupcast/schema";
import type { LineupPlayer, LineupSceneInput } from "../types.js";
import {
  renderLineupScene16x9,
  renderShortVideo9x16,
  renderLowerThird,
  renderPredictionStrip,
} from "../scenes.js";
import {
  exportOverlayJson,
  exportOverlaySvg,
  exportOverlayPng,
  createBrowserSourceUrl,
} from "../export.js";

// ─── Fixtures ──────────────────────────────────────────────────────

const homeTeam: Team = {
  id: "home-1",
  name: "Red Town FC",
  shortName: "RTF",
  league: "Premier League",
};

const awayTeam: Team = {
  id: "away-1",
  name: "Blue City United",
  shortName: "BCU",
  league: "Premier League",
};

const match: Match = {
  id: "match-1",
  homeTeamId: "home-1",
  awayTeamId: "away-1",
  kickoff: "2026-05-10T15:00:00Z",
  league: "Premier League",
  status: "scheduled",
};

const prediction: Prediction = {
  matchId: "match-1",
  homeWin: 0.45,
  draw: 0.25,
  awayWin: 0.30,
  expectedHomeGoals: 1.8,
  expectedAwayGoals: 1.2,
  confidence: "medium",
};

function makePlayer(
  id: string,
  name: string,
  position: Player["position"],
  shirtNumber: number,
): Player {
  return { id, name, teamId: "home-1", position, shirtNumber };
}

/** Generate 11 positioned players in a 4-3-3 shape. */
function makeElevenPlayers(): LineupPlayer[] {
  const positions: Array<{ name: string; pos: Player["position"]; x: number; y: number; num: number }> = [
    { name: "GK Alpha", pos: "GK", x: 0.5, y: 0.95, num: 1 },
    { name: "LB Beta", pos: "LB", x: 0.15, y: 0.75, num: 2 },
    { name: "CB Gamma", pos: "CB", x: 0.38, y: 0.8, num: 4 },
    { name: "CB Delta", pos: "CB", x: 0.62, y: 0.8, num: 5 },
    { name: "RB Epsilon", pos: "RB", x: 0.85, y: 0.75, num: 3 },
    { name: "CM Zeta", pos: "CM", x: 0.3, y: 0.55, num: 6 },
    { name: "CM Eta", pos: "CM", x: 0.5, y: 0.5, num: 8 },
    { name: "CM Theta", pos: "CM", x: 0.7, y: 0.55, num: 10 },
    { name: "LW Iota", pos: "LW", x: 0.15, y: 0.3, num: 7 },
    { name: "ST Kappa", pos: "ST", x: 0.5, y: 0.2, num: 9 },
    { name: "RW Lambda", pos: "RW", x: 0.85, y: 0.3, num: 11 },
  ];
  return positions.map((p, i) => ({
    ...makePlayer(`p-${i}`, p.name, p.pos, p.num),
    x: p.x,
    y: p.y,
  }));
}

const lineupInput: LineupSceneInput = {
  match,
  homeTeam,
  awayTeam,
  homePlayers: makeElevenPlayers(),
  awayPlayers: makeElevenPlayers().map((p) => ({ ...p, id: p.id.replace("p-", "a-"), teamId: "away-1" })),
  homeFormation: "4-3-3",
  awayFormation: "4-3-3",
};

// ─── Lineup Scene (16:9) ──────────────────────────────────────────

describe("renderLineupScene16x9", () => {
  it("returns an SVG with viewBox 1920×1080", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain('viewBox="0 0 1920 1080"');
    expect(svg).toContain('width="1920"');
    expect(svg).toContain('height="1080"');
  });

  it("renders exactly 22 player circles (11 per team) plus 2 pitch circles", () => {
    const svg = renderLineupScene16x9(lineupInput);
    const circles = svg.match(/<circle /g);
    // 11 home + 11 away player circles = 22, plus 2 pitch markings (center circle + dot) = 24
    expect(circles).not.toBeNull();
    expect(circles!.length).toBe(24);
  });

  it("renders all 11 home player names", () => {
    const svg = renderLineupScene16x9(lineupInput);
    for (const p of lineupInput.homePlayers) {
      // Names > 12 chars get truncated with …
      const expected = p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name;
      expect(svg).toContain(expected);
    }
  });

  it("renders all 11 home shirt numbers", () => {
    const svg = renderLineupScene16x9(lineupInput);
    for (const p of lineupInput.homePlayers) {
      expect(svg).toContain(`>${p.shirtNumber}</text>`);
    }
  });

  it("contains team names and formation text", () => {
    const svg = renderLineupScene16x9(lineupInput);
    expect(svg).toContain("Red Town FC");
    expect(svg).toContain("Blue City United");
    expect(svg).toContain("4-3-3");
    expect(svg).toContain("Premier League");
  });
});

// ─── Short Video Card (9:16) ──────────────────────────────────────

describe("renderShortVideo9x16", () => {
  it("returns an SVG with viewBox 1080×1920", () => {
    const svg = renderShortVideo9x16({ match, homeTeam, awayTeam, prediction });
    expect(svg).toContain('viewBox="0 0 1080 1920"');
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
  });

  it("shows prediction percentages", () => {
    const svg = renderShortVideo9x16({ match, homeTeam, awayTeam, prediction });
    expect(svg).toContain("45%");
    expect(svg).toContain("25%");
    expect(svg).toContain("30%");
  });

  it("shows expected goals", () => {
    const svg = renderShortVideo9x16({ match, homeTeam, awayTeam, prediction });
    expect(svg).toContain("1.8");
    expect(svg).toContain("1.2");
  });
});

// ─── Lower Third ──────────────────────────────────────────────────

describe("renderLowerThird", () => {
  const player = makePlayer("p1", "John Smith", "ST", 9);

  it("renders player name and team", () => {
    const svg = renderLowerThird({ player, team: homeTeam });
    expect(svg).toContain("John Smith");
    expect(svg).toContain("RTF");
    expect(svg).toContain("#9");
    expect(svg).toContain("ST");
  });

  it("includes stats when provided", () => {
    const svg = renderLowerThird({ player, team: homeTeam, stats: { Goals: 12, Assists: 5 } });
    expect(svg).toContain("Goals");
    expect(svg).toContain("12");
    expect(svg).toContain("Assists");
    expect(svg).toContain("5");
  });
});

// ─── Prediction Strip ─────────────────────────────────────────────

describe("renderPredictionStrip", () => {
  it("renders the correct viewBox dimensions", () => {
    const svg = renderPredictionStrip({ match, homeTeam, awayTeam, prediction });
    expect(svg).toContain('viewBox="0 0 600 60"');
  });

  it("contains team short names and percentages", () => {
    const svg = renderPredictionStrip({ match, homeTeam, awayTeam, prediction });
    expect(svg).toContain("RTF");
    expect(svg).toContain("BCU");
    expect(svg).toContain("45%");
    expect(svg).toContain("25%");
    expect(svg).toContain("30%");
  });
});

// ─── Export helpers ────────────────────────────────────────────────

describe("exportOverlayJson", () => {
  it("returns valid JSON with the correct structure", () => {
    const payload = {
      version: "1.0.0",
      generatedAt: "2026-05-06T00:00:00Z",
      scenes: [
        { id: "s1", type: "lineup", svg: "<svg></svg>", width: 1920, height: 1080 },
      ],
    };
    const json = exportOverlayJson(payload);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.scenes).toHaveLength(1);
    expect(parsed.scenes[0].type).toBe("lineup");
  });
});

describe("exportOverlaySvg", () => {
  it("returns a full SVG as-is", () => {
    const full = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';
    expect(exportOverlaySvg(full)).toBe(full);
  });

  it("wraps a bare fragment in an SVG container", () => {
    const result = exportOverlaySvg("<circle cx='50' cy='50' r='10'/>");
    expect(result).toContain("<svg xmlns=");
    expect(result).toContain("<circle");
  });
});

describe("exportOverlayPng", () => {
  it("returns a placeholder with instructions", () => {
    const result = exportOverlayPng("<svg></svg>", 1920, 1080);
    expect(result.status).toBe("placeholder");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.instructions).toContain("rasteriser");
  });
});

describe("createBrowserSourceUrl", () => {
  it("returns a data:text/html;base64 URL", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';
    const url = createBrowserSourceUrl(svg);
    expect(url).toMatch(/^data:text\/html;base64,/);
  });

  it("returns the baseUrl when provided", () => {
    const url = createBrowserSourceUrl("<svg></svg>", { baseUrl: "https://example.com/overlay" });
    expect(url).toBe("https://example.com/overlay");
  });
});
