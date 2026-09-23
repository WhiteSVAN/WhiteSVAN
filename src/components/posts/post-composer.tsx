"use client";

/**
 * Structured post composer. The type picker drives which structured fields
 * render (from POST_TYPE_DEFS); the server action re-validates everything,
 * runs the signal/compliance filter, and matches trade reviews against the
 * author's imported executions.
 */
import { useId, useState, useTransition } from "react";
import { btnPrimary, FieldError, FormError, inputClass, labelClass } from "@/components/form";
import {
  FIELD_PREFIX,
  POST_LIMITS,
  POST_TYPE_DEFS,
  POST_TYPES,
  type PostField,
  type PostTypeKey,
} from "@/lib/posts";
import { createPost, type ComposerResult } from "@/app/(app)/feed/actions";

function FieldInput({ field, id, error }: { field: PostField; id: string; error?: string }) {
  const name = `${FIELD_PREFIX}${field.key}`;
  const label = (
    <label htmlFor={id} className={labelClass}>
      {field.label}
      {!field.required && <span className="ml-1 normal-case tracking-normal text-zinc-500">(optional)</span>}
    </label>
  );
  const common = {
    id,
    name,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    className: inputClass,
  } as const;
  return (
    <div>
      {label}
      {field.kind === "select" ? (
        <select {...common} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {field.options?.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "textarea" ? (
        <textarea {...common} rows={3} maxLength={2000} placeholder={field.placeholder} />
      ) : field.kind === "date" ? (
        <input {...common} type="date" />
      ) : (
        <input {...common} type="text" maxLength={2000} placeholder={field.placeholder} />
      )}
      <FieldError messages={error ? [error] : undefined} />
    </div>
  );
}

export function PostComposer({
  communityId,
  heading = "Share research",
  intro,
  types = POST_TYPES,
}: {
  communityId?: string;
  heading?: string;
  intro?: string;
  /** Post types to offer (e.g. no performance updates for accounts without a record). */
  types?: readonly PostTypeKey[];
}) {
  const uid = useId();
  const [type, setType] = useState<PostTypeKey>(types[0] ?? "MARKET_VIEW");
  const [result, setResult] = useState<ComposerResult | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();
  const def = POST_TYPE_DEFS[type];
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const r = await createPost(data);
      setResult(r);
      if (r.ok) {
        // Remount the uncontrolled inputs so the next post starts blank.
        setFormKey((k) => k + 1);
      }
    });
  }

  return (
    <section className="terminal-card p-5 sm:p-6" aria-labelledby={`${uid}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${uid}-heading`} className="text-base font-medium text-zinc-800">
          {heading}
        </h2>
        <span className="terminal-label">Research, not signals</span>
      </div>
      {intro && <p className="mt-1 text-sm text-zinc-500">{intro}</p>}

      <form key={formKey} onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        {communityId && <input type="hidden" name="communityId" value={communityId} />}
        <input type="hidden" name="type" value={type} />

        <fieldset>
          <legend className={labelClass}>Post type</legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
            {types.map((key) => (
              <label
                key={key}
                className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 transition has-[:checked]:border-[#baf277] has-[:checked]:text-[#dff5c4] has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-[#baf277]"
              >
                <input
                  type="radio"
                  name={`${uid}-type`}
                  value={key}
                  checked={type === key}
                  onChange={() => {
                    setType(key);
                    setResult(null);
                  }}
                  className="sr-only"
                />
                {POST_TYPE_DEFS[key].label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">{def.blurb}</p>
        </fieldset>

        <div>
          <label htmlFor={`${uid}-title`} className={labelClass}>
            Title
          </label>
          <input
            id={`${uid}-title`}
            name="title"
            type="text"
            required
            maxLength={POST_LIMITS.title}
            aria-invalid={errors.title ? true : undefined}
            className={inputClass}
          />
          <FieldError messages={errors.title ? [errors.title] : undefined} />
        </div>

        <div>
          <label htmlFor={`${uid}-symbols`} className={labelClass}>
            Symbols
            <span className="ml-1 normal-case tracking-normal text-zinc-500">
              {def.needsSymbol ? "(required, up to 5)" : "(optional, up to 5)"}
            </span>
          </label>
          <input
            id={`${uid}-symbols`}
            name="symbols"
            type="text"
            placeholder="e.g. SPY, NIFTY, ES"
            autoCapitalize="characters"
            aria-invalid={errors.symbols ? true : undefined}
            className={inputClass}
          />
          <FieldError messages={errors.symbols ? [errors.symbols] : undefined} />
        </div>

        {def.fields.length > 0 && (
          <div key={type} className="grid gap-4 sm:grid-cols-2">
            {def.fields.map((field) => (
              <div key={field.key} className={field.kind === "textarea" ? "sm:col-span-2" : undefined}>
                <FieldInput field={field} id={`${uid}-${field.key}`} error={errors[`${FIELD_PREFIX}${field.key}`]} />
              </div>
            ))}
          </div>
        )}

        {type === "PERFORMANCE_UPDATE" && (
          <p className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            Your latest published record version is attached automatically. Numbers come from the record, not the post.
          </p>
        )}
        {type === "TRADE_REVIEW" && (
          <p className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            The review is checked against your imported executions for that date. A verified-position badge appears only
            on a genuine match.
          </p>
        )}

        <div>
          <label htmlFor={`${uid}-body`} className={labelClass}>
            Post
          </label>
          <textarea
            id={`${uid}-body`}
            name="body"
            required
            rows={6}
            maxLength={POST_LIMITS.body}
            aria-invalid={errors.body ? true : undefined}
            className={inputClass}
          />
          <FieldError messages={errors.body ? [errors.body] : undefined} />
        </div>

        {result && !result.ok && <FormError message={result.error} />}
        {result?.ok && (
          <p className="rounded-md border border-[#57733a] bg-[#1a2418] px-3 py-2 text-sm text-[#dff5c4]" role="status">
            Posted.{result.notice ? ` ${result.notice}` : ""}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-zinc-500">
            No entries, targets, or calls to action. Research discussion — not investment advice.
          </p>
          <button type="submit" disabled={pending} className={`${btnPrimary} sm:w-auto`}>
            {pending ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </section>
  );
}
