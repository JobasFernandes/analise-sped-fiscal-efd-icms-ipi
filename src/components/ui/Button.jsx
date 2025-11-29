import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";

export const Button = React.forwardRef(
  ({ asChild, className, variant = "default", size = "default", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const base =
      "inline-flex items-center justify-center gap-2 font-medium leading-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg";
    const variants = {
      default:
        "border border-blue-500 text-blue-600 bg-transparent hover:bg-blue-500/10 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-400/15 focus-visible:ring-blue-500",
      secondary:
        "border border-gray-400 text-gray-600 bg-transparent hover:bg-gray-500/10 dark:border-gray-500 dark:text-gray-400 dark:hover:bg-gray-400/15 focus-visible:ring-gray-400",
      outline:
        "border border-gray-300 text-gray-600 bg-transparent hover:bg-gray-500/10 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-400/10 dark:hover:border-gray-500 focus-visible:ring-gray-400",
      ghost:
        "text-gray-600 bg-transparent hover:bg-gray-500/10 dark:text-gray-300 dark:hover:bg-gray-400/10 focus-visible:ring-gray-400",
      destructive:
        "border border-red-500 text-red-600 bg-transparent hover:bg-red-500/10 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/15 focus-visible:ring-red-500",
      success:
        "border border-emerald-500 text-emerald-600 bg-transparent hover:bg-emerald-500/10 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-400/15 focus-visible:ring-emerald-500",
    };
    const sizes = {
      xs: "h-7 px-2 text-xs",
      sm: "h-8 px-3 text-xs",
      default: "h-9 px-4 text-sm",
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
