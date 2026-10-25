import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connect, makeClient } = vi.hoisted(() => ({ connect: vi.fn(), makeClient: vi.fn() }));
vi.mock("@temporalio/client", () => ({
  Connection: { connect },
  Client: class { constructor(options: unknown) { makeClient(options); } },
}));

describe("Temporal client connection", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("TEMPORAL_MODE", "local");
    vi.stubEnv("TEMPORAL_ADDRESS", "localhost:7233");
    vi.stubEnv("TEMPORAL_NAMESPACE", "default");
    vi.stubEnv("TEMPORAL_API_KEY", "");
  });

  it("shares one connection between concurrent server requests", async () => {
    const connection = {};
    connect.mockResolvedValue(connection);
    const { getTemporalClient } = await import("./client");
    const [first, second] = await Promise.all([getTemporalClient(), getTemporalClient()]);
    expect(first).toBe(second);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(makeClient).toHaveBeenCalledWith({ connection, namespace: "default" });
  });

  it("can reconnect after an initial connection failure", async () => {
    connect.mockRejectedValueOnce(new Error("temporarily unavailable")).mockResolvedValueOnce({});
    const { getTemporalClient } = await import("./client");
    await expect(getTemporalClient()).rejects.toThrow("temporarily unavailable");
    await expect(getTemporalClient()).resolves.toBeDefined();
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
