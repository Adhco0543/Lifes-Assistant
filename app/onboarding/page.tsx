'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseBackend } from '@/lib/firebaseBackend';
import { getUserProfile } from '@/lib/profile';
import ProgressiveOnboarding from '@/components/Progressiveonboarding';

export default function OnboardingPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function checkProfile() {
      try {
        await firebaseBackend.initialize();
        const user = await firebaseBackend.waitForCurrentUser();
        if (!active) return;
        if (!user) { router.replace('/'); return; }
        const profile = await getUserProfile(user.uid);
        if (!active) return;
        if (profile?.mode === 'everyday' || profile?.mode === 'business' || profile?.mode === 'mix') {
          router.replace('/');
        } else {
          setUid(user.uid);
        }
      } catch {
        if (active) setError('Could not load your profile. Please retry.');
      }
    }
    void checkProfile();
    return () => { active = false; };
  }, [router]);

  if (error) return <main role="alert" style={{ padding: 32 }}>{error}<button type="button" onClick={() => window.location.reload()}>Retry</button></main>;
  if (!uid) return <main style={{ padding: 32 }}>Checking your profile…</main>;
  return <ProgressiveOnboarding userId={uid} onComplete={() => router.replace('/')} />;
}
