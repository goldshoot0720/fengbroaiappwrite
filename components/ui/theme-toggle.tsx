"use client";

import { Moon, Sun, Monitor, Rows3, StretchHorizontal } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="h-9 w-9 p-0 transition-impeccable hover:bg-muted"
      title={`切換主題 (當前: ${theme === "light" ? "淺色" : theme === "dark" ? "暗黑" : "系統"})`}
    >
      {getIcon()}
    </Button>
  );
}

/** Density toggle for Design Mode card (comfortable | compact) */
export function DensityToggleCompact() {
  const { density, setDensity } = useTheme();
  const isCompact = density === "compact";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setDensity(isCompact ? "comfortable" : "compact")}
      className="h-9 w-9 p-0 transition-impeccable hover:bg-muted"
      title={
        isCompact
          ? "目前：緊湊密度，點擊切換為舒適"
          : "目前：舒適密度，點擊切換為緊湊"
      }
      aria-label={isCompact ? "切換為舒適密度" : "切換為緊湊密度"}
      aria-pressed={isCompact}
    >
      {isCompact ? (
        <Rows3 className="h-4 w-4" />
      ) : (
        <StretchHorizontal className="h-4 w-4" />
      )}
    </Button>
  );
}
