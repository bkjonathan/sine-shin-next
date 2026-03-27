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
    <div className="flex items-center gap-3">
      {/* Mode toggle */}
      <button
        onClick={() => setMode(mode === "dark" ? "light" : "dark")}
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
          "text-t2 hover:text-t1 hover:bg-surface"
        )}
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Accent color dots */}
      <div className="flex items-center gap-1.5">
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            onClick={() => setAccent(a.value)}
            title={a.label}
            className={cn(
              "w-4 h-4 rounded-full transition-all duration-200",
              accent === a.value
                ? "scale-125 ring-2 ring-offset-1 ring-offset-transparent"
                : "opacity-60 hover:opacity-100 hover:scale-110"
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
