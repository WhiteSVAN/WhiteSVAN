import type { ChargesSchedule } from "./charges";

/**
 * Dated F&O charge schedules for the simulator. Add a new row when a rate changes; never edit a
 * row that fills have used, or old evaluations stop replaying exactly. These rows seed the
 * ChargesSchedule table once the contract-master service exists (story S1-10).
 *
 * Rates are integers over RATE_SCALE (1e8): 0.05% = 50_000.
 */
export const CHARGES_SCHEDULES: readonly ChargesSchedule[] = [
  {
    id: "in-fo-2026-04",
    effectiveFrom: "2026-04-01",
    source: "Zerodha equity F&O rate card (zerodha.com/charges), read 16 Oct 2026; STT as revised from 1 Apr 2026",
    // Not yet matched against a real contract note (story S3-01 acceptance). Until it is,
    // simulated costs are close to, but not guaranteed to equal, a broker's contract note.
    verified: false,
    futures: {
      brokerage: { kind: "lower-of", rate: 30_000, perOrderCap: 2_000 }, // 0.03% or ₹20 an order
      sttSell: 50_000, // 0.05% of sell value
      stampBuy: 2_000, // 0.002% of buy value
      transaction: { NFO: 1_830, BFO: 0 }, // NSE 0.00183%; BSE 0
    },
    options: {
      brokerage: { kind: "flat", perOrder: 2_000 }, // ₹20 an order
      sttSell: 150_000, // 0.15% of sell premium
      stampBuy: 3_000, // 0.003% of buy premium
      transaction: { NFO: 35_530, BFO: 32_500 }, // NSE 0.03553%, BSE 0.0325% of premium
    },
    sebi: 100, // ₹10 per crore
    gst: 18_000_000, // 18%
  },
];
