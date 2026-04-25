'use client';

import { useEffect, useState, useCallback } from "react";
import IntelligentBackgroundWorker, { DecisionLog } from "./intelligentBackgroundWorker";
import SmartNotificationManager, { Notification } from "./smartNotificationManager";
import UserMemoryProfileManager, { UserMemoryProfile } from "./userMemoryProfile";
import { AssistantDecision } from "./assistantBrain";

/**
 * Hook for accessing intelligence layer decisions and reasoning
 */
export function useDecisions(userId: string) {
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [stats, setStats] = useState({
    totalDecisions: 0,
    executedDecisions: 0,
    executionRate: 0,
    averageConfidence: 0,
  });
  const [recentMajor, setRecentMajor] = useState<DecisionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDecisions = useCallback(() => {
    try {
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 3000);

      const history = IntelligentBackgroundWorker.getDecisionHistory(userId, 50);
      const decisionStats = IntelligentBackgroundWorker.getDecisionStats(userId);
      const major = IntelligentBackgroundWorker.getRecentMajorDecisions(userId, 1);

      setDecisions(history || []);
      setStats(decisionStats || {
        totalDecisions: 0,
        executedDecisions: 0,
        executionRate: 0,
        averageConfidence: 0,
      });
      setRecentMajor(major || []);
      
      clearTimeout(timeout);
      setLoading(false);
    } catch (error) {
      console.error("Error loading decisions:", error);
      setDecisions([]);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshDecisions();
    // Only refresh on demand, not continuously
    const interval = setInterval(refreshDecisions, 60000); // Refresh every 60 seconds instead
    return () => clearInterval(interval);
  }, [userId]); // Use userId instead of refreshDecisions to prevent infinite loops

  const overrideDecision = useCallback(
    async (decisionId: string, choice: "approve" | "reject" | "reschedule", reason?: string) => {
      try {
        await IntelligentBackgroundWorker.overrideDecision(userId, decisionId, choice, reason);
        refreshDecisions();
      } catch (error) {
        console.error("Error overriding decision:", error);
        throw error;
      }
    },
    [userId, refreshDecisions]
  );

  return {
    decisions,
    stats,
    recentMajor,
    loading,
    refreshDecisions,
    overrideDecision,
  };
}

/**
 * Hook for accessing notifications
 */
export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Subscribe to new notifications
    const unsubscribe = SmartNotificationManager.subscribe(userId, (notification) => {
      setNotifications((prev) => [...prev, notification]);
      setUnreadCount((prev) => (notification.read ? prev : prev + 1));
    });

    // Get current notifications
    const current = SmartNotificationManager.getNotifications(userId);
    setNotifications(current);
    setUnreadCount(current.filter((n) => !n.read).length);

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = useCallback((notificationId: string) => {
    SmartNotificationManager.markAsRead(userId, notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, [userId]);

  const getUnread = useCallback(() => {
    return SmartNotificationManager.getUnreadNotifications(userId);
  }, [userId]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    getUnread,
  };
}

/**
 * Hook for accessing and updating user memory profile
 */
export function useUserMemoryProfile(userId: string) {
  const [profile, setProfile] = useState<UserMemoryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const p = await UserMemoryProfileManager.createOrGetProfile(userId);
      setProfile(p);
      setLoading(false);
    } catch (error) {
      console.error("Error loading profile:", error);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<UserMemoryProfile>) => {
      if (!profile) return;
      try {
        const updated = { ...profile, ...updates };
        await UserMemoryProfileManager.updateProfile(userId, updated);
        setProfile(updated);
      } catch (error) {
        console.error("Error updating profile:", error);
        throw error;
      }
    },
    [userId, profile]
  );

  const addCustomer = useCallback(
    async (customer: {
      name: string;
      frequency?: number;
      lastContact?: Date;
      preferredMethod?: string;
      notes?: string;
    }) => {
      try {
        await UserMemoryProfileManager.addFrequentCustomer(userId, customer);
        await loadProfile();
      } catch (error) {
        console.error("Error adding customer:", error);
        throw error;
      }
    },
    [userId, loadProfile]
  );

  const addJobType = useCallback(
    async (jobType: {
      name: string;
      frequency?: number;
      avgPrice?: number;
      commonMaterials?: string[];
      avgDuration?: number;
    }) => {
      try {
        await UserMemoryProfileManager.addCommonJobType(userId, jobType);
        await loadProfile();
      } catch (error) {
        console.error("Error adding job type:", error);
        throw error;
      }
    },
    [userId, loadProfile]
  );

  const addPriority = useCallback(
    async (priority: {
      priority: string;
      importance: number;
      deadline?: Date;
    }) => {
      try {
        await UserMemoryProfileManager.addCurrentPriority(userId, priority);
        await loadProfile();
      } catch (error) {
        console.error("Error adding priority:", error);
        throw error;
      }
    },
    [userId, loadProfile]
  );

  const isWorkingHours = useCallback(async () => {
    try {
      return await UserMemoryProfileManager.isWorkingHours(userId);
    } catch (error) {
      console.error("Error checking working hours:", error);
      return true; // Default to working hours if error
    }
  }, [userId]);

  return {
    profile,
    loading,
    updateProfile,
    addCustomer,
    addJobType,
    addPriority,
    isWorkingHours,
    reload: loadProfile,
  };
}

/**
 * Combined hook for all intelligence layer features
 */
export function useIntelligenceLayer(userId: string) {
  const decisions = useDecisions(userId);
  const notifications = useNotifications(userId);
  const memory = useUserMemoryProfile(userId);

  return {
    decisions,
    notifications,
    memory,
  };
}

export default useIntelligenceLayer;
