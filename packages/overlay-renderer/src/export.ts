// @lineupcast/overlay-renderer — export helpers (JSON, SVG, PNG placeholder, Browser Source URL)

import type { OverlayExportPayload } from "./types.js";

// ─── JSON Export ───────────────────────────────────────────────────

/** Export overlay scenes as a JSON payload. */
export function exportOverlayJson(payload: OverlayExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

// ─── SVG Export ────────────────────────────────────────────────────

/** Export a single SVG string wrapped in a minimal valid SVG document if needed. */
export function exportOverlaySvg(svg: string): string {
  // If already a complete SVG, return as-is
  if (svg.trim().startsWith("<svg")) return svg;
  // Wrap bare fragment
  return `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

// ─── PNG Export (placeholder) ──────────────────────────────────────

/**
 * PNG export placeholder.
 *
 * In a browser environment use `canvg` or `sharp` to rasterise the SVG.
 * This returns rendering instructions for downstream consumers.
 */
export function exportOverlayPng(svg: string, width: number, height: number): {
  status: "placeholder";
  instructions: string;
  svg: string;
  width: number;
  height: number;
} {
  return {
    status: "placeholder",
    instructions:
      "To render PNG: pass this svg to a rasteriser (e.g. sharp, canvg, or resvg). " +
      "In Node use sharp(Buffer.from(svg)).resize(width, height).png().toBuffer(). " +
      "In browser create an Image from a data: URL and draw to canvas.",
    svg,
    width,
    height,
  };
}

// ─── Browser Source URL ────────────────────────────────────────────

/**
 * Create an OBS Browser Source URL that renders the given SVG inline.
 *
 * The SVG is base64-encoded into a `data:text/html` URL so OBS can load
 * it without a running server.  For large scenes prefer hosting the SVG
 * and passing its URL instead.
 *
 * When `baseUrl` is provided, the returned URL points to that absolute URL
 * with the SVG content and dimensions encoded as query parameters.  When a
 * `secret` is included it is appended as a query parameter so a hosting
 * server can validate the request.
 */
export function createBrowserSourceUrl(
  svg: string,
  opts?: { width?: number; height?: number; baseUrl?: string; secret?: string },
): string {
  const w = opts?.width ?? 1920;
  const h = opts?.height ?? 1080;

  const html = `<!DOCTYPE html>
<html><head><style>body{margin:0;overflow:hidden;background:transparent}</style></head>
<body>${svg.replace(/<svg/, `<svg style="width:${w}px;height:${h}px"`)}</body></html>`;

  // If a base URL is provided, construct an absolute URL with query params
  if (opts?.baseUrl) {
    const url = new URL(opts.baseUrl);
    url.searchParams.set("w", String(w));
    url.searchParams.set("h", String(h));
    if (opts.secret) {
      url.searchParams.set("secret", opts.secret);
    }
    return url.toString();
  }

  const encoded = Buffer.from(html).toString("base64");
  return `data:text/html;base64,${encoded}`;
}

// ─── Standalone HTML Export ─────────────────────────────────────

export interface OverlayHtmlExportOptions {
  /** Page title shown in the browser tab. */
  title?: string;
  /** Page width in pixels (default 1920). */
  width?: number;
  /** Page height in pixels (default 1080). */
  height?: number;
  /** Background colour (default transparent). */
  background?: string;
  /** Include the LineupCast disclaimer in the page footer. */
  showDisclaimer?: boolean;
  /** Data source attribution text. */
  dataSource?: string;
  /** Auto-refresh interval in seconds (0 = disabled). */
  autoRefreshSeconds?: number;
}

/**
 * Export one or more overlay SVGs as a self-contained HTML page.
 *
 * The returned string is a complete HTML document suitable for saving to
 * disk, serving from a static host, or loading into an OBS Browser Source.
 */
export function exportOverlayHtml(
  svgs: string[],
  opts?: OverlayHtmlExportOptions,
): string {
  const title = opts?.title ?? "LineupCast Overlay";
  const w = opts?.width ?? 1920;
  const h = opts?.height ?? 1080;
  const bg = opts?.background ?? "transparent";
  const disclaimer = opts?.showDisclaimer !== false
    ? "For commentary assistance, not betting advice."
    : "";
  const source = opts?.dataSource ?? "LineupCast";
  const refresh = opts?.autoRefreshSeconds ?? 0;

  const sceneMarkup = svgs
    .map(
      (svg, i) =>
        `<div class="overlay-scene" id="scene-${i}"${i > 0 ? ' style="display:none"' : ""}>
      ${svg.replace(/<svg/, `<svg style="width:${w}px;height:${h}px"`)}
    </div>`,
    )
    .join("\n    ");

  const refreshMeta =
    refresh > 0
      ? `<meta http-equiv="refresh" content="${refresh}">`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=${w}, height=${h}"/>
  ${refreshMeta}
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${bg}; overflow: hidden; width: ${w}px; height: ${h}px; }
    .overlay-scene { width: ${w}px; height: ${h}px; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; padding: 4px; font: 11px system-ui, sans-serif; color: #555; }
  </style>
</head>
<body>
  ${sceneMarkup}
  ${disclaimer ? `<div class="footer">${escapeHtml(disclaimer)} | Data: ${escapeHtml(source)}</div>` : ""}
</body>
</html>`;
}

/** Minimal HTML escaping for safe interpolation. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
