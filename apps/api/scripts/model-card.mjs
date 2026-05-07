#!/usr/bin/env node

/**
 * Bridge script: reads model card parameters from stdin,
 * calls @lineupcast/prediction's generateModelCard,
 * outputs JSON+Markdown to stdout.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    const input = JSON.parse(readFileSync("/dev/stdin", "utf8"));

    // Import the compiled prediction package
    const predPath = resolve(__dirname, "../../../packages/prediction/dist/index.js");
    const { generateModelCard } = await import(predPath);

    const result = generateModelCard(input);
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stderr.write(`Model card bridge error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
