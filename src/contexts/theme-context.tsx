"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode   = "dark" | "light";
export type ThemeAccent = "blue" | "purple" | "green" | "rose" | "amber";
export type FontSize    = "small" | "normal" | "large" | "x-large";

interface ThemeContextValue {
  mode:      ThemeMode;
  accent:    ThemeAccent;
  fontSize:  FontSize;
  animations: boolean;
  compact:   boolean;
  setMode:       (mode:   ThemeMode)   => void;
  setAccent:     (accent: ThemeAccent) => void;
  setFontSize:   (size:   FontSize)    => void;
  setAnimations: (on:     boolean)     => void;
  setCompact:    (on:     boolean)     => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode:       "dark",
  accent:     "blue",
  fontSize:   "normal",
  animations: true,
  compact:    false,
  setMode:       () => {},
  setAccent:     () => {},
  setFontSize:   () => {},
  setAnimations: () => {},
  setCompact:    () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getStored() {
  if (typeof window === "undefined")
    return { mode: "dark" as ThemeMode, accent: "blue" as ThemeAccent, fontSize: "normal" as FontSize, animations: true, compact: false };
  return {
    mode:       (localStorage.getItem("theme-mode")       as ThemeMode)   ?? "dark",
    accent:     (localStorage.getItem("theme-accent")     as ThemeAccent) ?? "blue",
    fontSize:   (localStorage.getItem("theme-font-size")  as FontSize)    ?? "normal",
    animations: (localStorage.getItem("theme-animations") ?? "true") === "true",
    compact:    (localStorage.getItem("theme-compact")    ?? "false") === "true",
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = getStored();
  const [mode,       setModeState]       = useState<ThemeMode>(stored.mode);
  const [accent,     setAccentState]     = useState<ThemeAccent>(stored.accent);
  const [fontSize,   setFontSizeState]   = useState<FontSize>(stored.fontSize);
  const [animations, setAnimationsState] = useState<boolean>(stored.animations);
  const [compact,    setCompactState]    = useState<boolean>(stored.compact);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme",      mode);
    el.setAttribute("data-accent",     accent);
    el.setAttribute("data-font-size",  fontSize);
    el.setAttribute("data-animations", String(animations));
    el.setAttribute("data-compact",    String(compact));
    localStorage.setItem("theme-mode",       mode);
    localStorage.setItem("theme-accent",     accent);
    localStorage.setItem("theme-font-size",  fontSize);
    localStorage.setItem("theme-animations", String(animations));
    localStorage.setItem("theme-compact",    String(compact));
  }, [mode, accent, fontSize, animations, compact]);

  return (
    <ThemeContext.Provider value={{
      mode, accent, fontSize, animations, compact,
      setMode:       setModeState,
      setAccent:     setAccentState,
      setFontSize:   setFontSizeState,
      setAnimations: setAnimationsState,
      setCompact:    setCompactState,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
