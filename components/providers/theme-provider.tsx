"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "dark" | "light" | "system";
type Density = "comfortable" | "compact";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultDensity?: Density;
  storageKey?: string;
  densityStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  density: Density;
  setDensity: (density: Density) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  density: "comfortable",
  setDensity: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function applyThemeClass(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
    return;
  }

  root.classList.add(theme);
}

function applyDensity(density: Density) {
  window.document.documentElement.dataset.density = density;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultDensity = "comfortable",
  storageKey = "ui-theme",
  densityStorageKey = "ui-density",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [density, setDensityState] = useState<Density>(defaultDensity);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "system") {
        setThemeState(storedTheme);
      }
      const storedDensity = localStorage.getItem(densityStorageKey) as Density | null;
      if (storedDensity === "comfortable" || storedDensity === "compact") {
        setDensityState(storedDensity);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, densityStorageKey]);

  useEffect(() => {
    applyThemeClass(theme);

    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  const setTheme = useCallback(
    (next: Theme) => {
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
      setThemeState(next);
    },
    [storageKey],
  );

  const setDensity = useCallback(
    (next: Density) => {
      try {
        localStorage.setItem(densityStorageKey, next);
      } catch {
        /* ignore */
      }
      setDensityState(next);
    },
    [densityStorageKey],
  );

  const value: ThemeProviderState = {
    theme,
    setTheme,
    density,
    setDensity,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

export type { Theme, Density };
