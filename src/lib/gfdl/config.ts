/**
 * Global Datafeeds (GFDL) is the price feed: charts, quotes, the option chain and the trading
 * platform read it. The firm's Kite login is commented out (src/lib/zerodha/client.ts). GFDL_API_KEY
 * overrides the trial key below and GFDL_WS_URL the trial's endpoint. Server only: the key never
 * reaches a browser.
 */
export interface GfdlConfig {
  apiKey: string;
  url: string;
}

/** The endpoint GFDL's trial keys connect to. */
export const GFDL_TRIAL_URL = "wss://test.lisuns.com:4576/";

/**
 * The founder's trial key: BFO only (SENSEX options), one connection at a time, until 30 Oct 2026
 * 23:59 IST. In the code on the founder's instruction (the repo is public); a paid key belongs in
 * GFDL_API_KEY.
 */
export const GFDL_TRIAL_KEY = "7379c2ca-7df8-44dc-928d-fa16b7eea75b";

type Env = Partial<Record<string, string>>;

export function gfdlConfig(env: Env = process.env): GfdlConfig {
  return { apiKey: env.GFDL_API_KEY?.trim() || GFDL_TRIAL_KEY, url: env.GFDL_WS_URL?.trim() || GFDL_TRIAL_URL };
}
