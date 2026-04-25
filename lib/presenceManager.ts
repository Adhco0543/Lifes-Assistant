import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/public/src/lib/firebase";

export interface UserPresence {
  userId: string;
  isOnline: boolean;
  lastSeenAt: Date;
  signedOnAt?: Date;
  currentActivity?: string;
  idleTime?: number; // in seconds
  sessionDuration?: number; // in seconds
}

export interface PresenceEvent {
  type: "sign_on" | "sign_off" | "idle" | "active";
  timestamp: Date;
  metadata?: {
    idleMinutes?: number;
    sessionMinutes?: number;
    lastActivity?: string;
  };
}

export class PresenceManager {
  private static idleTimeout = 15 * 60 * 1000; // 15 minutes in ms
  private static idleCheckInterval = 60 * 1000; // Check every minute
  private static heartbeatInterval = 30 * 1000; // Update presence every 30 seconds
  private static presenceListeners: Map<string, () => void> = new Map();
  private static idleTimers: Map<string, NodeJS.Timeout> = new Map();
  private static heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private static lastActivityTime: Map<string, number> = new Map();

  /**
   * Initialize presence tracking for user
   */
  static async initializePresence(userId: string): Promise<void> {
    try {
      const userPresenceRef = doc(collection(db, "user_presence"), userId);

      const presence: UserPresence = {
        userId,
        isOnline: true,
        lastSeenAt: new Date(),
        signedOnAt: new Date(),
        currentActivity: "active",
        idleTime: 0,
      };

      await setDoc(userPresenceRef, {
        ...presence,
        lastSeenAt: Timestamp.fromDate(presence.lastSeenAt),
        signedOnAt: Timestamp.fromDate(presence.signedOnAt),
      });

      // Reset last activity time
      this.lastActivityTime.set(userId, Date.now());

      // Start heartbeat
      this.startHeartbeat(userId);

      // Start idle detection
      this.startIdleDetection(userId);

      // Listen for user activity
      this.setupActivityListeners(userId);

      console.log(`Presence initialized for user: ${userId}`);
    } catch (error) {
      console.error("Error initializing presence:", error);
    }
  }

  /**
   * Sign off user
   */
  static async signOff(userId: string): Promise<void> {
    try {
      const userPresenceRef = doc(collection(db, "user_presence"), userId);

      const signOnSnapshot = await getDoc(userPresenceRef);
      const signOnTime = signOnSnapshot?.data()?.signedOnAt?.toDate?.() || new Date();
      const sessionDuration = Math.floor((Date.now() - signOnTime.getTime()) / 1000);

      await updateDoc(userPresenceRef, {
        isOnline: false,
        lastSeenAt: Timestamp.fromDate(new Date()),
        currentActivity: "offline",
        sessionDuration,
      });

      // Clean up timers and listeners
      this.stopHeartbeat(userId);
      this.stopIdleDetection(userId);
      this.removeActivityListeners(userId);

      console.log(`User signed off: ${userId}`);

      // Log presence event
      await this.logPresenceEvent(userId, "sign_off", {
        sessionMinutes: Math.floor(sessionDuration / 60),
      });
    } catch (error) {
      console.error("Error signing off user:", error);
    }
  }

  /**
   * Update current activity
   */
  static async updateActivity(userId: string, activity: string): Promise<void> {
    try {
      const userPresenceRef = doc(collection(db, "user_presence"), userId);

      await updateDoc(userPresenceRef, {
        currentActivity: activity,
        lastSeenAt: Timestamp.fromDate(new Date()),
        idleTime: 0,
      });

      this.lastActivityTime.set(userId, Date.now());
    } catch (error) {
      console.error("Error updating activity:", error);
    }
  }

  /**
   * Get user presence
   */
  static async getPresence(userId: string): Promise<UserPresence | null> {
    try {
      const userPresenceRef = doc(collection(db, "user_presence"), userId);
      const snapshot = await getDoc(userPresenceRef);

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();
      return {
        userId: data.userId,
        isOnline: data.isOnline,
        lastSeenAt: data.lastSeenAt?.toDate?.() || new Date(),
        signedOnAt: data.signedOnAt?.toDate?.(),
        currentActivity: data.currentActivity,
        idleTime: data.idleTime,
        sessionDuration: data.sessionDuration,
      };
    } catch (error) {
      console.error("Error fetching presence:", error);
      return null;
    }
  }

  /**
   * Listen to presence changes in real-time
   */
  static onPresenceChange(userId: string, callback: (presence: UserPresence | null) => void): () => void {
    try {
      const userPresenceRef = doc(collection(db, "user_presence"), userId);

      const unsubscribe = onSnapshot(userPresenceRef, (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }

        const data = snapshot.data();
        const presence: UserPresence = {
          userId: data.userId,
          isOnline: data.isOnline,
          lastSeenAt: data.lastSeenAt?.toDate?.() || new Date(),
          signedOnAt: data.signedOnAt?.toDate?.(),
          currentActivity: data.currentActivity,
          idleTime: data.idleTime,
          sessionDuration: data.sessionDuration,
        };

        callback(presence);
      });

      this.presenceListeners.set(userId, unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error("Error listening to presence:", error);
      return () => {};
    }
  }

  /**
   * Private: Start heartbeat to update presence
   */
  private static startHeartbeat(userId: string): void {
    const interval = setInterval(async () => {
      try {
        const userPresenceRef = doc(collection(db, "user_presence"), userId);
        await updateDoc(userPresenceRef, {
          lastSeenAt: Timestamp.fromDate(new Date()),
        });
      } catch (error) {
        console.error("Error updating heartbeat:", error);
      }
    }, this.heartbeatInterval);

    this.heartbeatIntervals.set(userId, interval);
  }

  /**
   * Private: Stop heartbeat
   */
  private static stopHeartbeat(userId: string): void {
    const interval = this.heartbeatIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(userId);
    }
  }

  /**
   * Private: Start idle detection
   */
  private static startIdleDetection(userId: string): void {
    const timer = setInterval(async () => {
      try {
        const lastActivity = this.lastActivityTime.get(userId) || Date.now();
        const idleSeconds = Math.floor((Date.now() - lastActivity) / 1000);

        const userPresenceRef = doc(collection(db, "user_presence"), userId);
        const snapshot = await getDoc(userPresenceRef);
        const wasIdle = snapshot?.data()?.currentActivity === "idle";

        if (idleSeconds > this.idleTimeout / 1000 && !wasIdle) {
          // User just became idle
          await updateDoc(userPresenceRef, {
            currentActivity: "idle",
            idleTime: idleSeconds,
          });

          await this.logPresenceEvent(userId, "idle", {
            idleMinutes: Math.floor(idleSeconds / 60),
          });
        } else if (idleSeconds <= this.idleTimeout / 1000 && wasIdle) {
          // User is back from idle
          await updateDoc(userPresenceRef, {
            currentActivity: "active",
            idleTime: 0,
          });

          await this.logPresenceEvent(userId, "active");
        } else if (wasIdle) {
          // Update idle time
          await updateDoc(userPresenceRef, {
            idleTime: idleSeconds,
          });
        }
      } catch (error) {
        console.error("Error in idle detection:", error);
      }
    }, this.idleCheckInterval);

    this.idleTimers.set(userId, timer);
  }

  /**
   * Private: Stop idle detection
   */
  private static stopIdleDetection(userId: string): void {
    const timer = this.idleTimers.get(userId);
    if (timer) {
      clearInterval(timer);
      this.idleTimers.delete(userId);
    }
  }

  /**
   * Private: Setup activity listeners
   */
  private static setupActivityListeners(userId: string): void {
    if (typeof window === "undefined") return;

    const events = ["mousedown", "keydown", "touchstart", "scroll"];

    const handleActivity = () => {
      this.lastActivityTime.set(userId, Date.now());
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });
  }

  /**
   * Private: Remove activity listeners
   */
  private static removeActivityListeners(userId: string): void {
    if (typeof window === "undefined") return;

    const events = ["mousedown", "keydown", "touchstart", "scroll"];

    events.forEach((event) => {
      window.removeEventListener(event, () => {});
    });
  }

  /**
   * Log presence event
   */
  private static async logPresenceEvent(
    userId: string,
    eventType: PresenceEvent["type"],
    metadata?: PresenceEvent["metadata"]
  ): Promise<void> {
    try {
      const eventRef = doc(
        collection(db, "presence_events"),
        `${userId}_${Date.now()}`
      );

      await setDoc(eventRef, {
        userId,
        type: eventType,
        timestamp: Timestamp.fromDate(new Date()),
        metadata: metadata || {},
      });
    } catch (error) {
      console.error("Error logging presence event:", error);
    }
  }
}

export default PresenceManager;
