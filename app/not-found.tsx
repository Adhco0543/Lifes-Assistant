'use client';

export const revalidate = false;
export const dynamic = 'force-dynamic';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '4rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>404</h1>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontWeight: 'normal' }}>
        Page Not Found
      </h2>
      <p style={{ fontSize: '1rem', marginBottom: '2rem', maxWidth: '500px' }}>
        The page you are looking for doesn't exist. It might have been moved or deleted.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.75rem 2rem',
          fontSize: '1rem',
          background: 'white',
          color: '#667eea',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontWeight: 'bold',
          textDecoration: 'none',
          display: 'inline-block',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Go Back Home
      </Link>
    </div>
  );
}
