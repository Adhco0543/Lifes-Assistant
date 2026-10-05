"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseBackend } from "@/lib/firebaseBackend";
import EnhancedApp from "@/components/EnhancedApp";

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const subscribeToAuth = async () => {
      try {
        await firebaseBackend.initialize();

        const auth = firebaseBackend.getAuth();
        if (!auth) {
          if (!cancelled) {
            setIsLoading(false);
            router.replace("/");
          }
          return;
        }

        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (cancelled) return;

          if (user) {
            setUserId(user.uid);
            setIsLoading(false);
          } else {
            setUserId(null);
            setIsLoading(false);
            router.replace("/");
          }
        });
      } catch (error) {
        console.error("Error checking auth:", error);
        if (!cancelled) {
          setIsLoading(false);
          router.replace("/");
        }
      }
    };

    subscribeToAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="loading">
        <p>Loading Life&apos;s Assistant...</p>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return <EnhancedApp userId={userId} />;
}
