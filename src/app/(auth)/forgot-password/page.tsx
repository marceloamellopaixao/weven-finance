import { Metadata } from "next";
import ForgotPasswordPage from "./ForgotPassword";

export const metadata: Metadata = {
    title: "WevenFinance | Esqueci minha senha",
    description: "Recuperação de senha | WevenFinance",
    icons: {
        icon: "/wevenfinance.svg",
    },
}

export default function PageForgotPassword() {
    return <ForgotPasswordPage />;
}