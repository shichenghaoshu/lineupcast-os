import {
  renderLineupScene16x9,
  renderShortVideo9x16,
  renderLowerThird,
  renderPredictionStrip,
} from "@lineupcast/overlay-renderer";

export type SceneType = "lineup" | "shortvideo" | "lowerthird" | "prediction";

const sceneRenderers: Record<SceneType, (data: unknown) => string> = {
  lineup: (data) => renderLineupScene16x9(data as Parameters<typeof renderLineupScene16x9>[0]),
  shortvideo: (data) => renderShortVideo9x16(data as Parameters<typeof renderShortVideo9x16>[0]),
  lowerthird: (data) => renderLowerThird(data as Parameters<typeof renderLowerThird>[0]),
  prediction: (data) => renderPredictionStrip(data as Parameters<typeof renderPredictionStrip>[0]),
};

export function renderSceneToSvg(sceneType: SceneType, data: unknown): string {
  const renderer = sceneRenderers[sceneType];
  if (!renderer) throw new Error(`Unknown scene type: ${sceneType}`);
  return renderer(data);
}

export async function renderSceneToPng(
  svgString: string,
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Failed to get canvas context"));

    const img = new Image();
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG to image"));
    };
    img.src = url;
  });
}

export function downloadFile(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadSvg(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename);
  URL.revokeObjectURL(url);
}

export async function downloadPng(
  svgString: string,
  filename: string,
  width: number,
  height: number
): Promise<void> {
  const dataUrl = await renderSceneToPng(svgString, width, height);
  downloadFile(dataUrl, filename);
}

export async function copySvgToClipboard(svgString: string): Promise<void> {
  await navigator.clipboard.writeText(svgString);
}

export function getOBSUrl(matchId: string, scene: SceneType): string {
  return `/api/overlay/${matchId}?scene=${scene}`;
}
