"use client";

import { Layers, Tag } from "lucide-react";

import {
  getCategoryRoot,
  getSubcategoryName,
  isLegacySubcategory,
  isLinkedSubcategory,
} from "@/lib/category-utils";
import { useI18n } from "@/i18n/I18nProvider";
import { translateDefaultCategoryName } from "@/lib/categories/defaultCategories";
import { cn } from "@/lib/utils";

type CategoryLabelProps = {
  value: string;
  className?: string;
  iconClassName?: string;
  inheritColors?: boolean;
};

export function CategoryLabel({ value, className, iconClassName, inheritColors = false }: CategoryLabelProps) {
  const { locale } = useI18n();
  const iconTone = inheritColors ? "text-current" : "text-primary";
  const rootTone = inheritColors ? "text-current opacity-75" : "text-muted-foreground";
  const separatorTone = inheritColors ? "text-current opacity-55" : "text-muted-foreground/60";
  const subTone = inheritColors ? "text-current" : "text-foreground";
  const categoryIconTone = inheritColors ? "text-current opacity-75" : "text-muted-foreground";

  if (isLinkedSubcategory(value)) {
    return (
      <span className={cn("flex min-w-0 items-center gap-2", className)}>
        <Layers className={cn("h-3.5 w-3.5 shrink-0", iconTone, iconClassName)} />
        <span data-i18n-skip className={cn("truncate", rootTone)}>{translateDefaultCategoryName(getCategoryRoot(value), locale)}</span>
        <span className={separatorTone}>/</span>
        <span data-i18n-skip className={cn("truncate font-medium", subTone)}>{translateDefaultCategoryName(getSubcategoryName(value), locale)}</span>
      </span>
    );
  }

  if (isLegacySubcategory(value)) {
    return (
      <span className={cn("flex min-w-0 items-center gap-2 pl-1", className)}>
        <Layers className={cn("h-3.5 w-3.5 shrink-0", iconTone, iconClassName)} />
        <span data-i18n-skip className={cn("truncate font-medium", subTone)}>{translateDefaultCategoryName(getSubcategoryName(value), locale)}</span>
      </span>
    );
  }

  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <Tag className={cn("h-3.5 w-3.5 shrink-0", categoryIconTone, iconClassName)} />
      <span data-i18n-skip className="truncate">{translateDefaultCategoryName(value, locale)}</span>
    </span>
  );
}
