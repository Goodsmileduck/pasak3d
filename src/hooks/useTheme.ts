import { useState, useEffect, useCallback } from "react";
import { THEME_STORAGE_KEY } from "../lib/constants";

export type Theme = "light" | "dark" | "system";

const SYSTEM_DARK = "(prefers-color-scheme: dark)";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return stored ?? "system";
  });
  // Live OS preference, kept in state so a "system"-mode user sees changes immediately.
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(SYSTEM_DARK).matches);

  const isDark = theme === "system" ? systemDark : theme === "dark";

  // Reflect resolved theme onto <html data-theme> so the Filament CSS vars flip.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Track OS preference changes (only affects the UI while theme === "system").
  useEffect(() => {
    const mq = window.matchMedia(SYSTEM_DARK);
    const handler = () => setSystemDark(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_STORAGE_KEY, t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  // setTheme/theme stay internal — only isDark + toggleTheme are consumed today.
  return { isDark, toggleTheme };
}
