'use client';

import React from 'react';

interface HeroBackgroundProps {
  theme?: 'gradient' | 'team' | 'success' | 'professional' | 'modern';
  height?: string;
  children?: React.ReactNode;
  overlay?: boolean;
}

export const HeroBackground: React.FC<HeroBackgroundProps> = ({
  theme = 'professional',
  height = '400px',
  children,
  overlay = true,
}) => {
  const getBackgroundStyle = () => {
    const themes: Record<string, React.CSSProperties> = {
      gradient: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
      team: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        position: 'relative',
      },
      success: {
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      },
      professional: {
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      },
      modern: {
        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      },
    };

    return themes[theme] || themes.professional;
  };

  return (
    <div
      style={{
        ...getBackgroundStyle(),
        height,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Animated background pattern */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.1,
        }}
        viewBox="0 0 1200 600"
      >
        <defs>
          <pattern
            id="dots"
            x="0"
            y="0"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="30" cy="30" r="3" fill="white" />
          </pattern>
          <pattern
            id="grid"
            x="0"
            y="0"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
            stroke="white"
            strokeWidth="1"
          >
            <path d="M 60 0 L 0 0 0 60" fill="none" />
          </pattern>
        </defs>
        <rect width="1200" height="600" fill="url(#dots)" />
        <rect width="1200" height="600" fill="url(#grid)" />
      </svg>

      {/* Floating shapes animation */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.15,
        }}
        viewBox="0 0 1200 600"
      >
        <g style={styles.floatingShape}>
          <circle cx="100" cy="50" r="40" fill="white" />
        </g>
        <g style={styles.floatingShape2}>
          <rect x="800" y="400" width="80" height="80" fill="white" rx="10" />
        </g>
        <g style={styles.floatingShape3}>
          <circle cx="600" cy="300" r="60" fill="white" />
        </g>
      </svg>

      {/* People collaboration SVG */}
      <svg
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '300px',
          height: '300px',
          opacity: 0.2,
        }}
        viewBox="0 0 300 300"
      >
        <g>
          {/* Person 1 */}
          <circle cx="80" cy="80" r="20" fill="white" />
          <rect x="65" y="110" width="30" height="40" fill="white" />
          <rect x="60" y="155" width="15" height="35" fill="white" />
          <rect x="85" y="155" width="15" height="35" fill="white" />

          {/* Person 2 */}
          <circle cx="150" cy="70" r="22" fill="white" />
          <rect x="133" y="100" width="34" height="45" fill="white" />
          <rect x="128" y="150" width="16" height="40" fill="white" />
          <rect x="156" y="150" width="16" height="40" fill="white" />

          {/* Person 3 */}
          <circle cx="220" cy="85" r="18" fill="white" />
          <rect x="207" y="115" width="26" height="38" fill="white" />
          <rect x="203" y="158" width="13" height="32" fill="white" />
          <rect x="224" y="158" width="13" height="32" fill="white" />

          {/* Connection lines */}
          <line
            x1="100"
            y1="155"
            x2="150"
            y2="145"
            stroke="white"
            strokeWidth="2"
            opacity="0.5"
          />
          <line
            x1="170"
            y1="145"
            x2="220"
            y2="158"
            stroke="white"
            strokeWidth="2"
            opacity="0.5"
          />

          {/* Collaboration circles */}
          <circle cx="150" cy="250" r="30" fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
          <circle cx="150" cy="250" r="45" fill="none" stroke="white" strokeWidth="1" opacity="0.2" />
        </g>
      </svg>

      {overlay && (
        <div
          style={{
            ...styles.overlay,
            background:
              'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
          }}
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        {children}
      </div>

      <style jsx>{`
        @keyframes float1 {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-30px) translateX(20px);
          }
        }

        @keyframes float2 {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(20px) translateX(-20px);
          }
        }

        @keyframes float3 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-40px) rotate(10deg);
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Enhanced page wrapper with background
 */
export const PageWrapper: React.FC<{
  children: React.ReactNode;
  theme?: 'gradient' | 'team' | 'success' | 'professional' | 'modern';
}> = ({ children, theme = 'professional' }) => {
  return (
    <div style={styles.pageWrapper}>
      <HeroBackground theme={theme} height="300px" overlay={false}>
        <h1 style={styles.heroTitle}>Welcome Back</h1>
        <p style={styles.heroSubtitle}>Let's build something amazing today</p>
      </HeroBackground>

      <div style={styles.contentArea}>{children}</div>
    </div>
  );
};

/**
 * Collaboration indicator - shows who's viewing
 */
export const CollaborationIndicator: React.FC<{
  teamMembers: Array<{ name: string; color: string }>;
}> = ({ teamMembers }) => {
  return (
    <div style={styles.collaborationBox}>
      <p style={styles.collaborationLabel}>👥 Active Collaborators</p>
      <div style={styles.avatarStack}>
        {teamMembers.map((member, idx) => (
          <div
            key={idx}
            style={{
              ...styles.avatar,
              backgroundColor: member.color,
              zIndex: 10 - idx,
              marginLeft: idx > 0 ? '-12px' : 0,
              animation: `pulse 2s ease-in-out ${idx * 0.3}s infinite`,
            }}
            title={member.name}
          >
            {member.name.substring(0, 1).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  floatingShape: {
    animation: 'float1 6s ease-in-out infinite',
  },
  floatingShape2: {
    animation: 'float2 7s ease-in-out infinite',
  },
  floatingShape3: {
    animation: 'float3 8s ease-in-out infinite',
  },
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  pageWrapper: {
    minHeight: '100vh',
    background: '#f8f9fa',
  },
  contentArea: {
    maxWidth: '1200px',
    margin: '-50px auto 0',
    padding: '2rem',
    position: 'relative' as const,
    zIndex: 2,
  },
  heroTitle: {
    color: 'white',
    fontSize: '2.5rem',
    fontWeight: 'bold' as const,
    margin: 0,
    textShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: '1.1rem',
    margin: '0.5rem 0 0 0',
    textShadow: '0 1px 5px rgba(0,0,0,0.1)',
  },
  collaborationBox: {
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '1.5rem',
  },
  collaborationLabel: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 'bold' as const,
    marginBottom: '0.75rem',
  },
  avatarStack: {
    display: 'flex' as const,
    alignItems: 'center' as const,
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    color: 'white',
    fontWeight: 'bold' as const,
    fontSize: '0.9rem',
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
};
