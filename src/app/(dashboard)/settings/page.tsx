import { Metadata } from "next";
import SettingsPage from "./SettingsPage";

export const metadata: Metadata = {
    title: "WevenFinance | Configurações",
    description: "Gerenciamento financeiro | Configurações",
    icons: {
        icon: "/wevenfinance.svg",
    },
}

export default function PageSettings() {
    return <SettingsPage />;
}