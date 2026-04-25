"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseBackend } from "@/lib/firebaseBackend";
import EnhancedApp from "@/components/EnhancedApp";

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await firebaseBackend.initialize();
        const user = firebaseBackend.getCurrentUser();
        
        if (user) {
          setUserId(user.uid);
        } else {
          // Not authenticated, redirect to home
          router.push('/');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return <EnhancedApp userId={userId} />;
}