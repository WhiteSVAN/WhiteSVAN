/**
 * Site themes: White and Dark, in the Manus style (see docs/theme.md). Every colour is a token in
 * src/app/globals.css; this module only knows the theme names, the visitor's saved choice and the
 * script that applies it before the first paint. Runs in the browser and on the server.
 */

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type Theme = "light" | "dark";

/** A first visit: "system" follows the device's setting; "light" or "dark" shows that theme until the visitor picks. */
export const DEFAULT_THEME: ThemeChoice = "system";

export const THEME_STORAGE_KEY = "whitesvan-theme";

export const THEME_LABELS: Record<ThemeChoice, string> = { system: "System", light: "White", dark: "Dark" };

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

/** The theme a choice shows, given whether the device prefers dark. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}

/** The visitor's saved choice, or the default. Storage can be blocked, so this never throws. */
export function savedThemeChoice(): ThemeChoice {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** The theme on the page now, from the attribute the head script set. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function show(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

/** Save a choice and show it at once. Charts and other listeners follow the `data-theme` attribute. */
export function chooseTheme(choice: ThemeChoice) {
  try {
    if (choice === DEFAULT_THEME) window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private browsing can block storage: the theme still changes for this visit.
  }
  show(resolveTheme(choice, window.matchMedia(DARK_QUERY).matches));
}

/** Call `listener` whenever the page's theme changes, from the toggle, another tab or the device. Returns the unsubscribe. */
export function onThemeChange(listener: (theme: Theme) => void): () => void {
  const observer = new MutationObserver(() => listener(currentTheme()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/**
 * Inline in <head>: shows the saved theme before anything paints, follows the device while the
 * choice is "system", and keeps tabs in step when the choice changes in another one.
 */
export const THEME_SCRIPT = `(function(){var k=${JSON.stringify(THEME_STORAGE_KEY)},f=${JSON.stringify(DEFAULT_THEME)},q=window.matchMedia(${JSON.stringify(DARK_QUERY)}),d=document.documentElement;function c(){try{var s=localStorage.getItem(k);if(s==="system"||s==="light"||s==="dark")return s}catch(e){}return f}function a(){var v=c(),t=v==="system"?(q.matches?"dark":"light"):v;d.setAttribute("data-theme",t);d.style.colorScheme=t}a();try{q.addEventListener("change",a);window.addEventListener("storage",function(e){if(e.key===k)a()})}catch(e){}})()`;
