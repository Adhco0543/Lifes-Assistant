'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseBackend } from '../lib/firebaseBackend';

interface AuthFormProps {
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, initialMode = 'login' }) => {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Please enter your name');
          setIsLoading(false);
          return;
        }

        await firebaseBackend.initialize();
        const user = await firebaseBackend.signUp(email, password, displayName);

        if (user) {
          setSuccess('Account created. Opening your workspace…');
          setEmail('');
          setPassword('');
          setDisplayName('');

          if (onSuccess) {
            await onSuccess();
          } else {
            router.push('/dashboard');
          }
        } else {
          setError('Sign up failed');
        }
      } else {
        // Login
        await firebaseBackend.initialize();
        const user = await firebaseBackend.login(email, password);

        if (user) {
          setSuccess('Signed in. Opening your workspace…');
          setEmail('');
          setPassword('');

          if (onSuccess) {
            await onSuccess();
          } else {
            router.push('/dashboard');
          }
        } else {
          setError('Login failed');
        }
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError("That email/password doesn't match an account. If this is your first time here, tap Sign up. If you already had an account, use Forgot password.");
      } else if (code === 'auth/email-already-in-use') {
        setError('An account already exists with this email. Sign in or use Forgot password.');
      } else if (code === 'auth/weak-password') {
        setError('Choose a password with at least 6 characters.');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  const handleForgotPassword = async () => {
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }

    try {
      setIsLoading(true);
      await firebaseBackend.initialize();
      await firebaseBackend.sendPasswordReset(email.trim());
      setSuccess('Password reset email sent. Check your inbox and spam folder.');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-email') {
        setError('Enter a valid email address.');
      } else {
        setError('I could not send the reset email. Try again in a moment.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-form-container">
      <div className="auth-form">
        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="subtitle">
          {mode === 'login'
            ? 'Sign in to continue your conversations, memory, tasks, and workspace'
            : 'Create one workspace for life, work, ideas, and everything in between'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            {mode === 'login' && (
              <div className="password-help-row">
                <p className="help-text">At least 6 characters</p>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="link-btn forgot-btn"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="toggle-mode">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={toggleMode} className="link-btn">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={toggleMode} className="link-btn">
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="info-box">
          <p>
            ✦ <strong>One account:</strong> Your conversations, memory, saved work, and receipts can follow you across devices.
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-form-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
          background: #212121;
          padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
        }

        .auth-form {
          background: #2b2b2b;
          padding: 2.5rem;
          border-radius: 1rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
          width: 100%;
          max-width: 400px;
          margin: auto 0;
          flex: 0 0 auto;
        }

        .auth-form h2 {
          margin: 0 0 0.5rem;
          color: #f2f2f2;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .subtitle {
          margin: 0 0 1.5rem;
          color: #a6a6a6;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #d0d0d0;
          font-size: 0.9rem;
        }

        .form-group input {
          padding: 0.75rem;
          border: 1px solid #474747;
          border-radius: 0.5rem;
          font-size: 0.95rem;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-group input:focus {
          outline: none;
          border-color: #6e6e6e;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
          background: #303030;
        }

        .form-group input:disabled {
          background: #262626;
          color: #8c8c8c;
        }

        .help-text {
          margin: 0;
          font-size: 0.75rem;
          color: #999;
        }

        .password-help-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .forgot-btn {
          font-size: 0.78rem;
          white-space: nowrap;
        }

        .error-message {
          padding: 0.75rem;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 0.4rem;
          color: #c33;
          font-size: 0.9rem;
          text-align: center;
        }

        .success-message {
          padding: 0.75rem;
          background: #efe;
          border: 1px solid #cfc;
          border-radius: 0.4rem;
          color: #3c3;
          font-size: 0.9rem;
          text-align: center;
        }

        .submit-btn {
          padding: 0.75rem;
          background: #f4f4f4;
          color: #111;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 44px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.22);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .toggle-mode {
          margin: 1.5rem 0 0;
          text-align: center;
          color: #a6a6a6;
          font-size: 0.9rem;
        }

        .link-btn {
          background: none;
          border: none;
          color: #d6d6d6;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
          padding: 0;
          font-size: inherit;
        }

        .link-btn:hover {
          text-decoration: underline;
          color: #ffffff;
        }

        .info-box {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #242424;
          border-radius: 0.5rem;
          border-left: 3px solid #5b5b5b;
        }

        .info-box p {
          margin: 0;
          font-size: 0.85rem;
          color: #8f8f8f;
          line-height: 1.4;
        }

        .info-box strong {
          color: #d6d6d6;
        }

        @media (max-width: 480px) {
          .auth-form {
            padding: 1.5rem;
          }

          .auth-form h2 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthForm;
