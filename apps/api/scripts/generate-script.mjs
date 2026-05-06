#!/usr/bin/env node

/**
 * Bridge script for Python -> TypeScript ai-script calls.
 *
 * Reads a ScriptGenerationInput JSON object from stdin,
 * calls generateScript() from @lineupcast/ai-script,
 * and writes the ScriptGenerationOutput JSON to stdout.
 *
 * Errors are reported on stderr as JSON: { "error": "..." }
 */

import { generateScript } from "../../../packages/ai-script/dist/index.js";

// ── Read all of stdin ───────────────────────────────────────────────────

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  try {
    const raw = await readStdin();

    if (!raw.trim()) {
      process.stderr.write(JSON.stringify({ error: "empty stdin" }));
      process.exit(1);
    }

    const input = JSON.parse(raw);
    const output = generateScript(input);
    process.stdout.write(JSON.stringify(output));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(JSON.stringify({ error: message }));
    process.exit(1);
  }
}

main();
