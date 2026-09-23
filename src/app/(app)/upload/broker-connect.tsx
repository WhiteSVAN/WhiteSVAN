"use client";

import { useEffect, useId, useState } from "react";
import {
  BROKER_CONNECTIONS,
  MECHANISM_GROUPS,
  MECHANISM_TAG,
  SUPPORT_EMAIL,
  actionLabelFor,
  guaranteesFor,
  ibEmailHref,
  introFor,
  mechanismEyebrow,
  stepsFor,
  type BrokerConnection,
} from "./broker-connections";

/**
 * Direct read-only broker connections. A grid of brokers (grouped by mechanism)
 * each opens a "Linking {broker}" modal. The flow content is generated from the
 * broker's mechanism (see broker-connections.ts); IBKR's Flex flow is the only
 * one with bespoke UI (the "Generate email to IB" step + token preview).
 *
 * No integration is wired yet — this is the UX shell. The only live action is the
 * IBKR email draft (mailto:); every other "Connect" button reveals a rolling-out
 * note and points users at the statement loader below.
 */
export function BrokerConnect() {
  const [selected, setSelected] = useState<BrokerConnection | null>(null);

  return (
    <div className="space-y-5">
      {MECHANISM_GROUPS.map((group) => {
        const brokers = BROKER_CONNECTIONS.filter((b) => b.mechanism === group.mechanism);
        if (brokers.length === 0) return null;
        return (
          <div key={group.mechanism}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium text-zinc-900">{group.title}</h3>
              <span className="text-xs text-zinc-500">{group.subtitle}</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {brokers.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b)}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-zinc-500"
                >
                  <span className="font-medium text-zinc-800">{b.name}</span>
                  <span className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                    {MECHANISM_TAG[b.mechanism]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {selected && <BrokerLinkDialog broker={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BrokerLinkDialog({
  broker,
  onClose,
}: {
  broker: BrokerConnection;
  onClose: () => void;
}) {
  const titleId = useId();
  const [emailDrafted, setEmailDrafted] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);

  // Close on Escape, and lock background scroll while the dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const steps = stepsFor(broker);
  const guarantees = guaranteesFor(broker);
  const isFlex = broker.mechanism === "flex";
  const isUpload = broker.mechanism === "upload";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {mechanismEyebrow(broker.mechanism)}
            </p>
            <h2 id={titleId} className="mt-1 text-xl font-semibold text-zinc-900">
              Linking {broker.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm leading-6 text-zinc-600">
          <p>{introFor(broker)}</p>

          {/* IBKR Flex — bespoke "Generate email to IB" step + token preview */}
          {isFlex && (
            <>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Step 1</p>
                <p className="mt-1 text-sm text-zinc-700">
                  Email Interactive Brokers to enable read-only reporting and backfill your history
                  since inception.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a
                    href={ibEmailHref()}
                    onClick={() => setEmailDrafted(true)}
                    className="rounded-lg border border-zinc-300 bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-zinc-100"
                  >
                    Generate email to IB
                  </a>
                  {emailDrafted && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <CheckIcon className="h-4 w-4" />
                      Email drafted in your mail app
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Step 2 — coming soon
                </p>
                <p className="mt-1 text-sm text-zinc-700">
                  Once IB confirms, you&apos;ll paste a Flex Token and Query ID (from IBKR&apos;s
                  Performance &amp; Reports → Flex Queries) to finish linking. The token is read-only,
                  capped at a 1-year expiry, and revocable in IBKR anytime.
                </p>
              </div>
            </>
          )}

          {/* Generated step list for every other mechanism */}
          {steps.length > 0 && (
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[11px] font-medium text-zinc-400">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}

          {/* Primary action (stubbed) for non-flex mechanisms */}
          {!isFlex && (
            <div>
              <button
                type="button"
                onClick={() => (isUpload ? onClose() : setComingSoon(true))}
                className="rounded-lg border border-zinc-300 bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-zinc-100"
              >
                {actionLabelFor(broker)}
              </button>
              {comingSoon && (
                <p className="mt-2 text-xs text-zinc-500">
                  Direct {broker.name} connection is rolling out. For now, load a statement below —
                  it&apos;s verified from the same source data.
                </p>
              )}
            </div>
          )}

          {broker.note && <p className="text-xs text-zinc-500">{broker.note}</p>}

          {/* The load-bearing read-only guarantees (one "NEVER" per line) */}
          <ul className="space-y-2.5 border-t border-zinc-200 pt-4">
            {guarantees.map((g) => {
              const [before, ...rest] = g.split("NEVER");
              return (
                <li key={g} className="flex items-start gap-2.5">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <span className="text-sm text-zinc-700">
                    {before}
                    <span className="font-semibold text-rose-400">NEVER</span>
                    {rest.join("NEVER")}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-zinc-500">
            TrustSVAN reports on past performance only — verified history does not guarantee future
            results. Questions or issues? Reach out at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-zinc-300 underline hover:text-zinc-100">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-zinc-100"
          >
            Ok, I understand!
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
