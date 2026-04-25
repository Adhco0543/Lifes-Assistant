'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import ConversationManager, { Conversation } from "./conversationManager";
import ContextRetrieval, { RelevantContext } from "./contextRetrieval";
import PresenceManager, { UserPresence } from "./presenceManager";
import { TaskQueue, Task } from "./taskQueue";
import BackgroundWorkerService from "./backgroundWorker";

export interface AIAssistantState {
  userId: string;
  isInitialized: boolean;
  isOnline: boolean;
  currentActivity: string;
  presence: UserPresence | null;
  recentConversations: Conversation[];
  relevantContext: RelevantContext[];
  pendingTasks: Task[];
  backgroundWorkerRunning: boolean;
  recommendations: Array<{
    taskType: string;
    reason: string;
    urgency: string;
  }>;
}

export interface AIAssistantActions {
  startConversation: (title?: string) => Promise<string>;
  addMessage: (conversationId: string, role: "user" | "assistant", content: string) => Promise<void>;
  scheduleTask: (taskType: string, priority: string, title: string) => Promise<string>;
  getContextForQuery: (query: string) => Promise<RelevantContext[]>;
  updateActivity: (activity: string) => Promise<void>;
  refetchTasks: () => Promise<void>;
  startBackgroundWorker: () => void;
  stopBackgroundWorker: () => void;
}

/**
 * Main hook for using the AI Assistant system
 * Combines conversation management, presence tracking, task queuing, and background worker
 */
export function useAIAssistant(userId: string): [AIAssistantState, AIAssistantActions] {
  const [state, setState] = useState<AIAssistantState>({
    userId,
    isInitialized: false,
    isOnline: true,
    currentActivity: "idle",
    presence: null,
    recentConversations: [],
    relevantContext: [],
    pendingTasks: [],
    backgroundWorkerRunning: false,
    recommendations: [],
  });

  const presenceListenerRef = useRef<(() => void) | null>(null);

  // Initialize the system
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize presence tracking
        await PresenceManager.initializePresence(userId);

        // Get initial presence
        const presence = await PresenceManager.getPresence(userId);
        setState((prev) => ({ ...prev, presence, isOnline: presence?.isOnline ?? true }));

        // Load recent conversations
        const conversations = await ConversationManager.getRecentConversations(userId, 5);
        setState((prev) => ({ ...prev, recentConversations: conversations }));

        // Load pending tasks
        const tasks = await TaskQueue.getPendingTasks(userId);
        setState((prev) => ({ ...prev, pendingTasks: tasks }));

        // Get recommendations
        const recommendations = await BackgroundWorkerService.getProactiveRecommendations(userId);
        setState((prev) => ({ ...prev, recommendations }));

        setState((prev) => ({ ...prev, isInitialized: true }));

        // Set up presence listener
        presenceListenerRef.current = PresenceManager.onPresenceChange(userId, (newPresence) => {
          if (newPresence) {
            setState((prev) => ({
              ...prev,
              presence: newPresence,
              isOnline: newPresence.isOnline,
              currentActivity: newPresence.currentActivity || "idle",
            }));
          }
        });
      } catch (error) {
        console.error("Error initializing AI assistant:", error);
        setState((prev) => ({ ...prev, isInitialized: true }));
      }
    };

    initialize();

    // Refresh data periodically
    const refreshInterval = setInterval(async () => {
      try {
        const conversations = await ConversationManager.getRecentConversations(userId, 5);
        const tasks = await TaskQueue.getPendingTasks(userId);
        const recommendations = await BackgroundWorkerService.getProactiveRecommendations(userId);

        setState((prev) => ({
          ...prev,
          recentConversations: conversations,
          pendingTasks: tasks,
          recommendations,
        }));
      } catch (error) {
        console.error("Error refreshing data:", error);
      }
    }, 60 * 1000); // Refresh every minute

    return () => {
      clearInterval(refreshInterval);
      if (presenceListenerRef.current) {
        presenceListenerRef.current();
      }
    };
  }, [userId]);

  // Define actions
  const actions: AIAssistantActions = {
    startConversation: useCallback(
      async (title?: string) => {
        try {
          const conversationId = await ConversationManager.startNewConversation(userId, title);
          return conversationId;
        } catch (error) {
          console.error("Error starting conversation:", error);
          throw error;
        }
      },
      [userId]
    ),

    addMessage: useCallback(
      async (conversationId: string, role: "user" | "assistant", content: string) => {
        try {
          await ConversationManager.addMessageToConversation(conversationId, role, content);

          // Refresh conversations
          const conversations = await ConversationManager.getRecentConversations(userId, 5);
          setState((prev) => ({ ...prev, recentConversations: conversations }));
        } catch (error) {
          console.error("Error adding message:", error);
          throw error;
        }
      },
      [userId]
    ),

    scheduleTask: useCallback(
      async (taskType: string, priority: string, title: string) => {
        try {
          const taskId = await TaskQueue.addTask(
            userId,
            taskType as any,
            priority as any,
            title
          );

          // Refresh tasks
          const tasks = await TaskQueue.getPendingTasks(userId);
          setState((prev) => ({ ...prev, pendingTasks: tasks }));

          return taskId;
        } catch (error) {
          console.error("Error scheduling task:", error);
          throw error;
        }
      },
      [userId]
    ),

    getContextForQuery: useCallback(
      async (query: string) => {
        try {
          const context = ContextRetrieval.findRelevantContext(query, state.recentConversations, 3);
          setState((prev) => ({ ...prev, relevantContext: context }));
          return context;
        } catch (error) {
          console.error("Error getting context:", error);
          return [];
        }
      },
      [state.recentConversations]
    ),

    updateActivity: useCallback(
      async (activity: string) => {
        try {
          await PresenceManager.updateActivity(userId, activity);
          setState((prev) => ({ ...prev, currentActivity: activity }));
        } catch (error) {
          console.error("Error updating activity:", error);
        }
      },
      [userId]
    ),

    refetchTasks: useCallback(async () => {
      try {
        const tasks = await TaskQueue.getPendingTasks(userId);
        setState((prev) => ({ ...prev, pendingTasks: tasks }));
      } catch (error) {
        console.error("Error refetching tasks:", error);
      }
    }, [userId]),

    startBackgroundWorker: useCallback(() => {
      BackgroundWorkerService.start(userId);
      setState((prev) => ({ ...prev, backgroundWorkerRunning: true }));
    }, [userId]),

    stopBackgroundWorker: useCallback(() => {
      BackgroundWorkerService.stop();
      setState((prev) => ({ ...prev, backgroundWorkerRunning: false }));
    }, []),
  };

  return [state, actions];
}

/**
 * Hook for conversation management
 */
export function useConversation(userId: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const convs = await ConversationManager.getRecentConversations(userId, 10);
        setConversations(convs);
      } catch (error) {
        console.error("Error loading conversations:", error);
      }
    };

    loadConversations();
  }, [userId]);

  return {
    conversations,
    currentConversation,
    setCurrentConversation,
    loadConversations: () => ConversationManager.getRecentConversations(userId, 10),
  };
}

/**
 * Hook for task management
 */
export function useTasks(userId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
  });

  const refreshTasks = useCallback(async () => {
    try {
      const pending = await TaskQueue.getPendingTasks(userId);
      const taskStats = await TaskQueue.getTaskStats(userId);
      setTasks(pending);
      setStats(taskStats);
    } catch (error) {
      console.error("Error refreshing tasks:", error);
    }
  }, [userId]);

  useEffect(() => {
    refreshTasks();
    const interval = setInterval(refreshTasks, 30 * 1000);
    return () => clearInterval(interval);
  }, [refreshTasks]);

  return {
    tasks,
    stats,
    refreshTasks,
    addTask: (type: any, priority: any, title: string) =>
      TaskQueue.addTask(userId, type, priority, title),
    updateStatus: (taskId: string, status: any) =>
      TaskQueue.updateTaskStatus(taskId, status),
  };
}

/**
 * Hook for presence management
 */
export function usePresence(userId: string) {
  const [presence, setPresence] = useState<UserPresence | null>(null);

  useEffect(() => {
    const unsubscribe = PresenceManager.onPresenceChange(userId, (newPresence) => {
      setPresence(newPresence);
    });

    return () => unsubscribe();
  }, [userId]);

  return {
    presence,
    isOnline: presence?.isOnline ?? false,
    isIdle: presence?.currentActivity === "idle",
    updateActivity: (activity: string) => PresenceManager.updateActivity(userId, activity),
  };
}

export default useAIAssistant;
