import React from "react";
import { getAllergenInfo } from "@/lib/allergens";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AllergenBadgeProps {
  code: string;
  lang?: "es" | "en";
  showIcon?: boolean;
  onRemove?: () => void;
  className?: string;
}

export const AllergenBadge: React.FC<AllergenBadgeProps> = ({
  code,
  lang = "es",
  showIcon = true,
  onRemove,
  className,
}) => {
  const info = getAllergenInfo(code);

  const name = info
    ? lang === "en"
      ? info.nameEn
      : info.nameEs
    : code;

  const icon = info?.icon || "⚠️";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50/80 text-amber-900 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60 transition-colors",
        className
      )}
      title={info?.descriptionEs || name}
    >
      {showIcon && <span className="text-xs">{icon}</span>}
      <span>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 text-amber-700 hover:text-red-600 dark:text-amber-400 dark:hover:text-red-400 p-0.5 rounded-full"
          aria-label={`Eliminar alérgeno ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
};
