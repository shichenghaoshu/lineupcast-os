// @lineupcast/model-cards — model card metadata and rendering utilities

export interface ModelCardMeta {
  name: string;
  version: string;
  type: string;
  owner: string;
  license: string;
  intendedUse: string;
  limitations: string[];
  ethicalConsiderations: string[];
}

/** Placeholder — model card rendering will be implemented by the prediction team. */
export function getModelCard(): ModelCardMeta {
  return {
    name: "Dixon-Coles Time-Weighted Poisson",
    version: "0.1.0",
    type: "Time-weighted Poisson score model",
    owner: "LineupCast OS community",
    license: "MIT",
    intendedUse: "Pre-match football outcome probability estimation",
    limitations: [
      "No live in-play adjustment",
      "No injury/suspension awareness",
      "Simplistic set-piece handling",
    ],
    ethicalConsiderations: [
      "No individual player data beyond public match statistics",
      "No personal or sensitive data collected",
      "Model transparency prioritized",
    ],
  };
}
