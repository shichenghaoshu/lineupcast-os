import { NextRequest, NextResponse } from "next/server";
import {
  renderLineupScene16x9,
  renderShortVideo9x16,
  renderLowerThird,
  renderPredictionStrip,
} from "@lineupcast/overlay-renderer";

const renderers: Record<string, (data: unknown) => string> = {
  lineup: (data) => renderLineupScene16x9(data as Parameters<typeof renderLineupScene16x9>[0]),
  shortvideo: (data) => renderShortVideo9x16(data as Parameters<typeof renderShortVideo9x16>[0]),
  lowerthird: (data) => renderLowerThird(data as Parameters<typeof renderLowerThird>[0]),
  prediction: (data) => renderPredictionStrip(data as Parameters<typeof renderPredictionStrip>[0]),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ match_id: string }> }
) {
  const { match_id } = await params;
  const scene = request.nextUrl.searchParams.get("scene") || "lineup";

  const renderer = renderers[scene];
  if (!renderer) {
    return NextResponse.json(
      { error: `Unknown scene: ${scene}. Valid: ${Object.keys(renderers).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Use empty data for now - in production this would fetch match data
    const svg = renderer({ matchId: match_id });

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to render overlay" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
