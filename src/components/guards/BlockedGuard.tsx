"use client";

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function BlockedGuard({ children }: Props) {
  // Access enforcement lives in useAuth to avoid duplicated/conflicting redirects.
  return <>{children}</>;
}
