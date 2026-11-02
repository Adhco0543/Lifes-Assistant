import { initializeApp } from "firebase/app";
import {
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const userId = process.env.RADAR_USER_ID;
const email = process.env.FIREBASE_USER_EMAIL;
const password = process.env.FIREBASE_USER_PASSWORD;

const testPatterns = [
  /review the code/i,
  /github repository/i,
  /retrieve github/i,
  /source files/i,
  /review the coding/i,
];

async function main(): Promise<void> {
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId ||
    !firebaseConfig.appId ||
    !userId ||
    !email ||
    !password
  ) {
    throw new Error(
      "Set the Firebase config, RADAR_USER_ID, FIREBASE_USER_EMAIL, and FIREBASE_USER_PASSWORD environment variables."
    );
  }

  const app = initializeApp(firebaseConfig);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const credential = await signInWithEmailAndPassword(auth, email, password);

  if (credential.user.uid !== userId) {
    throw new Error("The signed-in Firebase account does not match RADAR_USER_ID.");
  }

  const db = getFirestore(app);
  const loopsRef = collection(db, "users", userId, "openLoops");
  const snapshot = await getDocs(
    query(loopsRef, where("status", "==", "open"))
  );
  console.log(`Found ${snapshot.size} open loops`);

  let archived = 0;
  const now = Date.now();

  for (const loopDoc of snapshot.docs) {
    const data = loopDoc.data();
    if (data.archived === true) continue;

    const title = String(data.title || data.name || "");
    const createdAt =
      typeof data.createdAt === "number"
        ? data.createdAt
        : typeof data.createdAt?.toMillis === "function"
          ? data.createdAt.toMillis()
          : typeof data.createdAt === "string"
            ? Date.parse(data.createdAt)
            : Number.NaN;
    const ageDays = Number.isFinite(createdAt)
      ? Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
      : null;

    if (
      testPatterns.some((pattern) => pattern.test(title)) ||
      (ageDays !== null && ageDays > 14)
    ) {
      console.log(
        `Archiving: "${title}" (${ageDays === null ? "unknown age" : `${ageDays} days old`})`
      );
      await updateDoc(doc(db, loopsRef.path, loopDoc.id), {
        archived: true,
        updatedAt: now,
      });
      archived++;
    }
  }

  console.log(`Done. Archived ${archived} loops.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
