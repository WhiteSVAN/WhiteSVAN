"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { chooseTheme, currentTheme, DEFAULT_THEME, onThemeChange, savedThemeChoice, THEME_CHOICES, THEME_LABELS, type ThemeChoice } from "@/lib/theme";

const subscribe = (changed: () => void) => onThemeChange(changed);

/**
 * One button between the White and Black themes, for headers. The icon comes from CSS on
 * `data-theme` (`.theme-when-*` in globals.css), so it's right before the page hydrates.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => chooseTheme(currentTheme() === "dark" ? "light" : "dark")}
      aria-label="Switch between the white and black themes"
      title="White or black theme"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] ${className}`}
    >
      <Moon size={16} strokeWidth={1.75} className="theme-when-light" aria-hidden="true" />
      <Sun size={16} strokeWidth={1.75} className="theme-when-dark" aria-hidden="true" />
    </button>
  );
}

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/** System, White or Black: the full choice, for the footer and the account menu. */
export function ThemePicker({ className = "" }: { className?: string }) {
  const choice = useSyncExternalStore<ThemeChoice>(subscribe, savedThemeChoice, () => DEFAULT_THEME);
  return (
    <div role="group" aria-label="Theme" className={`inline-flex rounded-full border border-[var(--border)] p-0.5 ${className}`}>
      {THEME_CHOICES.map((option) => {
        const Icon = ICONS[option];
        const selected = option === choice;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => chooseTheme(option)}
            className={`flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs ${selected ? "bg-[var(--card-raised)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
            {THEME_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
