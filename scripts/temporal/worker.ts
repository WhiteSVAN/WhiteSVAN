import "./env";
import { runTemporalWorker } from "../../src/lib/temporal/worker";

runTemporalWorker().catch((error: unknown) => {
  console.error("Temporal worker failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
