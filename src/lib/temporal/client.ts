/** Node.js server code only. Do not import into Client Components or Edge routes. */
import { Client, Connection } from "@temporalio/client";
import { getTemporalConfig, temporalConnectionOptions, type TemporalConfig } from "./config";

export async function connectTemporalClient(config: TemporalConfig = getTemporalConfig()): Promise<Client> {
  const connection = await Connection.connect({
    ...temporalConnectionOptions(config),
    connectTimeout: "10 seconds",
  });
  return new Client({ connection, namespace: config.namespace });
}

let clientPromise: Promise<Client> | undefined;

/** Reuse the connection in Next.js server handlers. A failed connection can be retried. */
export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connectTemporalClient().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}
