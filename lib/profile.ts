import { firebaseBackend } from './firebaseBackend';
import type { StoredLifeProfile } from './lifePreferences';

/** User profile is stored at users/{Firebase Auth uid}.profile. */
export async function getUserProfile(uid: string): Promise<StoredLifeProfile | null> {
  const profile = await firebaseBackend.getUserProfile(uid);
  if (!profile || !['everyday', 'business', 'mix'].includes(String(profile.mode))) return null;
  return profile as StoredLifeProfile;
}

export async function updateUserProfile(uid: string, profile: Partial<StoredLifeProfile>): Promise<void> {
  await firebaseBackend.updateUserProfile(uid, profile);
}
