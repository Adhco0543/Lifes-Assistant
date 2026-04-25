'use client';

import React, { useState, useEffect } from 'react';
import { useResponsive } from '../lib/hooks';

export type IconName =
  | 'checkmark'
  | 'alert'
  | 'success'
  | 'loading'
  | 'arrow'
  | 'star'
  | 'heart'
  | 'settings'
  | 'user'
  | 'menu';

interface RichMediaProps {
  type?: 'icon' | 'animation' | 'visual';
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animation?: 'pulse' | 'bounce' | 'spin' | 'fade' | 'slide';
  color?: string;
  className?: string;
}

/**
 * Icon Components
 */
const Icons: Record<IconName, React.FC<{ size: number; color: string }>> = {
  checkmark: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  alert: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
  success: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      opacity="0.7"
    >
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.2" />
      <path d="M10 15l-3-3 1.41-1.41L10 12.17l5.59-5.59L17 8l-7 7z" fill={color} />
    </svg>
  ),
  loading: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="0" />
    </svg>
  ),
  arrow: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  ),
  star: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      opacity="0.8"
    >
      <polygon points="12 2 15.09 10.26 24 10.26 17.55 16.61 20.64 24.88 12 18.53 3.36 24.88 6.45 16.61 0 10.26 8.91 10.26" />
    </svg>
  ),
  heart: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      opacity="0.8"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  ),
  settings: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"></path>
    </svg>
  ),
  user: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  menu: ({ size, color }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  ),
};

/**
 * Icon Component
 */
const IconComponent: React.FC<RichMediaProps> = ({
  icon = 'checkmark',
  size = 'md',
  color = '#4171ff',
  className = '',
}) => {
  const sizeMap = { sm: 16, md: 24, lg: 32, xl: 48 };
  const IconSvg = Icons[icon];

  return (
    <div className={`icon-wrapper ${className}`}>
      <IconSvg size={sizeMap[size]} color={color} />
    </div>
  );
};

/**
 * Animation Component
 */
const AnimationComponent: React.FC<RichMediaProps> = ({
  animation = 'pulse',
  size = 'md',
  className = '',
}) => {
  const sizeMap = { sm: 20, md: 40, lg: 60, xl: 80 };

  return (
    <div
      className={`animation-container ${animation} ${className}`}
      style={{ width: sizeMap[size], height: sizeMap[size] }}
    >
      <div className={`animated-element ${animation}`}></div>
    </div>
  );
};

/**
 * Visual Component with gradient and effects
 */
const VisualComponent: React.FC<RichMediaProps> = ({
  color = '#4171ff',
  size = 'md',
  className = '',
}) => {
  const sizeMap = { sm: 50, md: 100, lg: 150, xl: 200 };

  return (
    <div
      className={`visual-wrapper ${className}`}
      style={{ width: sizeMap[size], height: sizeMap[size] }}
    >
      <div
        className="visual-gradient"
        style={{
          background: `linear-gradient(135deg, ${color}40 0%, ${color}10 100%)`,
        }}
      ></div>
      <div className="visual-accent"></div>
    </div>
  );
};

/**
 * Main Rich Media Component
 */
export const RichMedia: React.FC<RichMediaProps> = ({
  type = 'icon',
  ...props
}) => {
  const { isMobile } = useResponsive();
  
  // Adjust size for mobile if not explicitly set
  const adjustedProps = {
    ...props,
    size: isMobile && !props.size ? 'md' : props.size || 'md',
  };

  switch (type) {
    case 'animation':
      return <AnimationComponent {...adjustedProps} />;
    case 'visual':
      return <VisualComponent {...adjustedProps} />;
    case 'icon':
    default:
      return <IconComponent {...adjustedProps} />;
  }
};

export default RichMedia;

// Styles
const styles = `
  .icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, filter 0.2s ease;
  }

  .icon-wrapper:hover {
    transform: scale(1.1);
    filter: brightness(1.1);
  }

  .animation-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .animated-element {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(65, 113, 255, 0.3) 0%, rgba(65, 113, 255, 0) 70%);
  }

  .animated-element.pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .animated-element.bounce {
    animation: bounce 1s ease-in-out infinite;
  }

  .animated-element.spin {
    animation: spin 3s linear infinite;
  }

  .animated-element.fade {
    animation: fadeInOut 2s ease-in-out infinite;
  }

  .animated-element.slide {
    animation: slide 2s ease-in-out infinite;
  }

  .visual-wrapper {
    position: relative;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .visual-gradient {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  .visual-accent {
    position: absolute;
    width: 50%;
    height: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%);
    top: -25%;
    right: -25%;
    border-radius: 50%;
    animation: float 6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.5;
    }
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-20px);
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes fadeInOut {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.2;
    }
  }

  @keyframes slide {
    0%, 100% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(10px);
    }
  }

  @keyframes float {
    0%, 100% {
      transform: translate(0, 0) rotate(0deg);
    }
    50% {
      transform: translate(10px, 10px) rotate(180deg);
    }
  }

  /* Mobile and tablet optimizations */
  @media (max-width: 768px) {
    .icon-wrapper {
      transition: transform 0.15s ease, filter 0.15s ease;
    }

    .visual-wrapper {
      border-radius: 0.75rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }
  }

  @media (max-width: 640px) {
    .icon-wrapper:hover {
      transform: scale(1.05);
    }

    @keyframes bounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-15px);
      }
    }

    @keyframes slide {
      0%, 100% {
        transform: translateX(0);
      }
      50% {
        transform: translateX(5px);
      }
    }
  }
`;
