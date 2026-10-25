import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { bundleWorkflowCode } from "@temporalio/worker";

async function build() {
  const bundle = await bundleWorkflowCode({ workflowsPath: require.resolve("../../src/lib/temporal/workflows") });
  const output = resolve("build/temporal/src/lib/temporal/workflow-bundle.cjs");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bundle.code);
  console.info("Temporal workflow bundle built:", output);
}

build().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
