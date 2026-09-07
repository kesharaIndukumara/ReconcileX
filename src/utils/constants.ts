/**
 * Shared numeric / UI thresholds. Keep magic numbers here so the matching engine and
 * the screens that visualise its output can never drift apart.
 */

/** Two rounded currency amounts closer than this are treated as equal. */
export const NUMERIC_EPSILON = 0.005;

/** Match-rate tiers used for badge colours and celebration. */
export const MATCH_RATE = {
  /** At or above this combined rate the run counts as "great". */
  GREAT: 90,
  /** At or above this it's "okay"; below it needs attention. */
  OK: 50,
} as const;

/** Fire the confetti only for a genuinely great result. */
export const CONFETTI_THRESHOLD = MATCH_RATE.GREAT;
