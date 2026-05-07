import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@lineupcast/schema", "@lineupcast/overlay-renderer"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
