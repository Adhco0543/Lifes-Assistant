"use client";

import { useEffect, useState } from "react";
import { Notification } from "@/lib/smartNotificationManager";

interface NotificationToastProps {
  notification: Notification;
  onDismiss?: () => void;
}

export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (notification.autoHideAfter) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, notification.autoHideAfter);

      return () => clearTimeout(timer);
    }
  }, [notification.autoHideAfter, onDismiss]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "action_required":
        return "!";
      default:
        return "ℹ";
    }
  };

  const getClass = () => {
    return `notification-toast notification-${notification.type} interruption-${notification.interruptionLevel}`;
  };

  return (
    <div className={getClass()}>
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-content">
        <div className="toast-title">{notification.title}</div>
        {notification.message && (
          <div className="toast-message">{notification.message}</div>
        )}
      </div>
      <button
        className="toast-close"
        onClick={() => {
          setIsVisible(false);
          onDismiss?.();
        }}
      >
        ✕
      </button>

      <style jsx>{`
        .notification-toast {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.3s ease;
          font-size: 14px;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .notification-success {
          border-left: 4px solid #4caf50;
        }

        .notification-warning {
          border-left: 4px solid #ff9800;
        }

        .notification-action_required {
          border-left: 4px solid #f44336;
        }

        .notification-info {
          border-left: 4px solid #2196f3;
        }

        .toast-icon {
          font-size: 18px;
          font-weight: 600;
          width: 20px;
          text-align: center;
        }

        .notification-success .toast-icon {
          color: #4caf50;
        }

        .notification-warning .toast-icon {
          color: #ff9800;
        }

        .notification-action_required .toast-icon {
          color: #f44336;
        }

        .notification-info .toast-icon {
          color: #2196f3;
        }

        .toast-content {
          flex: 1;
        }

        .toast-title {
          font-weight: 600;
          margin-bottom: 2px;
          color: #333;
        }

        .toast-message {
          font-size: 13px;
          color: #666;
        }

        .toast-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #999;
          font-size: 16px;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
        }

        .toast-close:hover {
          color: #333;
        }

        /* Different display styles based on interruption level */
        .interruption-silent {
          opacity: 0.6;
          pointer-events: none;
        }

        .interruption-subtle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 100;
        }

        .interruption-noticeable {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 200;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        }

        .interruption-urgent {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .interruption-urgent .notification-toast {
          width: 100%;
          max-width: 500px;
        }

        @media (max-width: 600px) {
          .interruption-subtle {
            bottom: 10px;
            right: 10px;
            left: 10px;
            width: calc(100% - 20px);
          }

          .interruption-noticeable {
            width: 90%;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}

export default NotificationToast;
