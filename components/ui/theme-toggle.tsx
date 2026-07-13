"use client";

import { Moon, Sun, Monitor, Rows3, StretchHorizontal } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
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

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "淺色模式";
      case "dark":
        return "暗黑模式";
      default:
        return "系統模式";
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleTheme}
        className="h-auto w-auto border-[var(--line-strong)] bg-[color:var(--panel-strong)] px-3 py-2 transition-impeccable hover:bg-muted"
        title={`當前: ${getLabel()}, 點擊切換`}
      >
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="hidden text-xs font-medium sm:inline">
            {getLabel()}
          </span>
        </div>
      </Button>
    </div>
  );
}

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
