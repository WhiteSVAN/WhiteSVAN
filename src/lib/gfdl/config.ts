/**
 * Global Datafeeds (GFDL) is the price feed while GFDL_API_KEY is set: charts, quotes, the option
 * chain and the trading platform read it instead of the firm's Kite login, which stays parked
 * (unset the key to go back to Kite). GFDL_WS_URL overrides the trial's WebSocket endpoint. Server
 * only: the key never reaches a browser.
 */
export interface GfdlConfig {
  apiKey: string;
  url: string;
}

/** The endpoint GFDL's trial keys connect to. */
export const GFDL_TRIAL_URL = "wss://test.lisuns.com:4576/";

type Env = Partial<Record<string, string>>;

export function gfdlConfig(env: Env = process.env): GfdlConfig | null {
  const apiKey = env.GFDL_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, url: env.GFDL_WS_URL?.trim() || GFDL_TRIAL_URL };
}
