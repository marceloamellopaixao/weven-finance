import { Metadata } from "next";
import FirstAccessPage from "./FirstAccess";

export const metadata: Metadata = {
  title: "WevenFinance | Primeiro acesso",
  description: "Defina ou altere sua senha com segurança no WevenFinance.",
  icons: {
    icon: "/wevenfinance.svg",
  },
};

export default function PageFirstAccess() {
  return <FirstAccessPage />;
}
