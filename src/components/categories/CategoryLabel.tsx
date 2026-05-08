"use client";

import { Layers, Tag } from "lucide-react";

import {
  getCategoryRoot,
  getSubcategoryName,
  isLegacySubcategory,
  isLinkedSubcategory,
} from "@/lib/category-utils";
import { cn } from "@/lib/utils";

type CategoryLabelProps = {
  value: string;
  className?: string;
  iconClassName?: string;
  inheritColors?: boolean;
};

export function CategoryLabel({ value, className, iconClassName, inheritColors = false }: CategoryLabelProps) {
  const iconTone = inheritColors ? "text-current" : "text-primary";
  const rootTone = inheritColors ? "text-current opacity-75" : "text-muted-foreground";
  const separatorTone = inheritColors ? "text-current opacity-55" : "text-muted-foreground/60";
  const subTone = inheritColors ? "text-current" : "text-foreground";
  const categoryIconTone = inheritColors ? "text-current opacity-75" : "text-muted-foreground";

  if (isLinkedSubcategory(value)) {
    return (
      <span className={cn("flex min-w-0 items-center gap-2", className)}>
        <Layers className={cn("h-3.5 w-3.5 shrink-0", iconTone, iconClassName)} />
        <span className={cn("truncate", rootTone)}>{getCategoryRoot(value)}</span>
        <span className={separatorTone}>/</span>
        <span className={cn("truncate font-medium", subTone)}>{getSubcategoryName(value)}</span>
      </span>
    );
  }

  if (isLegacySubcategory(value)) {
    return (
      <span className={cn("flex min-w-0 items-center gap-2 pl-1", className)}>
        <Layers className={cn("h-3.5 w-3.5 shrink-0", iconTone, iconClassName)} />
        <span className={cn("truncate font-medium", subTone)}>{getSubcategoryName(value)}</span>
      </span>
    );
  }

  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Tag className={cn("h-3.5 w-3.5 shrink-0", categoryIconTone, iconClassName)} />
      <span className="truncate">{value}</span>
    </span>
  );
}
