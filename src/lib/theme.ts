export type ThemePreference = "system" | "light" | "dark";

export const THEMES: readonly ThemePreference[] = ["system", "light", "dark"];
export const THEME_STORAGE_KEY = "tell-theme";
export const THEME_CHANGE_EVENT = "tell-theme-change";

/** Browser chrome colours; match `--page` in globals.css. */
export const THEME_COLORS = { light: "#f3f4f2", dark: "#111713" } as const;

export function parseTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Runs in <head> before first paint so a saved choice never flashes the
 * other palette. Kept dependency-free and wrapped in try/catch because
 * storage can be blocked.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
