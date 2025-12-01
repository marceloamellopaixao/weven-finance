"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {  } from "lucide-react";


export default function LoginPage() {
  const { signInWithGoogle, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Weven Finance</h1>
        <p className="mb-6 text-gray-600">Faça login para gerenciar suas finanças</p>

        <Button onClick={signInWithGoogle} className="w-full">
          <p>Entrar com Google <span></span></p>
        </Button>
      </div>
    </div>
  );
}