import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "brand" | "allergen" | "success" | "warning" | "danger" | "outline";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const variantStyles = {
    default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-transparent",
    brand: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-800",
    allergen: "bg-orange-50 text-orange-900 border-orange-200 dark:bg-zinc-800 dark:text-orange-300 dark:border-zinc-700 font-medium",
    success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200",
    danger: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200",
    outline: "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-transparent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
