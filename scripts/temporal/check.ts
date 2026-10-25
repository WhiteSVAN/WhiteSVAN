import "./env";
import { randomUUID } from "node:crypto";
import { connectTemporalClient } from "../../src/lib/temporal/client";
import { getTemporalConfig } from "../../src/lib/temporal/config";
import type { whitesvanSmoke } from "../../src/lib/temporal/workflows";

async function run() {
  const config = getTemporalConfig();
  const client = await connectTemporalClient(config);
  try {
    await client.connection.workflowService.describeNamespace({ namespace: config.namespace });
    console.info("Temporal namespace connection verified", { namespace: config.namespace, taskQueue: config.taskQueue });
    if (process.argv.includes("--smoke")) {
      const workflowId = `whitesvan-smoke-${randomUUID()}`;
      const result = await client.workflow.execute<typeof whitesvanSmoke>("whitesvanSmoke", {
        workflowId,
        taskQueue: config.taskQueue,
        workflowRunTimeout: "1 minute",
      });
      console.info("Temporal workflow and Activity completed", { workflowId, ...result });
    }
  } finally {
    await client.connection.close();
  }
}

run().catch((error: unknown) => {
  console.error("Temporal check failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
