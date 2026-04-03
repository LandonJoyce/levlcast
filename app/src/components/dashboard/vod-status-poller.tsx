"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function VodStatusPoller({ hasProcessing }: { hasProcessing: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [hasProcessing, router]);

  return null;
}
