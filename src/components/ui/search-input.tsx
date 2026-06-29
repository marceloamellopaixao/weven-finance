import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function SearchInput({
  className,
  iconClassName,
  containerClassName,
  type = "search",
  ...props
}: React.ComponentProps<typeof Input> & {
  containerClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className={cn("relative min-w-0", containerClassName)}>
      <Search className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground", iconClassName)} />
      <Input
        type={type}
        className={cn("pl-9", className)}
        {...props}
      />
    </div>
  );
}

export { SearchInput };
