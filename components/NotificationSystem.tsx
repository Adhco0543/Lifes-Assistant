"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "@/lib/useIntelligenceLayer";
import NotificationToast from "./NotificationToast";
import { Notification } from "@/lib/smartNotificationManager";

interface NotificationSystemProps {
  userId: string;
  maxVisible?: number;
}

export function NotificationSystem({ userId, maxVisible = 3 }: NotificationSystemProps) {
  const { notifications, markAsRead } = useNotifications(userId);
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Show recent notifications, limit to maxVisible
    const recentUnread = notifications
      .filter((n) => !n.read)
      .slice(-maxVisible)
      .reverse();
    setVisibleNotifications(recentUnread);
  }, [notifications, maxVisible]);

  const handleDismiss = (notificationId: string) => {
    markAsRead(notificationId);
    setVisibleNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  return (
    <div className="notification-system">
      {visibleNotifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => handleDismiss(notification.id)}
        />
      ))}

      <style jsx>{`
        .notification-system {
          position: fixed;
          z-index: 999;
          pointer-events: none;
        }

        .notification-system > * {
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

export default NotificationSystem;
