import { existsSync } from "node:fs";
import { join } from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { getTemporalConfig, temporalConnectionOptions, type TemporalConfig } from "./config";

export function createTemporalWorker(connection: NativeConnection, config: TemporalConfig): Promise<Worker> {
  const codePath = join(__dirname, "workflow-bundle.cjs");
  const bundled = existsSync(codePath);
  if (process.env.NODE_ENV === "production" && !bundled) {
    throw new Error("Workflow bundle is missing. Run npm run temporal:build before starting the production worker.");
  }
  return Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
    ...(bundled ? { workflowBundle: { codePath } } : { workflowsPath: require.resolve("./workflows") }),
    activities,
    shutdownGraceTime: "30 seconds",
  });
}

export async function runTemporalWorker(): Promise<void> {
  const config = getTemporalConfig();
  const connection = await NativeConnection.connect(temporalConnectionOptions(config));
  try {
    const worker = await createTemporalWorker(connection, config);
    console.info("WhiteSVAN Temporal worker starting", { namespace: config.namespace, taskQueue: config.taskQueue });
    // The SDK handles SIGINT/SIGTERM and drains in-flight work before returning.
    await worker.run();
  } finally {
    await connection.close();
  }
}
