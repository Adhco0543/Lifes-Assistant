import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

// ---------- CONFIG ----------
// Replace with your actual Firebase config (or import it from your existing lib)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// The user whose Radar you want to clean
const USER_ID = "zRqOiqPE3FQhPlJTWR1tqUAZadx1"; // e.g. from Firebase Auth or the app

// Patterns that identify the old test loops
const TEST_PATTERNS = [
  /review the code/i,
  /github repository/i,
  /retrieve github/i,
  /source files/i,
  /review the coding/i,
];

// ---------- SCRIPT ----------
async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Adjust the collection path if your open loops live somewhere else
  // Common patterns: users/{uid}/loops, openLoops, radarItems, etc.
  const loopsRef = collection(db, "users", USER_ID, "loops"); // <-- change if needed
  const q = query(loopsRef, where("status", "==", "open")); // or whatever your open status is

  const snapshot = await getDocs(q);
  console.log(`Found ${snapshot.size} open loops`);

  let archived = 0;

  for (const loopDoc of snapshot.docs) {
    const data = loopDoc.data();
    const title = (data.title || data.name || "").toString();
    const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt || 0);
    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    const isTest = TEST_PATTERNS.some((p) => p.test(title));
    const isOld = ageDays > 14;

    if (isTest || isOld) {
      console.log(`Archiving: "${title}" (${ageDays} days old)`);
      await updateDoc(doc(db, loopsRef.path, loopDoc.id), {
        status: "archived",
        archivedAt: new Date(),
      });
      archived++;
    }
  }

  console.log(`Done. Archived ${archived} loops.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
