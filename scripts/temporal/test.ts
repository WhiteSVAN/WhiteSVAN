import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { connectTemporalClient } from "../../src/lib/temporal/client";
import { getTemporalConfig } from "../../src/lib/temporal/config";
import type { whitesvanSmoke } from "../../src/lib/temporal/workflows";

/** Exercise the compiled production worker and bundle against an isolated local service. */
async function test() {
  const downloadDir = resolve("artifacts/temporal-test-server");
  await mkdir(downloadDir, { recursive: true });
  const env = await TestWorkflowEnvironment.createLocal({
    server: {
      ip: "127.0.0.1",
      ui: false,
      executable: process.env.TEMPORAL_TEST_SERVER_PATH
        ? { type: "existing-path", path: process.env.TEMPORAL_TEST_SERVER_PATH }
        : { type: "cached-download", downloadDir },
    },
  });
  try {
    // Deliberately ignore Cloud env vars and .env files: this test never uses Cloud.
    const config = getTemporalConfig({ TEMPORAL_MODE: "local", TEMPORAL_ADDRESS: env.address });
    const client = await connectTemporalClient(config);
    try {
      const workerUrl = pathToFileURL(resolve("build/temporal/src/lib/temporal/worker.js")).href;
      const { createTemporalWorker } = await import(workerUrl) as typeof import("../../src/lib/temporal/worker");
      const worker = await createTemporalWorker(env.nativeConnection, config);
      await worker.runUntil(async () => {
        await client.connection.workflowService.describeNamespace({ namespace: config.namespace });
        const result = await client.workflow.execute<typeof whitesvanSmoke>("whitesvanSmoke", {
          workflowId: `whitesvan-test-${randomUUID()}`,
          taskQueue: config.taskQueue,
          workflowRunTimeout: "30 seconds",
        });
        assert.equal(result.service, "whitesvan");
        assert.equal(result.status, "ok");
        assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
        console.info("PASS: compiled worker, workflow bundle, client and Activity completed locally.");
      });
    } finally {
      await client.connection.close();
    }
  } finally {
    await env.teardown();
  }
}

test().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
