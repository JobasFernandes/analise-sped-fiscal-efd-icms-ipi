import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/theme-context";
import Button from "./ui/Button";

const ThemeToggle = ({ className }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className={className}>
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        aria-label="Alternar tema"
        title={isDark ? "Tema: escuro" : "Tema: claro"}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-blue-400" />
        ) : (
          <Sun className="h-4 w-4 text-yellow-500" />
        )}
      </Button>
    </div>
  );
};

export default ThemeToggle;
