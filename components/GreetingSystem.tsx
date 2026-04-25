"use client";

import { useEffect, useState } from "react";
import { ConversationManager, Conversation } from "@/lib/conversationManager";
import { ContextRetrieval, RelevantContext } from "@/lib/contextRetrieval";
import PresenceManager, { UserPresence } from "@/lib/presenceManager";
import BackgroundWorkerService from "@/lib/backgroundWorker";

interface GreetingProps {
  userId: string;
  onGreetingComplete?: () => void;
}

interface GreetingState {
  loading: boolean;
  greeting: string;
  pendingItems: string[];
  recentContext?: RelevantContext;
  presence?: UserPresence;
  recommendations: Array<{
    taskType: string;
    reason: string;
    urgency: string;
  }>;
}

export function GreetingSystem({ userId, onGreetingComplete }: GreetingProps) {
  const [state, setState] = useState<GreetingState>({
    loading: true,
    greeting: "",
    pendingItems: [],
    recommendations: [],
  });

  useEffect(() => {
    const initializeGreeting = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true }));

        // 1. Get user presence
        const presence = await PresenceManager.getPresence(userId);

        // 2. Get recent conversations
        const recentConversations = await ConversationManager.getRecentConversations(userId, 3);

        // 3. Generate personalized greeting
        let greeting = generateGreeting(presence, recentConversations);

        // 4. Get pending items and context
        let pendingItems: string[] = [];
        let relevantContext: RelevantContext | undefined;

        if (recentConversations.length > 0) {
          const lastConv = recentConversations[0];
          const contextData = ContextRetrieval.getGreetingContext(lastConv);
          pendingItems = contextData.pendingItems;

          if (contextData.daysSinceLastChat > 0) {
            greeting += ` We last spoke ${contextData.daysSinceLastChat} day${contextData.daysSinceLastChat > 1 ? "s" : ""} ago about ${contextData.lastTopic}.`;
          }

          // Find relevant context for today
          const relevantContexts = ContextRetrieval.findRelevantContext(
            "Today's priorities",
            recentConversations,
            1
          );
          if (relevantContexts.length > 0) {
            relevantContext = relevantContexts[0];
          }
        }

        // 5. Get proactive recommendations
        const recommendations = await BackgroundWorkerService.getProactiveRecommendations(userId);

        setState({
          loading: false,
          greeting,
          pendingItems,
          recentContext: relevantContext,
          presence,
          recommendations,
        });

        // Initialize presence tracking
        await PresenceManager.initializePresence(userId);

        // Start background worker
        BackgroundWorkerService.start(userId);

        onGreetingComplete?.();
      } catch (error) {
        console.error("Error initializing greeting:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          greeting: "Welcome back! How can I help you today?",
        }));
      }
    };

    initializeGreeting();

    return () => {
      BackgroundWorkerService.stop();
    };
  }, [userId, onGreetingComplete]);

  if (state.loading) {
    return (
      <div className="greeting-card loading">
        <div className="loading-spinner" />
        <p>Loading your personalized assistant...</p>
      </div>
    );
  }

  return (
    <div className="greeting-container">
      <div className="greeting-card">
        <div className="greeting-header">
          <h2>👋 {state.greeting}</h2>
          {state.presence && (
            <div className="presence-indicator">
              <span className={`status-dot ${state.presence.isOnline ? "online" : "offline"}`} />
              {state.presence.isOnline ? "Online" : "Offline"}
            </div>
          )}
        </div>

        {state.recentContext && (
          <div className="context-section">
            <h3>Last Conversation</h3>
            <div className="context-box">
              <p className="context-title">{state.recentContext.title}</p>
              <p className="context-preview">{state.recentContext.context}</p>
              <div className="topics-tags">
                {state.recentContext.keyTopics.slice(0, 3).map((topic) => (
                  <span key={topic} className="topic-tag">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {state.pendingItems.length > 0 && (
          <div className="pending-section">
            <h3>📋 Pending Items</h3>
            <ul className="pending-list">
              {state.pendingItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {state.recommendations.length > 0 && (
          <div className="recommendations-section">
            <h3>💡 Quick Suggestions</h3>
            <div className="recommendations-list">
              {state.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`recommendation-item urgency-${rec.urgency}`}
                >
                  <div className="rec-icon">
                    {rec.urgency === "high" && "🔴"}
                    {rec.urgency === "medium" && "🟡"}
                    {rec.urgency === "low" && "🟢"}
                  </div>
                  <div className="rec-content">
                    <p className="rec-task">{rec.taskType.replace(/_/g, " ")}</p>
                    <p className="rec-reason">{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .greeting-container {
          width: 100%;
          max-width: 800px;
          margin: 20px auto;
          animation: slideIn 0.4s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .greeting-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 24px;
          color: white;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .greeting-card.loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .greeting-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .greeting-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .presence-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.2);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: red;
        }

        .status-dot.online {
          background: #4ade80;
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
        }

        .context-section,
        .pending-section,
        .recommendations-section {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }

        .context-section h3,
        .pending-section h3,
        .recommendations-section h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.9;
        }

        .context-box {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          backdrop-filter: blur(10px);
        }

        .context-title {
          margin: 0 0 8px 0;
          font-weight: 600;
          font-size: 13px;
        }

        .context-preview {
          margin: 0 0 10px 0;
          font-size: 12px;
          opacity: 0.9;
          line-height: 1.4;
        }

        .topics-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .topic-tag {
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          white-space: nowrap;
        }

        .pending-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .pending-list li {
          padding: 8px 0;
          padding-left: 16px;
          position: relative;
          font-size: 13px;
        }

        .pending-list li:before {
          content: "→";
          position: absolute;
          left: 0;
        }

        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recommendation-item {
          display: flex;
          gap: 10px;
          background: rgba(255, 255, 255, 0.1);
          padding: 10px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
        }

        .rec-icon {
          font-size: 18px;
          min-width: 24px;
        }

        .rec-content {
          flex: 1;
        }

        .rec-task {
          margin: 0 0 4px 0;
          font-weight: 600;
          font-size: 13px;
          text-transform: capitalize;
        }

        .rec-reason {
          margin: 0;
          font-size: 12px;
          opacity: 0.85;
        }

        .recommendation-item.urgency-high {
          border-left: 3px solid #ff6b6b;
        }

        .recommendation-item.urgency-medium {
          border-left: 3px solid #ffd93d;
        }

        .recommendation-item.urgency-low {
          border-left: 3px solid #6bcf7f;
        }

        @media (max-width: 600px) {
          .greeting-card {
            padding: 16px;
          }

          .greeting-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .greeting-header h2 {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}

function generateGreeting(presence: UserPresence | null, conversations: Conversation[]): string {
  const hour = new Date().getHours();
  let timeGreeting = "Welcome back";

  if (hour < 12) timeGreeting = "Good morning";
  else if (hour < 18) timeGreeting = "Good afternoon";
  else timeGreeting = "Good evening";

  if (presence?.sessionDuration) {
    const hours = Math.floor(presence.sessionDuration / 3600);
    if (hours < 1) {
      return `${timeGreeting}! Ready to continue where we left off?`;
    } else {
      return `${timeGreeting}! You've been productive today!`;
    }
  }

  if (conversations.length === 0) {
    return `${timeGreeting}! Let's get started.`;
  }

  const daysSince = Math.floor(
    (Date.now() - conversations[0].updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince === 0) {
    return `${timeGreeting}! I was just working on your tasks.`;
  } else if (daysSince === 1) {
    return `${timeGreeting}! Haven't seen you since yesterday.`;
  }

  return `${timeGreeting}! It's been ${daysSince} days.`;
}

export default GreetingSystem;
