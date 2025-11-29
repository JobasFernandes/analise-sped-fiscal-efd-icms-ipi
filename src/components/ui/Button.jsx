import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";

export const Button = React.forwardRef(
  ({ asChild, className, variant = "default", size = "default", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const base =
      "inline-flex items-center justify-center font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none rounded-lg";
    const variants = {
      default:
        "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600",
      secondary:
        "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
      outline:
        "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      destructive: "bg-red-600 text-white hover:bg-red-700",
    };
    const sizes = {
      xs: "h-7 px-2 text-xs",
      sm: "h-8 px-3 text-xs",
      default: "h-9 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-base",
      icon: "h-9 w-9 p-0",
    };
    return (
      <Comp
        ref={ref}
        className={clsx(
          base,
          variants[variant] || variants.default,
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export default Button;
