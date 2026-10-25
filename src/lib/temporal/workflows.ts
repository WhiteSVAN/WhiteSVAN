import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { TemporalSmokeResult } from "./contracts";

const { checkWorker } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export async function whitesvanSmoke(): Promise<TemporalSmokeResult> {
  return checkWorker();
}
