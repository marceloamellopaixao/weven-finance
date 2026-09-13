import type { Metadata } from "next";

import { MfaChallenge } from "@/components/auth/MfaChallenge";

export const metadata: Metadata = {
  title: "Verificação em duas etapas | WevenFinance",
  robots: { index: false, follow: false },
};

export default function MfaPage() {
  return <MfaChallenge />;
}
