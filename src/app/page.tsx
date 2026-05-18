"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/hooks/use-auth";
import Image from "next/image";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push(`/${user.role}`);
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/atomberg-logo.svg"
          alt="Atomberg"
          width={64}
          height={64}
          className="rounded-xl"
          priority
        />
        <h1 className="text-2xl font-bold">GoalTracker</h1>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
