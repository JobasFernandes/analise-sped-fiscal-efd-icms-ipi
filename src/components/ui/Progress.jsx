import * as ProgressPrimitive from "@radix-ui/react-progress";
import React from "react";
import { clsx } from "clsx";

export function Progress({ value = 0, className }) {
  return (
    <ProgressPrimitive.Root
      className={clsx(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-blue-600 transition-transform"
        style={{
          transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export default Progress;
