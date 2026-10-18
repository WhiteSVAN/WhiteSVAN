/** Badge text and colours for an evaluation account's status (server and client pages share it). */
export const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  ACTIVE: { text: "Active", className: "border-[var(--primary)]/40 text-[var(--primary)]" },
  PASSED: { text: "Passed", className: "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" },
  FAILED: { text: "Failed", className: "border-[var(--danger)]/50 text-[var(--danger)]" },
};
