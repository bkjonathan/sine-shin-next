"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";
export type ThemeAccent = "blue" | "purple" | "green" | "rose" | "amber";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: ThemeAccent;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  accent: "blue",
  setMode: () => {},
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getStoredTheme(): { mode: ThemeMode; accent: ThemeAccent } {
  if (typeof window === "undefined") return { mode: "dark", accent: "blue" };
  return {
    mode: (localStorage.getItem("theme-mode") as ThemeMode) ?? "dark",
    accent: (localStorage.getItem("theme-accent") as ThemeAccent) ?? "blue",
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredTheme().mode);
  const [accent, setAccentState] = useState<ThemeAccent>(() => getStoredTheme().accent);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", mode);
    el.setAttribute("data-accent", accent);
    localStorage.setItem("theme-mode", mode);
    localStorage.setItem("theme-accent", accent);
  }, [mode, accent]);

  function setMode(m: ThemeMode) {
    setModeState(m);
  }

  function setAccent(a: ThemeAccent) {
    setAccentState(a);
  }

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}
