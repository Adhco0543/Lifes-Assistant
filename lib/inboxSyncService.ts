import { emailService, EmailSettings } from "./emailService";
import { db } from "../public/src/lib/firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";

export interface SyncStatus {
  isRunning: boolean;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  syncCount: number;
  errorCount: number;
  lastError?: string;
}

/**
 * InboxSyncService: Manages automatic background syncing of email inboxes
 * Runs on configurable intervals and can be triggered manually
 */
class InboxSyncServiceClass {
  private static instance: InboxSyncServiceClass;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private syncStatuses: Map<string, SyncStatus> = new Map();

  private constructor() {}

  static getInstance(): InboxSyncServiceClass {
    if (!InboxSyncServiceClass.instance) {
      InboxSyncServiceClass.instance = new InboxSyncServiceClass();
    }
    return InboxSyncServiceClass.instance;
  }

  /**
   * Start automatic inbox syncing for a user
   */
  async startSyncing(userId: string): Promise<void> {
    try {
      const settings = await emailService.getSettings(userId);

      if (!settings?.autoSyncEnabled) {
        console.log(`Auto-sync disabled for ${userId}`);
        return;
      }

      // Clear any existing interval
      this.stopSyncing(userId);

      // Initialize sync status
      this.syncStatuses.set(userId, {
        isRunning: true,
        lastSyncAt: settings.lastSyncAt || null,
        nextSyncAt: new Date(Date.now() + settings.syncIntervalMinutes * 60000),
        syncCount: 0,
        errorCount: 0,
      });

      // Perform initial sync
      await this.syncNow(userId);

      // Set up interval
      const intervalId = setInterval(() => {
        this.syncNow(userId).catch((err) => {
          console.error(`Sync error for ${userId}:`, err);
        });
      }, settings.syncIntervalMinutes * 60000); // Convert to ms

      this.syncIntervals.set(userId, intervalId);

      console.log(
        `Started inbox syncing for ${userId} (interval: ${settings.syncIntervalMinutes}m)`
      );
    } catch (error) {
      console.error(`Error starting sync for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Stop automatic syncing for a user
   */
  stopSyncing(userId: string): void {
    const intervalId = this.syncIntervals.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.syncIntervals.delete(userId);

      const status = this.syncStatuses.get(userId);
      if (status) {
        status.isRunning = false;
      }

      console.log(`Stopped inbox syncing for ${userId}`);
    }
  }

  /**
   * Perform a manual sync now
   */
  async syncNow(userId: string): Promise<void> {
    try {
      const settings = await emailService.getSettings(userId);
      if (!settings) return;

      const status = this.syncStatuses.get(userId) || {
        isRunning: false,
        lastSyncAt: null,
        nextSyncAt: null,
        syncCount: 0,
        errorCount: 0,
      };

      let syncedCount = 0;

      // Sync Gmail if connected
      if (settings.gmailConnected && settings.gmailAccessToken) {
        try {
          const count = await emailService.syncGmailInbox(userId, settings.gmailAccessToken);
          syncedCount += count;
        } catch (err) {
          console.error(`Gmail sync error for ${userId}:`, err);
          status.errorCount++;
          status.lastError = `Gmail sync failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      }

      // Sync Outlook if connected
      if (settings.outlookConnected && settings.outlookAccessToken) {
        try {
          const count = await emailService.syncOutlookInbox(userId, settings.outlookAccessToken);
          syncedCount += count;
        } catch (err) {
          console.error(`Outlook sync error for ${userId}:`, err);
          status.errorCount++;
          status.lastError = `Outlook sync failed: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      }

      // Update status
      status.lastSyncAt = new Date();
      status.syncCount += syncedCount;
      status.nextSyncAt = new Date(Date.now() + (settings.syncIntervalMinutes || 15) * 60000);

      this.syncStatuses.set(userId, status);

      // Persist sync time to Firestore
      await this.updateSyncTime(userId);

      console.log(`Synced ${syncedCount} emails for ${userId}`);
    } catch (error) {
      console.error(`Error syncing ${userId}:`, error);

      const status = this.syncStatuses.get(userId);
      if (status) {
        status.errorCount++;
        status.lastError = error instanceof Error ? error.message : "Unknown error";
      }
    }
  }

  /**
   * Update sync time in Firestore settings
   */
  private async updateSyncTime(userId: string): Promise<void> {
    try {
      const settingsRef = doc(db, `users/${userId}/settings/email`);
      await updateDoc(settingsRef, {
        lastSyncAt: Timestamp.now(),
      });
    } catch (error) {
      console.error(`Error updating sync time for ${userId}:`, error);
    }
  }

  /**
   * Get current sync status for a user
   */
  getSyncStatus(userId: string): SyncStatus {
    return (
      this.syncStatuses.get(userId) || {
        isRunning: false,
        lastSyncAt: null,
        nextSyncAt: null,
        syncCount: 0,
        errorCount: 0,
      }
    );
  }

  /**
   * Update sync interval for a user
   */
  async updateSyncInterval(userId: string, intervalMinutes: number): Promise<void> {
    try {
      const settings = await emailService.getSettings(userId);
      if (!settings) return;

      settings.syncIntervalMinutes = intervalMinutes;
      await emailService.saveSettings(userId, settings);

      // Restart syncing with new interval
      if (this.syncIntervals.has(userId)) {
        this.stopSyncing(userId);
        await this.startSyncing(userId);
      }
    } catch (error) {
      console.error(`Error updating sync interval for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Enable/disable auto-sync for a user
   */
  async setAutoSync(userId: string, enabled: boolean): Promise<void> {
    try {
      const settings = await emailService.getSettings(userId);
      if (!settings) return;

      settings.autoSyncEnabled = enabled;
      await emailService.saveSettings(userId, settings);

      if (enabled) {
        await this.startSyncing(userId);
      } else {
        this.stopSyncing(userId);
      }
    } catch (error) {
      console.error(`Error setting auto-sync for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect an email provider and stop syncing
   */
  async disconnectProvider(userId: string, provider: "gmail" | "outlook"): Promise<void> {
    try {
      const settings = await emailService.getSettings(userId);
      if (!settings) return;

      if (provider === "gmail") {
        settings.gmailConnected = false;
        settings.gmailAccessToken = undefined;
        settings.gmailRefreshToken = undefined;
      } else {
        settings.outlookConnected = false;
        settings.outlookAccessToken = undefined;
        settings.outlookRefreshToken = undefined;
      }

      await emailService.saveSettings(userId, settings);

      // If no providers left, stop syncing
      if (!settings.gmailConnected && !settings.outlookConnected) {
        this.stopSyncing(userId);
      }
    } catch (error) {
      console.error(`Error disconnecting ${provider} for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active sync sessions
   */
  getActiveSessions(): Map<string, SyncStatus> {
    const active = new Map<string, SyncStatus>();
    this.syncStatuses.forEach((status, userId) => {
      if (status.isRunning) {
        active.set(userId, status);
      }
    });
    return active;
  }

  /**
   * Stop all active syncing sessions (cleanup)
   */
  stopAll(): void {
    this.syncIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.syncIntervals.clear();

    this.syncStatuses.forEach((status) => {
      status.isRunning = false;
    });

    console.log("Stopped all inbox sync sessions");
  }
}

export const inboxSyncService = InboxSyncServiceClass.getInstance();
