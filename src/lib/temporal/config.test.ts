import { describe, expect, it } from "vitest";
import { getTemporalConfig, temporalConnectionOptions } from "./config";

const cloud = {
  TEMPORAL_ADDRESS: "quickstart-svan.fdx0h.tmprl.cloud:7233",
  TEMPORAL_NAMESPACE: "quickstart-svan.fdx0h",
  TEMPORAL_API_KEY: "test-secret",
};

describe("Temporal configuration", () => {
  it("requires explicit Cloud credentials rather than falling back to localhost", () => {
    expect(() => getTemporalConfig({})).toThrow("Temporal Cloud requires");
    for (const field of Object.keys(cloud)) {
      expect(() => getTemporalConfig({ ...cloud, [field]: " " })).toThrow("Temporal Cloud requires");
    }
  });

  it("always uses TLS and namespace routing with Cloud API keys", () => {
    const config = getTemporalConfig(cloud);
    expect(config.taskQueue).toBe("whitesvan");
    expect(temporalConnectionOptions(config)).toEqual({
      address: cloud.TEMPORAL_ADDRESS,
      tls: true,
      apiKey: cloud.TEMPORAL_API_KEY,
      metadata: { "temporal-namespace": cloud.TEMPORAL_NAMESPACE },
    });
  });

  it("allows an explicit local development server without credentials", () => {
    expect(getTemporalConfig({ TEMPORAL_MODE: "local" })).toEqual({
      mode: "local", address: "localhost:7233", namespace: "default", taskQueue: "whitesvan", tls: false, apiKey: undefined,
    });
  });

  it("rejects Cloud credentials or Cloud endpoints in plaintext local mode", () => {
    expect(() => getTemporalConfig({ TEMPORAL_MODE: "local", TEMPORAL_API_KEY: "secret" })).toThrow("TLS is required");
    expect(() => getTemporalConfig({ TEMPORAL_MODE: "local", TEMPORAL_ADDRESS: cloud.TEMPORAL_ADDRESS })).toThrow("TLS is required");
  });

  it.each(["https://example.com:7233", "example.com:7233/path", "example.com:0", "example.com:65536", "example.com"])("rejects invalid endpoint %s", (address) => {
    expect(() => getTemporalConfig({ ...cloud, TEMPORAL_ADDRESS: address })).toThrow("hostname:port");
  });

  it("rejects misspelled modes and trims pasted values", () => {
    expect(() => getTemporalConfig({ ...cloud, TEMPORAL_MODE: "clod" })).toThrow("TEMPORAL_MODE");
    expect(getTemporalConfig({ ...cloud, TEMPORAL_NAMESPACE: " quickstart-svan.fdx0h ", TEMPORAL_TASK_QUEUE: " whitesvan-staging " }).taskQueue).toBe("whitesvan-staging");
  });
});
