import React, { useState } from "react";
import {
  Info,
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { clsx } from "clsx";

/**
 * @param {Object} props
 * @param {'info' | 'tip' | 'warning' | 'help'} props.type
 * @param {string} props.title
 * @param {React.ReactNode} props.children
 * @param {boolean} props.collapsible
 * @param {boolean} props.dismissible
 * @param {string} props.className
 */
export function FiscalInsight({
  type = "info",
  title,
  children,
  collapsible = false,
  dismissible = false,
  className,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const icons = {
    info: Info,
    tip: Lightbulb,
    warning: AlertTriangle,
    error: AlertTriangle,
    help: HelpCircle,
  };

  const styles = {
    info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
    tip: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200",
    warning:
      "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
    error:
      "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
    help: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200",
  };

  const iconStyles = {
    info: "text-blue-500 dark:text-blue-400",
    tip: "text-amber-500 dark:text-amber-400",
    warning: "text-red-500 dark:text-red-400",
    error: "text-red-500 dark:text-red-400",
    help: "text-purple-500 dark:text-purple-400",
  };

  const Icon = icons[type];

  return (
    <div className={clsx("rounded-lg border p-3 text-sm", styles[type], className)}>
      <div className="flex items-start gap-2">
        <Icon className={clsx("h-4 w-4 mt-0.5 flex-shrink-0", iconStyles[type])} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm">{title}</h4>
            <div className="flex items-center gap-1">
              {collapsible && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
              {dismissible && (
                <button
                  onClick={() => setDismissed(true)}
                  className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {(!collapsible || expanded) && children && (
            <div className="mt-1 text-xs opacity-90 leading-relaxed">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FiscalTip({ children, className }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      <Lightbulb className="h-3 w-3 text-amber-500" />
      {children}
    </span>
  );
}

export function FiscalBadge({ status, children }) {
  const statusStyles = {
    ok: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
    warning:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    error:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
    info: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        statusStyles[status] || statusStyles.info
      )}
    >
      {children}
    </span>
  );
}

export function FiscalHelpSection({ title, items }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-sm">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="p-3 space-y-2 text-sm">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <div>
                {item.title && <span className="font-medium">{item.title}: </span>}
                <span className="text-muted-foreground">{item.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FiscalInsight;
