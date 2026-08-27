#!/usr/bin/env node

import { LettaAgentClient } from "@letta-ai/letta-agent-sdk";
import { formatHuman, parseArgs, runProbe, usage } from "./lib.mjs";

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  if (!process.env.LETTA_API_KEY) {
    throw new Error("LETTA_API_KEY is required for this Cloud probe");
  }

  const client = new LettaAgentClient({ backend: "cloud" });
  const report = await runProbe({
    client,
    targetId: options.conversation ?? options.agent,
    message: options.message,
  });

  console.log(options.json ? JSON.stringify(report, null, 2) : formatHuman(report));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("\n" + usage());
  process.exit(1);
}
