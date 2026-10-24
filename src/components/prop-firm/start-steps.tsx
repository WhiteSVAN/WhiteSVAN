import { Check } from "lucide-react";

const STEPS = ["Create account", "Choose size", "Pay"] as const;

/**
 * The three steps from a visitor to a paid evaluation: sign-up is the first and checkout holds the
 * other two. `done` counts the steps already complete.
 */
export function StartSteps({ done }: { done: 0 | 1 }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Three steps to your evaluation">
      {STEPS.map((label, index) => {
        const state = index < done ? "done" : index === done ? "current" : "next";
        return (
          <li key={label} aria-current={state === "current" ? "step" : undefined}>
            <span className={`block h-1 rounded-full ${state === "done" ? "bg-[var(--primary)]" : state === "current" ? "bg-[var(--primary)]/50" : "bg-[var(--border-strong)]"}`} aria-hidden="true" />
            <span className={`mt-2 flex items-center gap-1.5 text-[11px] leading-4 ${state === "next" ? "text-[var(--muted)]" : "text-[var(--foreground)]"}`}>
              {state === "done" ? <Check size={12} className="shrink-0 text-[var(--primary)]" aria-hidden="true" /> : <span className="font-mono text-[var(--primary)]">{index + 1}</span>}
              {label}
              {state === "done" && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
