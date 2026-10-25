export type TemporalConfig = {
  mode: "cloud" | "local";
  address: string;
  namespace: string;
  taskQueue: string;
  tls: boolean;
  apiKey?: string;
};

/** Read at runtime, so Next.js builds do not need Cloud credentials. */
export function getTemporalConfig(env: Readonly<Record<string, string | undefined>> = process.env): TemporalConfig {
  const mode = env.TEMPORAL_MODE?.trim() || "cloud";
  if (mode !== "cloud" && mode !== "local") {
    throw new Error("TEMPORAL_MODE must be cloud or local.");
  }

  const address = env.TEMPORAL_ADDRESS?.trim() || (mode === "local" ? "localhost:7233" : "");
  const namespace = env.TEMPORAL_NAMESPACE?.trim() || (mode === "local" ? "default" : "");
  const apiKey = env.TEMPORAL_API_KEY?.trim() || undefined;
  const taskQueue = env.TEMPORAL_TASK_QUEUE?.trim() || "whitesvan";
  if (!address || !namespace || (mode === "cloud" && !apiKey)) {
    throw new Error("Temporal Cloud requires TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE and TEMPORAL_API_KEY. Use TEMPORAL_MODE=local for a development server.");
  }

  const endpoint = /^(?:\[[\da-fA-F:]+\]|[a-zA-Z0-9.-]+):(\d+)$/.exec(address);
  if (!endpoint || Number(endpoint[1]) < 1 || Number(endpoint[1]) > 65535) {
    throw new Error("TEMPORAL_ADDRESS must be hostname:port, without https:// or a path.");
  }
  if (mode === "local" && (apiKey || address.toLowerCase().includes("tmprl.cloud"))) {
    throw new Error("Use TEMPORAL_MODE=cloud for API-key authentication and Temporal Cloud endpoints; TLS is required.");
  }

  return { mode, address, namespace, taskQueue, tls: mode === "cloud", apiKey };
}

/** Shared by the Node client and native worker; never log this object. */
export function temporalConnectionOptions(config: TemporalConfig) {
  return {
    address: config.address,
    tls: config.tls,
    apiKey: config.apiKey,
    metadata: { "temporal-namespace": config.namespace },
  };
}
