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
 */
export function createBrowserSourceUrl(
  svg: string,
  opts?: { width?: number; height?: number; baseUrl?: string },
): string {
  const w = opts?.width ?? 1920;
  const h = opts?.height ?? 1080;

  const html = `<!DOCTYPE html>
<html><head><style>body{margin:0;overflow:hidden;background:transparent}</style></head>
<body>${svg.replace(/<svg/, `<svg style="width:${w}px;height:${h}px"`)}</body></html>`;

  // If a base URL is provided, assume the SVG will be hosted there
  if (opts?.baseUrl) {
    return opts.baseUrl;
  }

  const encoded = Buffer.from(html).toString("base64");
  return `data:text/html;base64,${encoded}`;
}
