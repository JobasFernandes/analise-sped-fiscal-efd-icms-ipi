import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React from "react";
import { clsx } from "clsx";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  side: _ignoredSide,
  align = "center",
  children,
  ...props
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side="bottom"
        align={align}
        sideOffset={6}
        className={clsx(
          "z-50 max-w-xs rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "focus:outline-none select-none",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-border" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export function WithTooltip({ content, children, ...opts }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent {...opts}>{content}</TooltipContent>
    </Tooltip>
  );
}
