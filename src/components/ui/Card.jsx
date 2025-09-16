import React from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }) {
  return <div className={clsx("card p-6", className)} {...props} />;
}

export default Card;
