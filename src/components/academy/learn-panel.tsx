"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2 } from "lucide-react";
import { ACADEMY_LESSONS } from "@/lib/academy-content";

interface LessonAnswer {
  choice: number;
  checked: boolean;
}

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--ink)] px-4 py-2 text-xs font-medium text-[var(--ink-foreground)] hover:bg-[var(--ink-hover)] disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40";

/** Public sample walkthrough. Answers exist only while this component stays mounted. */
export function LearnPanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LessonAnswer | undefined>>({});
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  const lesson = ACADEMY_LESSONS[activeIndex];
  const answer = answers[lesson.id];
  const isCorrect = answer?.checked && answer.choice === lesson.selfCheck.correctChoice;
  const correctCount = ACADEMY_LESSONS.filter((item) => {
    const response = answers[item.id];
    return response?.checked && response.choice === item.selfCheck.correctChoice;
  }).length;

  function selectLesson(index: number) {
    if (index < 0 || index >= ACADEMY_LESSONS.length) return;
    setActiveIndex(index);
    requestAnimationFrame(() => lessonHeading.current?.focus());
  }

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer) return;
    setAnswers((previous) => ({ ...previous, [lesson.id]: { ...answer, checked: true } }));
  }

  return (
    <section aria-labelledby="sample-lessons-title" className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="terminal-label">Free lessons</p>
          <h2 id="sample-lessons-title" className="mt-3 text-2xl font-medium tracking-[-0.035em] text-[var(--foreground)] sm:text-3xl">
            Learn what the evaluation tests.
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Three free lessons: contracts, costs and how the evaluation works. Each ends with an
            exercise and a quick self-check.
          </p>
        </div>
        <div className="rounded-md border border-[var(--border)] bg-[var(--card-deep)] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">Practice progress for this visit</p>
          <p className="mt-1 text-sm text-[var(--foreground)]" role="status">
            <span className="font-mono text-[var(--primary)]">{correctCount} / {ACADEMY_LESSONS.length}</span> self-checks correct
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Sample lesson selection" className="self-start rounded-lg border border-[var(--border)] bg-[var(--card-deep)] p-3">
          <p className="terminal-label px-3 pb-3 pt-2">Your learning sequence</p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {ACADEMY_LESSONS.map((item, index) => {
              const response = answers[item.id];
              const completed = response?.checked && response.choice === item.selfCheck.correctChoice;
              const active = index === activeIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectLesson(index)}
                    aria-current={active ? "step" : undefined}
                    className={`flex min-h-20 w-full items-start gap-3 rounded-md border p-3 text-left transition ${active ? "border-[var(--primary)] bg-[var(--card-raised)]" : "border-transparent hover:border-[var(--border-strong)] hover:bg-[var(--card)]"}`}
                  >
                    <span className={`mt-0.5 font-mono text-[10px] ${active ? "text-[var(--primary)]" : "text-[var(--muted)]"}`} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 text-xs leading-5 text-[var(--foreground)]">
                      {item.title}
                      {completed && <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--primary)]"><Check className="h-3 w-3" aria-hidden="true" /> Self-check correct</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="px-3 pb-2 pt-4 text-[11px] leading-5 text-[var(--muted)]">
            Practice answers stay in this view and reset when it is closed or reloaded. No account
            progress or credential is recorded.
          </p>
        </nav>

        <article className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-5 py-5 sm:px-7">
            <p className="terminal-label flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Lesson {activeIndex + 1} / {ACADEMY_LESSONS.length}</p>
            <h3 ref={lessonHeading} tabIndex={-1} className="mt-3 text-xl font-medium tracking-[-0.025em] text-[var(--foreground)] sm:text-2xl">
              {lesson.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{lesson.summary}</p>
          </div>

          <div className="space-y-6 px-5 py-6 sm:px-7">
            <div className="space-y-4 text-sm leading-7 text-[var(--muted)]">
              {lesson.reading.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <ul className="space-y-3">
              {lesson.checklist.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--foreground)]">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-md border border-[var(--border-strong)] bg-[var(--card-deep)] p-4 sm:p-5">
              <h4 className="terminal-label">Try it</h4>
              <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{lesson.reviewPrompt}</p>
            </div>

            <form key={lesson.id} onSubmit={checkAnswer} className="border-t border-[var(--border)] pt-6">
              <fieldset>
                <legend className="text-sm font-medium leading-6 text-[var(--foreground)]"><span className="terminal-label mb-2 block">Self-check</span>{lesson.selfCheck.question}</legend>
                <div className="mt-4 space-y-2">
                  {lesson.selfCheck.choices.map((choice, index) => (
                    <label key={choice} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-xs leading-6 ${answer?.choice === index ? "border-[var(--primary)] bg-[var(--card-raised)] text-[var(--foreground)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]"}`}>
                      <input
                        type="radio"
                        name={`self-check-${lesson.id}`}
                        value={index}
                        checked={answer?.choice === index}
                        onChange={() => setAnswers((previous) => ({ ...previous, [lesson.id]: { choice: index, checked: false } }))}
                        className="mt-1.5 h-3.5 w-3.5 shrink-0"
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" disabled={!answer || answer.checked} className={`${primaryButton} mt-4`}>
                {answer?.checked ? "Answer reviewed" : "Check answer"}<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <div aria-live="polite" aria-atomic="true">
                {answer?.checked && (
                  <div className={`mt-4 rounded-md border p-4 ${isCorrect ? "border-[var(--primary)] bg-[var(--card-raised)]" : "border-[var(--border-strong)] bg-[var(--card-deep)]"}`}>
                    <p className={`text-xs font-medium ${isCorrect ? "text-[var(--primary)]" : "text-[var(--warning)]"}`}>{isCorrect ? "Correct. Here is why." : "Review the distinction and try again."}</p>
                    <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{lesson.selfCheck.rationale}</p>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 sm:px-7">
            <button type="button" disabled={activeIndex === 0} onClick={() => selectLesson(activeIndex - 1)} className={secondaryButton}><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous lesson</button>
            {activeIndex < ACADEMY_LESSONS.length - 1 ? (
              <button type="button" onClick={() => selectLesson(activeIndex + 1)} className={secondaryButton}>Next lesson <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
            ) : (
              <button type="button" onClick={() => selectLesson(0)} className={secondaryButton}>Return to first lesson <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
