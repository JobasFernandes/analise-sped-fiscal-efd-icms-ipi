import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/theme-context";
import { Switch } from "./ui/switch";

const ThemeToggle = ({ className }) => {
  const { theme, toggleTheme } = useTheme();
  const checked = theme === "dark";
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Sun className="h-4 w-4 text-yellow-500" />
        <Switch
          checked={checked}
          onCheckedChange={toggleTheme}
          aria-label="Alternar tema"
        />
        <Moon className="h-4 w-4 text-blue-400" />
      </div>
    </div>
  );
};

export default ThemeToggle;
