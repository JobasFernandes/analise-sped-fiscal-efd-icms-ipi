import * as SeparatorPrimitive from "@radix-ui/react-separator";
import React from "react";
import { clsx } from "clsx";

export function Separator({ orientation = "horizontal", className }) {
  return (
    <SeparatorPrimitive.Root
      decorative
      orientation={orientation}
      className={clsx(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
    />
  );
}

export default Separator;
