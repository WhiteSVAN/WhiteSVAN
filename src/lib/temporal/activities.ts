import type { TemporalSmokeResult } from "./contracts";

/** Proves that an Activity ran on the worker, without touching business data. */
export async function checkWorker(): Promise<TemporalSmokeResult> {
  return { service: "whitesvan", status: "ok", checkedAt: new Date().toISOString() };
}
