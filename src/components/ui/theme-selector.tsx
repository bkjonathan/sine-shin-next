"use client";

import { useTheme, type ThemeAccent } from "@/contexts/theme-context";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENTS: { value: ThemeAccent; color: string; label: string }[] = [
  { value: "blue",   color: "#007AFF", label: "Blue"   },
  { value: "purple", color: "#AF52DE", label: "Purple" },
  { value: "green",  color: "#30D158", label: "Green"  },
  { value: "rose",   color: "#FF375F", label: "Rose"   },
  { value: "amber",  color: "#FF9F0A", label: "Amber"  },
];

export function ThemeSelector() {
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-2 py-1.5 backdrop-blur-xl">
      <button
        onClick={() => setMode(mode === "dark" ? "light" : "dark")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200",
          "border-transparent text-t2 hover:border-line hover:bg-surface-hover hover:text-t1"
        )}
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="flex items-center gap-1.5 pl-1">
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            onClick={() => setAccent(a.value)}
            title={a.label}
            aria-label={`${a.label} accent`}
            aria-pressed={accent === a.value}
            className={cn(
              "h-4 w-4 rounded-full border border-white/40 transition-all duration-200",
              accent === a.value
                ? "scale-125 ring-2 ring-offset-2 ring-offset-transparent"
                : "opacity-65 hover:opacity-100 hover:scale-110"
            )}
            style={{
              backgroundColor: a.color,
              ringColor: a.color,
              boxShadow: accent === a.value ? `0 0 0 2px ${a.color}` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
