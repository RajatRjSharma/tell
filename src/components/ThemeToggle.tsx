"use client";

import {
  useLayoutEffect,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  THEMES,
  parseTheme,
  type ThemePreference,
} from "@/lib/theme";

function readTheme(): ThemePreference {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);

  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    const media = meta.getAttribute("media") ?? "";
    const own = media.includes("dark") ? THEME_COLORS.dark : THEME_COLORS.light;
    meta.content = theme === "system" ? own : THEME_COLORS[theme];
  }
}

const LABELS: Record<ThemePreference, string> = {
  system: "Match system theme",
  light: "Light theme",
  dark: "Dark theme",
};

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="3" width="12" height="8.5" rx="1.5" />
      <path d="M6 14h4M8 11.5V14" />
    </svg>
  );
}

/** System / light / dark switch. Persists per browser and syncs across tabs. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore<ThemePreference>(
    subscribe,
    readTheme,
    () => "system",
  );

  // React's dev-mode remount resets <html> attributes set by the inline
  // script; re-apply before paint. Reads storage rather than `theme`, which
  // is "system" during hydration and would otherwise undo the saved choice.
  useLayoutEffect(() => {
    applyTheme(readTheme());
  }, [theme]);

  function choose(next: ThemePreference) {
    // Without this, every element with a colour transition fades at its own
    // speed and the page passes through mixed palettes.
    const pause = document.createElement("style");
    pause.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(pause);
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: still switch for this page view.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    void getComputedStyle(document.body).color;
    requestAnimationFrame(() => pause.remove());
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const index = THEMES.indexOf(theme);
    const next = THEMES[(index + step + THEMES.length) % THEMES.length]!;
    choose(next);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-theme-option="${next}"]`)
      ?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`theme-toggle ${className}`}
      data-testid="theme-toggle"
      onKeyDown={onKeyDown}
    >
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={theme === option}
          tabIndex={theme === option ? 0 : -1}
          data-theme-option={option}
          aria-label={LABELS[option]}
          title={LABELS[option]}
          className="theme-toggle-option"
          data-testid={`theme-${option}`}
          onClick={() => choose(option)}
        >
          <ThemeIcon theme={option} />
        </button>
      ))}
    </div>
  );
}
